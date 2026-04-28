#!/usr/bin/env node
// Valida que la versión del producto sea coherente entre los tres archivos
// donde puede aparecer:
//
//   - package.json (fuente de verdad)
//   - src-tauri/tauri.conf.json (debe delegar literalmente a "../package.json"
//     o, si excepcionalmente lleva una versión literal, debe coincidir)
//   - src-tauri/Cargo.toml (sincronizado vía `npm run version:bump`)
//
// Falla con código 1 si hay desincronización; imprime un resumen claro en CI.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PACKAGE_JSON = resolve(REPO_ROOT, "package.json");
const TAURI_CONF = resolve(REPO_ROOT, "src-tauri", "tauri.conf.json");
const CARGO_TOML = resolve(REPO_ROOT, "src-tauri", "Cargo.toml");

const TAURI_DELEGATE_LITERAL = "../package.json";

async function readPackageVersion() {
	const data = JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
	if (typeof data.version !== "string" || data.version.length === 0) {
		throw new Error(`package.json no tiene un campo "version" válido.`);
	}
	return data.version;
}

async function readTauriConfVersion() {
	const data = JSON.parse(await readFile(TAURI_CONF, "utf8"));
	if (typeof data.version !== "string" || data.version.length === 0) {
		throw new Error(`tauri.conf.json no tiene un campo "version" válido.`);
	}
	return data.version;
}

async function readCargoTomlVersion() {
	const text = await readFile(CARGO_TOML, "utf8");
	const packageBlockMatch = text.match(/^\[package\][^[]*/m);
	if (!packageBlockMatch) {
		throw new Error(`No se encontró el bloque [package] en src-tauri/Cargo.toml.`);
	}
	const versionMatch = packageBlockMatch[0].match(/^version\s*=\s*"([^"]+)"\s*$/m);
	if (!versionMatch) {
		throw new Error(`No se encontró version = "..." en [package] de src-tauri/Cargo.toml.`);
	}
	return versionMatch[1];
}

async function main() {
	const [pkgVersion, tauriRaw, cargoVersion] = await Promise.all([
		readPackageVersion(),
		readTauriConfVersion(),
		readCargoTomlVersion(),
	]);

	const tauriDelegates = tauriRaw === TAURI_DELEGATE_LITERAL;
	const tauriEffective = tauriDelegates ? pkgVersion : tauriRaw;

	const errors = [];
	if (!tauriDelegates && tauriRaw !== pkgVersion) {
		errors.push(
			`tauri.conf.json.version = "${tauriRaw}" pero package.json.version = "${pkgVersion}". ` +
				`Recomendado: dejar "version": "${TAURI_DELEGATE_LITERAL}" para que Tauri lea de package.json.`,
		);
	}
	if (cargoVersion !== pkgVersion) {
		errors.push(
			`src-tauri/Cargo.toml [package].version = "${cargoVersion}" pero package.json.version = "${pkgVersion}". ` +
				`Ejecuta \`npm run version:bump -- ${pkgVersion}\` para sincronizar.`,
		);
	}

	console.log("[release:check] Versiones detectadas:");
	console.log(`  package.json:              ${pkgVersion}`);
	console.log(
		`  src-tauri/tauri.conf.json: ${tauriRaw}` +
			(tauriDelegates ? `  (delegado a package.json -> ${tauriEffective})` : ""),
	);
	console.log(`  src-tauri/Cargo.toml:      ${cargoVersion}`);

	if (errors.length > 0) {
		console.error("\n[release:check] FALLO: versiones inconsistentes.");
		for (const err of errors) console.error(`  - ${err}`);
		process.exit(1);
	}

	console.log("\n[release:check] OK: las tres versiones son coherentes.");
}

await main();
