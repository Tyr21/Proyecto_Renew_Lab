#!/usr/bin/env node
// Genera docs/releases/latest.json para el updater a partir de package.json y el .sig del NSIS.
//
// Uso:
//   npm run release:write-manifest -- --url "https://github.com/.../releases/download/v0.2.0/....exe"
//
// Opcional:
//   --sig ruta\al\archivo.sig
//   --notes "Texto para el campo notes"
//   --out docs/releases/latest.json
//   --pub-date 2026-05-01T15:00:00Z  (por defecto: ahora en UTC)
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PACKAGE_JSON = resolve(REPO_ROOT, "package.json");
const DEFAULT_OUT = resolve(REPO_ROOT, "docs", "releases", "latest.json");
const NSIS_DIR = resolve(REPO_ROOT, "src-tauri", "target", "release", "bundle", "nsis");

function fail(message) {
	console.error(`[release:write-manifest] ${message}`);
	process.exit(1);
}

function parseArgs(argv) {
	const out = { url: null, sig: null, notes: "", outPath: DEFAULT_OUT, pubDate: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--url" && argv[i + 1]) {
			out.url = argv[++i];
		} else if (a === "--sig" && argv[i + 1]) {
			out.sig = argv[++i];
		} else if (a === "--notes" && argv[i + 1]) {
			out.notes = argv[++i];
		} else if (a === "--out" && argv[i + 1]) {
			out.outPath = resolve(REPO_ROOT, argv[++i]);
		} else if (a === "--pub-date" && argv[i + 1]) {
			out.pubDate = argv[++i];
		} else if (a === "--help" || a === "-h") {
			console.log(`Uso: npm run release:write-manifest -- --url <https://...setup.exe> [--sig ruta.sig] [--notes "..."] [--out docs/releases/latest.json] [--pub-date ISO8601]`);
			process.exit(0);
		}
	}
	return out;
}

async function findDefaultSig(version) {
	let names;
	try {
		names = await readdir(NSIS_DIR);
	} catch {
		fail(`No existe la carpeta ${NSIS_DIR}. Ejecute antes npm run release:build:win (o el build de CI) con createUpdaterArtifacts.`);
	}
	const sigs = names.filter((n) => n.endsWith(".sig"));
	if (sigs.length === 0) {
		fail(`No hay archivos .sig en ${NSIS_DIR}.`);
	}
	const match = sigs.filter((n) => n.includes(version));
	if (match.length === 1) {
		return resolve(NSIS_DIR, match[0]);
	}
	if (match.length > 1) {
		fail(`Varios .sig coinciden con la versión ${version}: ${match.join(", ")}. Use --sig explícito.`);
	}
	if (sigs.length === 1) {
		return resolve(NSIS_DIR, sigs[0]);
	}
	fail(`Varios .sig en ${NSIS_DIR} y ninguno coincide claramente con ${version}. Use --sig ruta\\archivo.sig`);
}

async function main() {
	const args = parseArgs(process.argv);
	if (!args.url) {
		fail('Falta --url con la URL HTTPS directa al instalador NSIS (.exe). Ej.: npm run release:write-manifest -- --url "https://..."');
	}
	if (!/^https:\/\//i.test(args.url)) {
		fail("La URL debe ser HTTPS (requisito del updater).");
	}

	const pkg = JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
	const version = pkg.version;
	if (typeof version !== "string" || !version.length) {
		fail("package.json sin version válida.");
	}

	const sigPath = args.sig ? resolve(REPO_ROOT, args.sig) : await findDefaultSig(version);
	const signature = (await readFile(sigPath, "utf8")).trimEnd();

	const pubDate =
		args.pubDate ||
		new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

	const manifest = {
		version,
		notes: args.notes || `Versión ${version}.`,
		pub_date: pubDate,
		platforms: {
			"windows-x86_64": {
				signature,
				url: args.url,
			},
		},
	};

	const json = `${JSON.stringify(manifest, null, "\t")}\n`;
	await writeFile(args.outPath, json, "utf8");
	console.log(`[release:write-manifest] Escrito ${args.outPath}`);
	console.log(`[release:write-manifest] version=${version} sig=${sigPath}`);
}

await main();
