import { expect, test } from "@playwright/test";

test.describe("arranque sin contraseña de inicio (mock e2e)", () => {
	test("muestra la barra principal y el calendario", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("button", { name: "Calendario" })).toBeVisible();
		await expect(page.getByRole("navigation")).toContainText("Reportes");
		await expect(page.getByLabel(/Calendario semanal de citas/i)).toBeVisible();
	});
});
