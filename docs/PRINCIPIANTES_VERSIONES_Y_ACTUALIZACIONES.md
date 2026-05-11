# Guía para principiantes: versiones, instalador y actualizaciones

Esta página es el **punto de partida** si estás empezando con desarrollo de aplicaciones, compilación o “poner en producción”. No asume que ya conoces Git, firmas ni servidores.

---

## ¿Para quién es esto?

- **Usuario del consultorio:** solo necesitas el manual de uso ([MANUAL_USUARIO.md](./MANUAL_USUARIO.md), secciones **7.7** y **12**).
- **Tú que construyes o repartes el programa** (aunque no seas programador experto): sigue leyendo aquí.

---

## Ideas clave (en lenguaje simple)

| Término | Qué es, en pocas palabras |
|--------|---------------------------|
| **Código fuente** | Los archivos del proyecto en tu carpeta (lo que abres en Cursor/Visual Studio Code). Todavía **no** es el programa que instala el consultorio. |
| **Compilar / generar el instalador** | Un proceso automático que “empaqueta” la app y crea un archivo **`.exe`** que sí puedes instalar en Windows (como cualquier instalador que descargas de internet). |
| **Versión** | Un número (por ejemplo **0.1.0**): indica qué “edición” del programa es. Cuando mejoras cosas, subes el número (por ejemplo **0.1.1**). |
| **Actualización desde la app** | La aplicación ya instalada **pregunta por internet** si hay una versión más nueva. Si la hay, descarga un instalador y te guía. Para eso hace falta un **aviso en internet** (un archivo JSON pequeño) y que el instalador nuevo esté **colgado en una dirección segura (HTTPS)**. |
| **Git / GitHub** | Herramientas para guardar el proyecto en la nube y compartir archivos de forma ordenada. **No** son obligatorias para instalar en **una** PC con un pendrive, pero **sí** suelen usarse para que la dirección del aviso (`latest.json`) sea pública y estable. |
| **Prueba de laboratorio** | Un camino **aparte** que no toca la configuración “seria” del proyecto. Sirve para **aprender** el flujo sin romper nada. Está explicado paso a paso en [UPDATER_LAB_PASO_A_PASO.md](./UPDATER_LAB_PASO_A_PASO.md). |
| **Producción** | El flujo **real** que usarán los consultorios: misma lógica que la prueba, pero con las claves y archivos oficiales del repositorio. Resumen en [RELEASE_QUICKSTART.md](./RELEASE_QUICKSTART.md). |

---

## ¿Qué hago primero?

1. **Solo quiero instalar el programa en otro ordenador con un pendrive**  
   Genera el instalador en tu PC (como ya hiciste con `npm run tauri build`), copia el **`.exe`** al pendrive y ejecútalo en el otro equipo. No hace falta actualización automática para eso.

2. **Quiero entender cómo funciona “Buscar actualizaciones” sin liarme**  
   Abre la guía **muy detallada y en tono tutorial**: [UPDATER_LAB_PASO_A_PASO.md](./UPDATER_LAB_PASO_A_PASO.md).

3. **Ya entiendo lo básico y quiero el checklist corto para publicar de verdad**  
   Usa [RELEASE_QUICKSTART.md](./RELEASE_QUICKSTART.md).

4. **Necesito el detalle técnico (claves, manifiesto, CI)**  
   [UPDATES.md](./UPDATES.md).

---

## Mensaje que conviene recordar

La aplicación del consultorio **sigue siendo local**: la base de datos está en el equipo. Las actualizaciones solo **sustituyen el programa** cuando tú publicas una versión nueva y el equipo tiene internet en ese momento. Los datos no “suben” al buscar actualizaciones.

Si algo en otra guía te suena demasiado técnico, **vuelve a esta página** y mira la tabla de “Ideas clave”; casi siempre el bloqueo es solo el vocabulario, no tu capacidad de seguir los pasos.
