import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "list",
	use: {
		// En Windows, Vite con `host: false` suele escuchar solo en `localhost` (::1), no en 127.0.0.1.
		baseURL: "http://localhost:1420",
		trace: "on-first-retry",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "npm run dev",
		url: "http://localhost:1420",
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: {
			VITE_E2E_MOCK_TAURI: "true",
		},
	},
});
