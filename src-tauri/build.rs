fn main() {
	// Sin esto, Cargo puede no reejecutar tauri-build al sustituir solo los PNG/ICO y el .exe
	// en Windows sigue enlazando el icono antiguo (p. ej. logo por defecto de Tauri).
	for path in [
		"tauri.conf.json",
		"icons/icon.ico",
		"icons/icon.icns",
		"icons/32x32.png",
		"icons/64x64.png",
		"icons/128x128.png",
		"icons/128x128@2x.png",
		"icons/icon.png",
		"icons/app-icon-source.png",
	] {
		println!("cargo:rerun-if-changed={path}");
	}
	tauri_build::build()
}
