import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../core/api";
import type { BackupFileInfo } from "../../core/types";
import { BackupRestoreSection } from "./BackupRestoreSection";

vi.mock("@tauri-apps/plugin-dialog", () => ({
	open: vi.fn(),
}));

vi.mock("../../core/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../core/api")>();
	return {
		...actual,
		listarRespaldosLocales: vi.fn(),
		restaurarRespaldo: vi.fn(),
	};
});

function sampleBackup(): BackupFileInfo {
	return {
		name: "consultorio_prueba.db",
		fullPath: "C:\\respaldos\\consultorio_prueba.db",
		sizeBytes: 4096,
		modifiedAtIso: "2026-01-01T12:00:00.000Z",
	};
}

describe("BackupRestoreSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.listarRespaldosLocales).mockResolvedValue([]);
		vi.mocked(api.restaurarRespaldo).mockResolvedValue(undefined);
	});

	it("sin modo admin muestra aviso y deshabilita acciones destructivas", async () => {
		vi.mocked(api.listarRespaldosLocales).mockResolvedValue([sampleBackup()]);
		render(<BackupRestoreSection adminModeActive={false} />);
		expect(
			screen.getByText(/Active primero el modo administrador/i),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Elegir archivo externo/i })).toBeDisabled();
		await waitFor(() => expect(api.listarRespaldosLocales).toHaveBeenCalled());
		const restoreItemBtn = await screen.findByRole("button", {
			name: /Restaurar este respaldo/i,
		});
		expect(restoreItemBtn).toBeDisabled();
	});

	it("si falla el listado, muestra mensaje de error", async () => {
		vi.mocked(api.listarRespaldosLocales).mockRejectedValueOnce(new Error("acceso denegado"));
		render(<BackupRestoreSection adminModeActive />);
		expect(await screen.findByText(/acceso denegado/i)).toBeInTheDocument();
	});

	it("rechaza archivo externo con nombre que no parece respaldo", async () => {
		const user = userEvent.setup();
		vi.mocked(openFileDialog).mockResolvedValueOnce("D:\\copias\\otro.sqlite");
		render(<BackupRestoreSection adminModeActive />);
		await user.click(screen.getByRole("button", { name: /Elegir archivo externo/i }));
		expect(
			await screen.findByText(/no parece un respaldo válido/i),
		).toBeInTheDocument();
		expect(api.restaurarRespaldo).not.toHaveBeenCalled();
	});

	it("exige contraseña de administrador antes de restaurar", async () => {
		const user = userEvent.setup();
		vi.mocked(api.listarRespaldosLocales).mockResolvedValue([sampleBackup()]);
		render(<BackupRestoreSection adminModeActive />);
		await user.click(
			await screen.findByRole("button", { name: /Restaurar este respaldo/i }),
		);
		expect(screen.getByRole("heading", { name: /Confirmar restauración/i })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /^Restaurar respaldo$/i }));
		expect(screen.getByText(/Indique la contraseña de administrador/i)).toBeInTheDocument();
		expect(api.restaurarRespaldo).not.toHaveBeenCalled();
	});

	it("muestra error devuelto por restaurarRespaldo", async () => {
		const user = userEvent.setup();
		vi.mocked(api.listarRespaldosLocales).mockResolvedValue([sampleBackup()]);
		vi.mocked(api.restaurarRespaldo).mockRejectedValueOnce(new Error("Contraseña incorrecta"));
		render(<BackupRestoreSection adminModeActive />);
		await user.click(
			await screen.findByRole("button", { name: /Restaurar este respaldo/i }),
		);
		await user.type(screen.getByLabelText(/Contraseña de administrador/i), "secreta");
		await user.click(screen.getByRole("button", { name: /^Restaurar respaldo$/i }));
		expect(await screen.findByText(/Contraseña incorrecta/i)).toBeInTheDocument();
	});

	it("tras lista vacía muestra texto orientativo", async () => {
		render(<BackupRestoreSection adminModeActive />);
		expect(
			await screen.findByText(/Sin respaldos locales/i),
		).toBeInTheDocument();
	});
});
