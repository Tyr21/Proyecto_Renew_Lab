import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../core/api";
import type { Appointment } from "../../core/types";
import { appointmentFixture } from "../../test/fixtures/appointments";
import { minimalAppSettings } from "../../test/fixtures/appSettings";
import { AppointmentModal } from "./AppointmentModal";

vi.mock("../../core/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../core/api")>();
	return {
		...actual,
		buscarClientes: vi.fn().mockResolvedValue([]),
		crearCliente: vi.fn().mockResolvedValue(undefined),
		listarPaquetesCliente: vi.fn().mockResolvedValue([]),
		createAppointment: vi.fn().mockResolvedValue({ id: "new" } as Appointment),
		updateAppointment: vi.fn(),
		deleteAppointment: vi.fn(),
		actualizarCliente: vi.fn(),
	};
});

describe("AppointmentModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("muestra error de validación al enviar sin datos obligatorios", async () => {
		const settings = minimalAppSettings();
		render(
			<AppointmentModal
				open
				settings={settings}
				weekAppointments={[]}
				mode="create"
				initial={null}
				preset={null}
				onClose={() => {}}
				onSaved={() => {}}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		const form = dialog.querySelector("form");
		expect(form).toBeTruthy();
		fireEvent.submit(form!);
		expect(await screen.findByRole("alert")).toHaveTextContent("El nombre completo es obligatorio");
		expect(api.createAppointment).not.toHaveBeenCalled();
	});

	it("bloquea el guardado cuando el cupo concurrente ya está lleno", async () => {
		const user = userEvent.setup();
		const settings = minimalAppSettings({
			serviceTypes: [
				{
					id: "svc_a",
					label: "Servicio A",
					concurrentCapacity: 1,
					suggestedPrice: 10_000,
				},
			],
		});
		const weekAppointments = [
			appointmentFixture({
				id: "ocupado",
				appointmentDate: "2099-06-01",
				startTime: "09:00",
				endTime: "10:00",
				serviceType: "svc_a",
			}),
		];
		render(
			<AppointmentModal
				open
				settings={settings}
				weekAppointments={weekAppointments}
				mode="create"
				initial={null}
				preset={{ date: "2099-06-01", startTime: "09:00" }}
				onClose={() => {}}
				onSaved={() => {}}
			/>,
		);

		await user.type(screen.getByText("Nombre completo").querySelector("input")!, "María Pérez García");
		await user.type(screen.getByLabelText(/Número documento/i), "1234567890");
		await user.type(screen.getByLabelText(/Teléfono \(solo número local\)/i), "3001234567");

		await user.selectOptions(screen.getByRole("combobox", { name: /^Inicio$/i }), "09:00");
		await user.selectOptions(screen.getByRole("combobox", { name: /^Fin$/i }), "10:00");

		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/Capacidad superada/);
		expect(api.createAppointment).not.toHaveBeenCalled();
	});

	it("muestra aviso de ocupación cuando no hay cupo adicional en la franja", () => {
		const settings = minimalAppSettings({
			serviceTypes: [
				{
					id: "svc_a",
					label: "Servicio A",
					concurrentCapacity: 1,
					suggestedPrice: 10_000,
				},
			],
		});
		const weekAppointments = [
			appointmentFixture({
				id: "x",
				appointmentDate: "2099-06-01",
				startTime: "09:00",
				endTime: "10:00",
				serviceType: "svc_a",
			}),
		];
		render(
			<AppointmentModal
				open
				settings={settings}
				weekAppointments={weekAppointments}
				mode="create"
				initial={null}
				preset={{ date: "2099-06-01", startTime: "09:00" }}
				onClose={() => {}}
				onSaved={() => {}}
			/>,
		);
		expect(
			screen.getByText(/No hay cupo adicional en esta franja/i),
		).toBeInTheDocument();
	});

	it("en cita pasada con pago, informa bloqueo y evita cambiar asistencia", async () => {
		const settings = minimalAppSettings();
		const initial = appointmentFixture({
			appointmentDate: "2020-05-10",
			startTime: "08:00",
			endTime: "09:00",
			isPaid: true,
			status: "asistio",
		});
		render(
			<AppointmentModal
				open
				settings={settings}
				weekAppointments={[]}
				mode="edit"
				initial={initial}
				preset={null}
				onClose={() => {}}
				onSaved={() => {}}
			/>,
		);
		expect(
			screen.getByText(/Esta cita tiene un pago registrado/i),
		).toBeInTheDocument();
		const asistencia = screen.getByRole("combobox", { name: /^Asistencia$/i });
		expect(asistencia).toBeDisabled();
	});

	it("crea la cita cuando el formulario es válido y hay cupo", async () => {
		const user = userEvent.setup();
		const settings = minimalAppSettings();
		render(
			<AppointmentModal
				open
				settings={settings}
				weekAppointments={[]}
				mode="create"
				initial={null}
				preset={{ date: "2099-08-15", startTime: "10:00" }}
				onClose={() => {}}
				onSaved={() => {}}
			/>,
		);
		await user.type(screen.getByText("Nombre completo").querySelector("input")!, "Ana Gómez López");
		await user.type(screen.getByLabelText(/Número documento/i), "9876543210");
		await user.type(screen.getByLabelText(/Teléfono \(solo número local\)/i), "3009990000");
		await user.click(screen.getByRole("button", { name: "Guardar" }));
		await waitFor(() => expect(api.createAppointment).toHaveBeenCalledTimes(1));
	});
});
