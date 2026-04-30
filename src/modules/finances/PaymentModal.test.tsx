import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../core/api";
import { FACTURA_CHANGED_EVENT, INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import type { PackagePaymentContext } from "../../core/types";
import { minimalAppSettings } from "../../test/fixtures/appSettings";
import { PaymentModal, type PaymentPrefill } from "./PaymentModal";

function paymentMontoField(): HTMLElement {
	return screen.getByPlaceholderText("$ 0");
}

vi.mock("../../core/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../core/api")>();
	return {
		...actual,
		crearIngreso: vi.fn().mockResolvedValue({ id: "ing-1" }),
		guardarBorradorFactura: vi.fn().mockResolvedValue({ id: "f-new" }),
		emitirFactura: vi.fn().mockResolvedValue({ id: "f-emit" }),
		crearClienteYPaquete: vi.fn(),
		crearPaquete: vi.fn(),
	};
});

describe("PaymentModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const prefillBase: PaymentPrefill = {
		citaId: "c-1",
		pacienteNombre: "Laura Méndez",
		pacienteDocumento: "112233",
		concepto: "Sesión terapia",
		suggestedPrice: 120_000,
	};

	it("exige monto mayor que cero antes de invocar al backend", async () => {
		const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
		render(
			<PaymentModal
				open
				prefill={prefillBase}
				onClose={() => {}}
			/>,
		);
		const monto = paymentMontoField();
		fireEvent.change(monto, { target: { value: "" } });
		const form = screen.getByRole("dialog").querySelector("form");
		expect(form).toBeTruthy();
		fireEvent.submit(form!);
		expect(await screen.findByRole("alert")).toHaveTextContent(/Indique un monto válido/);
		expect(api.crearIngreso).not.toHaveBeenCalled();
		dispatch.mockRestore();
	});

	it("muestra advertencia cuando el monto difiere del total esperado", async () => {
		const user = userEvent.setup();
		render(
			<PaymentModal
				open
				prefill={prefillBase}
				onClose={() => {}}
			/>,
		);
		const monto = paymentMontoField();
		await user.clear(monto);
		await user.type(monto, "50000");
		expect(screen.getByRole("status")).toHaveTextContent(/difiere del total esperado/);
	});

	it("registra ingreso simple y emite evento al cerrar con éxito", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
		render(
			<PaymentModal
				open
				prefill={{ ...prefillBase, suggestedPrice: 0 }}
				onClose={onClose}
			/>,
		);
		const monto = paymentMontoField();
		await user.clear(monto);
		await user.type(monto, "80000");
		await user.click(screen.getByRole("button", { name: /Registrar pago/i }));
		await vi.waitFor(() => expect(api.crearIngreso).toHaveBeenCalled());
		expect(onClose).toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({ type: INGRESO_REGISTRADO_EVENT }),
		);
		dispatch.mockRestore();
	});

	it("con factura marcada, llama borrador y emisión", async () => {
		const user = userEvent.setup();
		const settings = minimalAppSettings();
		const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
		render(
			<PaymentModal
				open
				prefill={{ ...prefillBase, suggestedPrice: 0 }}
				settings={settings}
				onClose={() => {}}
			/>,
		);
		await user.click(
			screen.getByRole("checkbox", { name: /Generar documento de venta/i }),
		);
		const monto = paymentMontoField();
		await user.clear(monto);
		await user.type(monto, "99000");
		await user.click(screen.getByRole("button", { name: /Registrar pago/i }));
		await vi.waitFor(() => expect(api.emitirFactura).toHaveBeenCalled());
		expect(api.guardarBorradorFactura).toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({ type: FACTURA_CHANGED_EVENT }),
		);
		dispatch.mockRestore();
	});

	it("flujo paquete sin cliente ni datos nuevos muestra error y no llama crearPaquete", async () => {
		const user = userEvent.setup();
		const ctx: PackagePaymentContext = {
			serviceType: "svc_a",
			totalSesiones: 6,
			expectedPrecioTotalConIva: 200_000,
			ingresoConcepto: "Plan prueba",
			pacienteNombre: "Cliente X",
			pacienteDocumento: "999",
		};
		render(
			<PaymentModal open prefill={null} packageCheckout={ctx} onClose={() => {}} />,
		);
		await user.click(screen.getByRole("button", { name: /Confirmar cobro/i }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/Falta el cliente para registrar el plan/,
		);
		expect(api.crearPaquete).not.toHaveBeenCalled();
	});
});
