#!/usr/bin/env node
// Laboratorio updater: genera claves minisign locales y src-tauri/tauri.updater-lab.json (no subir la privada a git).
//
// Uso:
//   npm run updater:lab:init
//
// URL HTTPS del manifiesto (debe existir cuando pruebes la app empaquetada). Por defecto: raw de este repo en main.
//   set UPDATER_LAB_MANIFEST_URL=https://gist.githubusercontent.com/.../raw/.../latest.json&& npm run updater:lab:init
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const TAURI_DIR = resolve(REPO_ROOT, "src-tauri");
const KEY_BASE = resolve(TAURI_DIR, ".updater-lab-demo");
const MERGE_OUT = resolve(TAURI_DIR, "tauri.updater-lab.json");

const DEFAULT_MANIFEST_URL =
	process.env.UPDATER_LAB_MANIFEST_URL ||
	"https://raw.githubusercontent.com/Tyr21/Proyecto_Renew_Lab/main/docs/releases/latest.lab-demo.json";

function fail(message) {
	console.error(`[updater:lab:init] ${message}`);
	process.exit(1);
}

async function main() {
	process.env.CI = "true";
	const gen = spawnSync(
		"npx",
		["--yes", "tauri", "signer", "generate", "-w", KEY_BASE, "-f"],
		{
			cwd: TAURI_DIR,
			shell: true,
			stdio: "inherit",
			env: { ...process.env, CI: "true" },
		},
	);
	if (gen.status !== 0) {
		fail("Fallo al generar claves (tauri signer generate).");
	}

	const pubPath = `${KEY_BASE}.pub`;
	let pubkey;
	try {
		pubkey = (await readFile(pubPath, "utf8")).trim();
	} catch {
		fail(`No se encontró la clave pública en ${pubPath}.`);
	}
	if (!pubkey) {
		fail("Clave pública vacía.");
	}

	const merge = {
		bundle: {
			createUpdaterArtifacts: true,
		},
		plugins: {
			updater: {
				pubkey,
				endpoints: [DEFAULT_MANIFEST_URL],
			},
		},
	};

	await writeFile(MERGE_OUT, `${JSON.stringify(merge, null, "\t")}\n`, "utf8");

	console.log(`[updater:lab:init] Clave privada (no commitear): ${KEY_BASE}`);
	console.log(`[updater:lab:init] Merge de build: ${MERGE_OUT}`);
	console.log(`[updater:lab:init] Manifiesto configurado en: ${DEFAULT_MANIFEST_URL}`);
	console.log(
		"[updater:lab:init] Si forkaste el repo, ejecuta de nuevo con UPDATER_LAB_MANIFEST_URL apuntando a tu raw JSON.",
	);
	console.log("[updater:lab:init] Siguiente: npm run release:build:win:lab");
}

await main();

