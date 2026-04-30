import { expect, test } from "@playwright/test";

test.describe("nueva cita", () => {
	test("abre el modal desde un hueco y guarda con validación correcta", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByLabel(/Calendario semanal de citas/i)).toBeVisible();

		const nuevaCita = page.getByRole("button", { name: /^Nueva cita el / }).first();
		await nuevaCita.click();

		const modal = page.getByRole("dialog", { name: /Nueva cita/i });
		await expect(modal).toBeVisible();
		// El campo nombre no tiene `<label>` asociado; el primer textbox del modal es nombre completo.
		await modal.getByRole("textbox").first().fill("Ana María López Soto");
		await modal.getByLabel(/Número documento/i).fill("1234567890");
		await modal.getByLabel(/Teléfono \(solo número local\)/i).fill("3001234567");
		await modal.getByRole("button", { name: "Guardar" }).click();
		await expect(modal).toBeHidden();
	});
});
