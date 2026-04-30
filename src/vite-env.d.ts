/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Activado por Playwright: las llamadas Tauri pasan por `e2eInvokeMock` (sin IPC real). */
	readonly VITE_E2E_MOCK_TAURI?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
