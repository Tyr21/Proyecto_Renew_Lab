# Laboratorio: probar actualizaciones (paso a paso)

Vocabulario mínimo: [PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md](./PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md).

- **Manifiesto** = archivo `docs/releases/latest.lab-demo.json` en GitHub (aviso con versión y enlace al `.exe`).
- **Instalador** = tu `Consultorio Renew Lab_x.y.z_x64-setup.exe` (debe tener **otra** URL HTTPS, p. ej. adjunto de un **Release**).

El repositorio debe ser **público** (o la URL raw del JSON debe abrirse **sin login** en incógnito).

---

## Checklist — Ya tienes la **0.1.0** instalada en el PC de prueba

Haz todo en el **PC donde compilas** salvo el último bloque.

1. **Sube versión del proyecto a 0.1.1** (debe coincidir con el instalador que vas a generar):

   ```powershell
   cd carpeta-del-repo
   npm run version:bump -- 0.1.1
   npm run release:check
   ```

2. **Genera el instalador de laboratorio** (tarda unos minutos):

   ```powershell
   npm run release:build:win:lab
   ```

   El `.exe` queda en: `src-tauri\target\release\bundle\nsis\Consultorio Renew Lab_0.1.1_x64-setup.exe`

3. **Publica solo ese `.exe`** en GitHub con HTTPS. Lo más simple: **Releases → New release** → adjunta el archivo → **Publish** → copia el **enlace directo** del `.exe` (clic derecho en el nombre del archivo → copiar dirección).  
   *No hace falta la carpeta `docs/releases/lab/` si usas Releases.*

4. **Regenera el manifiesto** (sigue con `package.json` en **0.1.1**):

   ```powershell
   npm run release:write-manifest -- --url "PEGA_AQUI_URL_DEL_EXE_0.1.1" --out docs/releases/latest.lab-demo.json --notes "Lab 0.1.1"
   ```

5. **Sube el JSON** a GitHub:

   ```text
   git add docs/releases/latest.lab-demo.json
   git commit -m "chore(lab): manifiesto 0.1.1"
   git push
   ```

6. **Comprueba** en el navegador **incógnito** la URL **raw** del JSON, por ejemplo:  
   `https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/docs/releases/latest.lab-demo.json`  
   Debe verse texto con `"version": "0.1.1"` y una `url` que sea la de tu `.exe`. Si sale 404 o HTML, la app fallará.

7. En el **PC de prueba** (con la app **0.1.0**): abre la aplicación → **Configuración → Actualizaciones → Buscar actualizaciones**.

8. Debe anunciar **0.1.1** → **Descargar e instalar** y completar el asistente.

**Si no ofrece actualización:** abre el JSON en incógnito y confirma que `version` es **0.1.1** (mayor que **0.1.0**). Espera unos segundos tras el `push` por si GitHub tarda en servir el archivo.

---

## Primera vez (solo si aún no hiciste laboratorio)

En el PC de desarrollo, **una vez**:

```powershell
npm run updater:lab:init
npm run version:bump -- 0.1.0
npm run release:build:win:lab
```

Publica el `.exe` **0.1.0** (Release o repo), luego:

```powershell
npm run release:write-manifest -- --url "URL_DEL_EXE_0.1.0" --out docs/releases/latest.lab-demo.json --notes "Lab 0.1.0"
git add docs/releases/latest.lab-demo.json
git commit -m "chore(lab): manifiesto 0.1.0"
git push
```

Instala ese **0.1.0** en el PC de prueba. **No** subas el archivo `.updater-lab-demo` a Git.

Si tu repo no es `Tyr21/Proyecto_Renew_Lab`, **antes** de `updater:lab:init`:

```powershell
$env:UPDATER_LAB_MANIFEST_URL = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/docs/releases/latest.lab-demo.json"
npm run updater:lab:init
```

---

## Si algo falla

| Síntoma | Qué mirar |
|--------|------------|
| *Could not fetch a valid release JSON* | Abre la URL **raw** del JSON en **incógnito**: debe ser texto JSON, no 404 ni pedir login. Repo privado suele bloquear esto. |
| No aparece la 0.1.1 | En el JSON, `version` debe ser **estrictamente mayor** que la instalada (0.1.0). Comprueba que hiciste `push` del `latest.lab-demo.json` **después** de `write-manifest`. |
| Error al instalar la actualización | La `url` del JSON debe descargar **exactamente** el `.exe` firmado con la misma clave de laboratorio (mismo `release:build:win:lab` / mismo `.sig`). |

---

## Comandos útiles

| Qué | Comando |
|-----|---------|
| Claves + config lab (una vez) | `npm run updater:lab:init` |
| Compilar instalador + `.sig` | `npm run release:build:win:lab` |
| Escribir el manifiesto | `npm run release:write-manifest -- --url "https://…" --out docs/releases/latest.lab-demo.json` |

Publicación real (no lab): [RELEASE_QUICKSTART.md](./RELEASE_QUICKSTART.md).

Carpeta opcional para colgar el `.exe` en el repo: [releases/lab/README.md](./releases/lab/README.md).