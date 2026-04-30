import { expect, test } from "@playwright/test";

test.describe("módulo Reportes", () => {
	test("navega a una subpestaña y muestra el panel principal", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("button", { name: /Reportes/i }).click();
		await page.getByRole("button", { name: "Estadísticas" }).click();
		await expect(
			page.getByRole("heading", { name: "Reportes y Estadísticas" }),
		).toBeVisible();
	});
});
