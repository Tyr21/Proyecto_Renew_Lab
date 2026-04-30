import { expect, test } from "@playwright/test";

/** Debe coincidir con `E2E_STARTUP_PASSWORD` en `src/core/e2eInvokeMock.ts` */
const E2E_STARTUP_PASSWORD = "e2e-secret";

test.describe("contraseña de inicio (flag vía addInitScript)", () => {
	test("pide contraseña y entra al calendario con la clave de prueba", async ({ page }) => {
		await page.addInitScript(() => {
			window.__E2E_HAS_STARTUP_PASSWORD__ = true;
		});
		await page.goto("/");
		await expect(page.getByRole("heading", { name: /Consultorio Renew Lab/i })).toBeVisible();
		await page.getByLabel(/Contraseña/i).fill(E2E_STARTUP_PASSWORD);
		await page.getByRole("button", { name: "Entrar" }).click();
		await expect(page.getByRole("button", { name: "Calendario" })).toBeVisible();
		await expect(page.getByLabel(/Calendario semanal de citas/i)).toBeVisible();
	});
});
