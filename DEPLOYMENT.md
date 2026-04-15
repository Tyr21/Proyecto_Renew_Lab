# Guía de Despliegue

## Antes de cada build: etiquetar la versión en git

```bash
# 1. Guardar todos los cambios
git add .
git commit -m "versión X.X.X lista para producción"

# 2. Crear la etiqueta
git tag vX.X.X

# 3. Subir la etiqueta a GitHub (si aplica)
git push origin vX.X.X
```

**Convención de versiones:**
- `v1.0.1` → corrección de bug pequeño
- `v1.1.0` → nueva función
- `v2.0.0` → cambio grande

---

## Generar el instalador

```bash
npm run tauri build
```

El instalador queda en:
```
src-tauri/target/release/bundle/
```

Comparte ese archivo `.exe` (Windows) o `.dmg` (Mac) con quienes necesiten instalar la app.

---

## Si algo sale mal: volver a una versión anterior

```bash
# Ver el historial de etiquetas
git tag

# Volver a una versión específica
git checkout v1.0.0

# Generar el instalador de esa versión
npm run tauri build
```

---

## Sacar una nueva versión

1. Hacer los cambios en el código
2. Actualizar el número de versión en:
   - `package.json` → línea `"version"`
   - `src-tauri/tauri.conf.json` → línea `"version"`
3. Etiquetar en git (ver arriba)
4. Correr `npm run tauri build`
5. Distribuir el nuevo instalador
