#!/usr/bin/env node
// Sincroniza la versión del producto entre `package.json` y `src-tauri/Cargo.toml`.
//
// `src-tauri/tauri.conf.json` no se toca: ya delega su `version` a `../package.json`
// usando la feature nativa de Tauri 2.
//
// Uso:
//   npm run version:bump -- 0.2.0
//   npm run version:bump -- 1.0.0-rc.1
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PACKAGE_JSON = resolve(REPO_ROOT, "package.json");
const CARGO_TOML = resolve(REPO_ROOT, "src-tauri", "Cargo.toml");

// SemVer mínimo: MAJOR.MINOR.PATCH con pre-release opcional (-rc.1, -beta.2, etc.).
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function fail(message) {
	console.error(`[version:bump] ${message}`);
	process.exit(1);
}

async function bumpPackageJson(newVersion) {
	const original = await readFile(PACKAGE_JSON, "utf8");
	const detectedEol = original.includes("\r\n") ? "\r\n" : "\n";
	const trailingNewline = original.endsWith(detectedEol) ? detectedEol : "";

	const data = JSON.parse(original);
	const previous = data.version;
	if (previous === newVersion) {
		return { previous, changed: false };
	}
	data.version = newVersion;

	const serialized = JSON.stringify(data, null, "\t").replace(/\n/g, detectedEol);
	await writeFile(PACKAGE_JSON, serialized + trailingNewline, "utf8");
	return { previous, changed: true };
}

async function bumpCargoToml(newVersion) {
	const original = await readFile(CARGO_TOML, "utf8");

	// Reescribimos solo la línea `version = "..."` que aparece dentro del
	// bloque `[package]` inicial; las dependencias declaran `version` como
	// parte de tablas inline (`tauri = { version = "2", ... }`) y no deben
	// tocarse. Aprovechamos que `[package]` es la primera tabla del archivo.
	const packageHeaderRe = /^\[package\][^[]*/m;
	const packageBlockMatch = original.match(packageHeaderRe);
	if (!packageBlockMatch) {
		fail(`No se encontró el bloque [package] en ${CARGO_TOML}.`);
	}
	const packageBlock = packageBlockMatch[0];

	const versionLineRe = /^version\s*=\s*"([^"]+)"\s*$/m;
	const versionMatch = packageBlock.match(versionLineRe);
	if (!versionMatch) {
		fail(`No se encontró la línea version = "..." dentro de [package] en ${CARGO_TOML}.`);
	}
	const previous = versionMatch[1];
	if (previous === newVersion) {
		return { previous, changed: false };
	}

	const newPackageBlock = packageBlock.replace(versionLineRe, `version = "${newVersion}"`);
	const updated = original.replace(packageBlock, newPackageBlock);
	await writeFile(CARGO_TOML, updated, "utf8");
	return { previous, changed: true };
}

async function main() {
	const [, , rawVersion] = process.argv;
	if (!rawVersion) {
		fail("Falta el argumento de versión. Uso: npm run version:bump -- <semver> (ej. 0.2.0).");
	}
	const newVersion = rawVersion.trim().replace(/^v/, "");
	if (!SEMVER_RE.test(newVersion)) {
		fail(`Versión inválida: "${rawVersion}". Se espera SemVer (ej. 0.2.0, 1.0.0-rc.1).`);
	}

	const pkg = await bumpPackageJson(newVersion);
	const cargo = await bumpCargoToml(newVersion);

	const lines = [
		`package.json:        ${pkg.previous} -> ${newVersion}${pkg.changed ? "" : " (sin cambio)"}`,
		`src-tauri/Cargo.toml: ${cargo.previous} -> ${newVersion}${cargo.changed ? "" : " (sin cambio)"}`,
		`src-tauri/tauri.conf.json: delega a ../package.json (sin tocar)`,
	];
	console.log(`[version:bump] versión ${newVersion}`);
	for (const line of lines) console.log(`  ${line}`);
	console.log(
		"[version:bump] Recuerda actualizar CHANGELOG.md y luego correr `npm run release:check`.",
	);
}

await main();
