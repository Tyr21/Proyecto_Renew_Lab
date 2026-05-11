# Publicar una nueva versión (guía breve)

> **¿Empiezas desde cero?** Lee primero [PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md](./PRINCIPIANTES_VERSIONES_Y_ACTUALIZACIONES.md). Para **solo practicar** sin miedo, usa [UPDATER_LAB_PASO_A_PASO.md](./UPDATER_LAB_PASO_A_PASO.md).

---

## Día a día mientras programas

- Enciendes el proyecto como siempre: `npm run tauri dev` (en Windows a veces `npm run tauri:dev:win`).
- **No** hace falta generar instalador cada día. Solo cuando quieras **repartir** una versión nueva.

---

## Qué significa “publicar una actualización” (en una frase)

Tú generas un **nuevo instalador** (`.exe`), lo **subes** a una dirección HTTPS pública, y actualizas un **archivo aviso** (`docs/releases/latest.json`) para que las apps antiguas se enteren. La app del consultorio ya tiene guardada la dirección de ese aviso.

Detalle técnico (claves, firma, GitHub Actions): [UPDATES.md](./UPDATES.md).

---

## Antes de publicar de verdad (una sola vez en la vida del proyecto)

Hace falta un **par de llaves criptográficas**: una pública (ya va en el código del proyecto) y una privada (solo en sitios seguros, por ejemplo el **secreto** de GitHub Actions). Sin la privada correcta, el instalador nuevo **no** será aceptado por el mecanismo de actualización.

Si alguien ya configuró el repositorio, **no tienes que repetir esto**. Si eres tú el primero, sigue [UPDATES.md](./UPDATES.md), sección *Clave pública y secreto de firma*.

---

## Checklist cada vez que saques una versión nueva (producción)

Hazlo con calma y en este orden.

1. **Cierra el trabajo** en el código: lo que quieras incluir ya está guardado en la rama habitual (`main` o la que uséis).

2. **Sube el número de versión** (por ejemplo de 0.1.0 a 0.1.1):

   ```bash
   npm run version:bump -- 0.1.1
   ```

   (Cambia `0.1.1` por el número que toque.)

3. **Actualiza el historial de cambios** en `CHANGELOG.md` (si en tu equipo lo usáis) y ejecuta:

   ```bash
   npm run release:check
   ```

4. **Guarda en Git** los cambios (versión + changelog + lo que sea) con un commit claro.

5. **Genera los instaladores oficiales** de una de estas dos maneras:

   - **Recomendado — automatizado:** etiqueta el commit con `v0.1.1`, sube la etiqueta a GitHub (`git tag v0.1.1`, luego `git push --tags`). El sistema del repositorio construye los `.exe` / `.msi` y los archivos de firma si está bien configurado.

   - **En tu PC:** sigue las instrucciones de [UPDATES.md](./UPDATES.md) y del README para poner la **clave privada** en el entorno y ejecutar `npm run release:build:win`.

6. **Sube el instalador** que usarán los Windows (el `.exe` tipo instalador que suele ir en `bundle\nsis\`) a un lugar con **HTTPS** (por ejemplo como archivo de un **Release** en GitHub). Copia la **dirección de descarga directa** del archivo.

7. **Actualiza el archivo aviso** en el proyecto (con la misma versión en `package.json` que acabas de publicar):

   ```bash
   npm run release:write-manifest -- --url "PEGA_AQUI_LA_URL_DEL_EXE" --notes "Breve texto para quien lea el aviso"
   ```

   Eso rellena `docs/releases/latest.json` con la versión, la URL y la firma que necesita el programa.

8. **Vuelve a subir** `docs/releases/latest.json` a la rama que la aplicación ya escucha (la que figura en la configuración de Tauri; por defecto suele ser `main`).

Listo: en los equipos con una versión **menor**, al ir a **Configuración → Actualizaciones → Buscar actualizaciones**, deberían ver la nueva.

---

## Comandos que quizá copies y pegues

| Comando | Para qué sirve |
|---------|----------------|
| `npm run release:build:win` | En tu PC, construye instalador **y** ficheros `.sig` si tienes la clave privada en el entorno. |
| `npm run release:write-manifest` | Vuelve a escribir `docs/releases/latest.json` a partir de la `--url` del `.exe`. |

---

## Práctica sin riesgo (laboratorio)

Mismas ideas, pero con llaves y JSON **solo de prueba**: [UPDATER_LAB_PASO_A_PASO.md](./UPDATER_LAB_PASO_A_PASO.md). Comandos típicos: `npm run updater:lab:init`, `npm run release:build:win:lab`.

---

## Si algo no encaja

- El número del aviso (`latest.json`) debe ser **mayor** que el que tiene instalado el equipo.
- La dirección del `.exe` debe abrirse en el navegador y **bajar el archivo**, sin pedir usuario y contraseña raros.
- La firma y la llave pública deben ser **la pareja** usada al generar ese instalador.

Más matices: [UPDATES.md](./UPDATES.md).
