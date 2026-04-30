import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../core/api";
import { INGRESO_REGISTRADO_EVENT } from "../../core/constants";
import type { Factura, FacturaLinea } from "../../core/types";
import { minimalAppSettings } from "../../test/fixtures/appSettings";
import { FacturaEditor } from "./FacturaEditor";

vi.mock("../../core/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../core/api")>();
	return {
		...actual,
		buscarClientes: vi.fn().mockResolvedValue([]),
		guardarBorradorFactura: vi.fn().mockResolvedValue({ id: "bor-1" }),
		emitirFactura: vi.fn().mockResolvedValue({ id: "emit-1" }),
	};
});

function lineaEmitida(overrides: Partial<FacturaLinea> = {}): FacturaLinea {
	return {
		id: "l1",
		facturaId: "f1",
		orden: 1,
		descripcion: "Servicio A",
		cantidad: 1,
		precioUnitario: 100_000,
		tasaImpuestoPct: 19,
		baseImponible: 100_000,
		impuesto: 19_000,
		totalLinea: 119_000,
		...overrides,
	};
}

describe("FacturaEditor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("actualiza el total mostrado al elegir servicio en una línea nueva", async () => {
		const user = userEvent.setup();
		const settings = minimalAppSettings();
		render(<FacturaEditor settings={settings} factura={null} onClose={() => {}} />);
		await user.type(screen.getByPlaceholderText(/Buscar por nombre/i), "Cliente Prueba");
		await user.type(screen.getByPlaceholderText(/Buscar por documento/i), "445566");
		const servicioSelect = screen.getByDisplayValue("— Seleccionar —");
		await user.selectOptions(servicioSelect, "Servicio A");
		expect(screen.getByText("Total").parentElement).toHaveTextContent(/59\.500/);
	});

	it("muestra error si falla guardarBorradorFactura", async () => {
		const user = userEvent.setup();
		vi.mocked(api.guardarBorradorFactura).mockRejectedValueOnce(new Error("Error de persistencia"));
		const settings = minimalAppSettings();
		render(<FacturaEditor settings={settings} factura={null} onClose={() => {}} />);
		await user.type(screen.getByPlaceholderText(/Buscar por nombre/i), "Cliente Prueba");
		await user.type(screen.getByPlaceholderText(/Buscar por documento/i), "445566");
		const servicioSelect = screen.getByDisplayValue("— Seleccionar —");
		await user.selectOptions(servicioSelect, "Servicio A");
		await user.click(screen.getByRole("button", { name: /Guardar borrador/i }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Error de persistencia");
	});

	it("en factura emitida ofrece Cerrar e Imprimir y deshabilita campos", () => {
		const settings = minimalAppSettings();
		const factura: Factura = {
			id: "f-99",
			estado: "emitida",
			serie: "F",
			numero: 15,
			clienteNombre: "Cliente X",
			clienteDocumentoTipo: "CC",
			clienteDocumentoNumero: "1",
			subtotal: 100,
			impuestoTotal: 19,
			total: 119,
			notas: "",
			citaId: null,
			fechaEmision: "2020-01-01",
			anulacionMotivo: null,
			anuladaAt: null,
			createdAt: "",
			updatedAt: "",
			lineas: [lineaEmitida()],
		};
		render(<FacturaEditor settings={settings} factura={factura} onClose={() => {}} />);
		expect(screen.getByRole("heading", { name: /Factura F-15/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Imprimir" })).toBeInTheDocument();
		const nombre = screen.getByDisplayValue("Cliente X");
		expect(nombre).toBeDisabled();
	});

	it("omite crear ingreso en emitirFactura si el usuario desmarca la casilla", async () => {
		const user = userEvent.setup();
		const settings = minimalAppSettings();
		const draft: Factura = {
			id: "f-borr",
			estado: "borrador",
			serie: "F",
			numero: null,
			clienteNombre: "Y",
			clienteDocumentoTipo: "CC",
			clienteDocumentoNumero: "9",
			subtotal: 0,
			impuestoTotal: 0,
			total: 0,
			notas: "",
			citaId: null,
			fechaEmision: null,
			anulacionMotivo: null,
			anuladaAt: null,
			createdAt: "",
			updatedAt: "",
			lineas: [lineaEmitida({ descripcion: "Servicio A", precioUnitario: 10_000 })],
		};
		const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
		render(<FacturaEditor settings={settings} factura={draft} onClose={() => {}} />);
		await user.click(screen.getByRole("checkbox", { name: /Registrar pago al emitir/i }));
		await user.click(screen.getByRole("button", { name: /Emitir factura/i }));
		await waitFor(() => expect(api.emitirFactura).toHaveBeenCalled());
		expect(api.emitirFactura).toHaveBeenCalledWith(
			expect.objectContaining({ crearIngreso: false }),
		);
		const ingresoDispatches = dispatch.mock.calls.filter(
			(c) => c[0] instanceof CustomEvent && c[0].type === INGRESO_REGISTRADO_EVENT,
		);
		expect(ingresoDispatches.length).toBe(0);
		dispatch.mockRestore();
	});
});
