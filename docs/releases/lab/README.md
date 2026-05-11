# Carpeta opcional: instaladores del laboratorio (updater)

**Esta carpeta no existe en el repositorio por defecto.** Solo aparece si **tú** la creas.

## ¿Para qué sirve?

Si en la guía [UPDATER_LAB_PASO_A_PASO.md](../UPDATER_LAB_PASO_A_PASO.md) eliges **colgar el `.exe` dentro del mismo repo** (en lugar de usar un *GitHub Release* con archivo adjunto), puedes poner aquí, por ejemplo:

`Consultorio Renew Lab_0.1.0_x64-setup.exe`

Luego haces `git add`, `commit` y `push`. La URL de descarga será del estilo:

`https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/docs/releases/lab/NombreDelArchivo.exe`

(los espacios del nombre suelen ir como `%20` en el enlace).

## ¿Es obligatoria?

**No.** Muchas veces es más simple subir el instalador como **adjunto de un Release** en GitHub y copiar el enlace del archivo: así **no** hace falta esta carpeta ni meter el `.exe` en el historial de git.

## Contenido en git

No hace falta versionar los `.exe` en esta carpeta si preferís solo usar Releases; entonces esta carpeta puede quedar vacía o no existir.
