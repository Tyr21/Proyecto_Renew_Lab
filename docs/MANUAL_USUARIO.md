# Manual de usuario — Consultorio Renew Lab

Guía para el uso diario de la aplicación de escritorio **Consultorio Renew Lab**: gestión de citas, finanzas, clientes y configuración. Los datos se guardan **en el equipo del consultorio** (base de datos local); no es necesaria conexión a Internet para el funcionamiento normal.

---

## 1. Introducción

### 1.1 ¿Para qué sirve?

La aplicación permite:

- Ver y gestionar la **agenda** en vista semanal (citas de pacientes).
- Registrar **pagos** y consultar el **cierre de caja** por fechas.
- Emitir y administrar **facturas** de venta (módulo local).
- Mantener un **directorio de clientes**.
- Consultar **reportes** e indicadores por período (incluye **cierre de caja**, facturas y **oxígeno** cuando aplique).
- Ajustar **configuración** del consultorio (servicios, horarios, respaldos, oxígeno, seguridad).

### 1.2 Inicio de la aplicación

Abra la aplicación desde el acceso directo o el menú de programas de Windows, según cómo esté instalada en su equipo.

- Si **no** se ha configurado una **contraseña de inicio**, la aplicación cargará directamente la pantalla principal.
- Si **sí** existe contraseña de inicio, verá una pantalla para introducirla. Debe escribirla correctamente y pulsar **Entrar** para continuar.

---

## 2. Pantalla principal: pestañas superiores

En la parte superior hay **cuatro pestañas** principales (de izquierda a derecha), más un botón de **Ayuda**:

| Pestaña | Contenido |
|---------|-----------|
| **Calendario** | Vista semanal de citas y panel del día. |
| **Reportes** | Varios apartados en **subpestañas**: **Cierre de caja** (ingresos y resumen de oxígeno en el mismo rango de fechas), **Facturas**, **Oxígeno** (registro diario de lecturas y fotos), **Estadísticas**, **Movimientos detallados**. |
| **Clientes** | Búsqueda y ficha de clientes. |
| **Configuración** | Ajustes generales (requiere contraseña de administrador; véase la sección **7** y el resumen de contraseñas en la sección **8**). |

La pestaña activa aparece resaltada en azul.

---

## 3. Calendario

### 3.1 Vista semanal

- La zona central muestra los **días de la semana** en columnas y las **horas** en filas (franjas de 30 minutos, habitualmente de la mañana a la tarde).
- Puede **cambiar de semana** con los controles de navegación de la vista (anterior / siguiente semana, ir a “hoy”).
- Si en configuración está activada la opción de **mostrar domingos**, el domingo aparecerá como columna; si no, la semana va de lunes a sábado (según configuración).

### 3.2 Crear una cita

1. Pulse en un **hueco libre** de la cuadrícula en la fecha y hora deseada (si la franja permite agendar según las reglas del consultorio).
2. Se abre el **formulario de cita**. Rellene al menos los datos obligatorios (nombre, documento, teléfono, tipo de servicio, etc.).
3. Puede buscar un **cliente existente** escribiendo en el nombre: aparecerán sugerencias para autocompletar datos.
4. Guarde con el botón correspondiente. La cita aparecerá en el calendario.

**Nota:** En algunas franjas ya iniciadas puede aplicarse un **periodo de gracia** (pocos minutos tras el inicio del turno) para permitir citas de último momento; fuera de esa ventana, el sistema puede impedir crear citas en ese hueco.

### 3.3 Editar o ver una cita

- Pulse sobre el **bloque de la cita** en el calendario.
- Las citas **futuras** suelen permitir editar todos los campos permitidos por las reglas del consultorio.
- Las citas **pasadas** pueden tener el formulario limitado (por ejemplo, solo marcar si el paciente **asistió** o **no asistió**), según política del sistema.

### 3.4 Estados de la cita

Las citas pueden figurar como **pendiente**, **asistió** o **no asistió** (según lo que registre el personal).

### 3.5 Citas solapadas y capacidad

Si varios pacientes pueden usar el mismo tipo de servicio a la misma hora (por ejemplo, varias plazas en cámara), el sistema controla la **capacidad** configurada por tipo de servicio. Si el cupo está lleno, no podrá agendar otro en ese solape.

### 3.6 Panel lateral “Hoy” y mini calendario

En el calendario suele mostrarse un **panel lateral** con:

- Resumen de las citas del **día actual**.
- Un **mini calendario** para saltar a otras fechas y alinear la semana visible.

### 3.7 Eventos y recordatorios

Además de las citas de pacientes, puede haber **eventos** (mantenimiento, recordatorios internos, etc.) con color distintivo. Se gestionan desde los controles previstos en la vista (crear / editar según permisos).

---

## 4. Cierre de caja y facturas

Estas pantallas están en la pestaña superior **Reportes**, como **subpestañas** (no hay una pestaña principal separada llamada “Cierre de caja”).

### 4.1 Cierre de caja

- Permite **filtrar ingresos por rango de fechas** y ver listados y totales.
- Puede **registrar pagos** vinculados o no a una cita, según el flujo de la pantalla (también puede abrirse el registro de pago desde el calendario al completar una cita, según la versión).
- Los métodos de pago habituales incluyen **efectivo**, **tarjeta** y **transferencia** (según lo definido en el sistema).
- En el mismo rango de fechas puede mostrarse un **resumen de oxígeno (cámara hiperbárica)**: sesiones atendidas del tipo configurado, consumo teórico y comparación con las lecturas de medidor registradas (véase **Reportes → Oxígeno** para el registro diario y **Configuración → Oxígeno** para K y tipo de servicio).

### 4.2 Facturas

- En **Reportes → Facturas**: gestión de **facturas** en estados como borrador, emitida o anulada (según reglas y permisos).
- La **anulación** de facturas emitidas puede estar restringida y requerir **modo administrador** (véase sección 7).

---

## 5. Reportes

- Elija un **período** con atajos como: **Hoy**, **Esta semana**, **Este mes**, **Mes pasado**, **Últimos 12 meses** o un rango **personalizado** con fechas desde / hasta.
- Podrá ver indicadores como citas por mes, ingresos por mes, distribución por tipo de servicio y por método de pago, y gráficas cuando estén disponibles.
- Si existe opción de **imprimir** o exportar informe, úsela según las necesidades del consultorio.

### 5.1 Oxígeno (cámara hiperbárica)

En la subpestaña **Oxígeno** (dentro de **Reportes**) el personal puede **registrar por día** las lecturas de dos medidores y una **foto** de los medidores. La aplicación exige que la foto tenga metadatos **EXIF** con **fecha de captura** coincidente con el **día de operación** elegido. El formulario ofrece los tipos **Recarga de pipeta** y **Cierre**; al elegir uno, se muestra su nombre como título y un texto de ayuda. Las bases antiguas pueden conservar tipos ya no disponibles (p. ej. “Extra”, “Balance inicial”) en registros antiguos.

**Medidor A / Medidor B** son las dos lecturas que se documentan (y suelen salir en la foto); entran en los informes y en la comparación con el consumo teórico. Bajo cada etiqueta, la aplicación muestra la **última lectura guardada** en el sistema (el registro con fecha de creación más reciente) usando la **etiqueta de unidad** de Configuración → Oxígeno (p. ej. kPa).

Los parámetros **K** (consumo teórico por sesión) y el **tipo de servicio** usado para contar sesiones se configuran en **Configuración → Oxígeno**.

---

## 6. Clientes

- Use el **cuadro de búsqueda** para encontrar clientes por nombre, apellidos o documento.
- Puede **crear** un cliente nuevo o **abrir** la ficha de uno existente para editar datos de contacto y notas.
- La eliminación de clientes puede estar sujeta a **modo administrador** y a reglas de negocio (por ejemplo, no eliminar si hay datos vinculados).

---

## 7. Configuración

Al pulsar **Configuración**, la aplicación le pedirá la **contraseña de administrador** (o le ofrecerá **crearla** si es la primera vez). Sin esa verificación no se muestra el panel de ajustes.

Al **salir** de la pestaña Configuración y volver a entrar, **se volverá a pedir** la contraseña de administrador.

El panel de configuración está organizado en **secciones** (menú lateral en pantallas grandes o lista desplegable en pantallas pequeñas):

### 7.1 Calendario

- **Formato de hora:** 12 h (AM/PM) o 24 h.
- **Duración por defecto** al crear una cita nueva (en múltiplos de 30 minutos).
- **Vista semanal:** incluir o no **domingos** en la cuadrícula.

### 7.2 Tipos de documento

- Lista de tipos de documento de identidad (por ejemplo CC, CE, TI, etc.).
- **Tipo por defecto** al crear citas o clientes.

### 7.3 Tipos de servicio

- Cada servicio tiene **identificador**, **nombre visible**, **capacidad concurrente** (cuántas citas del mismo tipo pueden solaparse) y **precio sugerido** para cobros (en moneda local; 0 si no desea sugerencia).

### 7.4 Facturación

- **Datos del consultorio** que pueden aparecer en documentos de venta: razón social, NIT, dirección, teléfono.
- **Valores por defecto** al crear facturas: serie o prefijo, IVA por defecto (%).

### 7.5 Respaldos

- Activación de **copias automáticas** de la base de datos al iniciar la aplicación.
- **Cuántas copias** conservar en cada ubicación.
- Opcional: **carpeta externa** (por ejemplo una carpeta sincronizada con la nube) para una copia adicional.
- **Restaurar desde respaldo:** lista los respaldos locales y permite elegir uno externo con un selector de archivos. Pide la contraseña de administrador, advierte que se reemplaza la base activa y pierde datos posteriores, y cierra la aplicación al terminar para que vuelva a abrirse con la base restaurada.

> **Importante sobre los respaldos:** los archivos generados (`consultorio_<fecha>.db`) son **copias sin cifrar** de la base. Trate cada respaldo con el mismo nivel de cuidado que la información del consultorio: guárdelo en USB cifrados, carpetas privadas o servicios con su propia cuenta protegida. Consulte la sección **9. Datos, privacidad y respaldos** para recomendaciones detalladas.

### 7.6 Oxígeno (cámara hiperbárica)

- **Etiqueta de unidad** (por ejemplo m³ o unidades) para mostrar en informes.
- **Consumo teórico por sesión (K)** multiplicado por las citas **atendidas** del tipo de servicio elegido.
- **Tipo de servicio** cuyas sesiones con estado “asistió” se cuentan para el teórico (por defecto, cámara hiperbárica).

### 7.7 Administración

Aquí se gestionan el **modo administrador** y las **contraseñas de seguridad**.

#### Modo administrador

- El **modo administrador** permite operaciones sensibles: por ejemplo eliminar citas pasadas, ciertos ingresos o clientes, o anular facturas, según las reglas del programa.
- Al **marcar o desmarcar** la casilla, la aplicación **pedirá la contraseña de administrador** para confirmar.
- **Importante:** el modo administrador **no permanece activo** después de cerrar y volver a abrir la aplicación: al iniciar de nuevo, el modo administrador figura como **desactivado** aunque lo hubiera guardado activo en la sesión anterior. Deberá activarlo de nuevo si lo necesita.

#### Contraseña al iniciar la aplicación

Si el **modo administrador** está activado en el borrador de configuración (casilla marcada **antes** de pulsar “Guardar configuración”), puede:

- Definir o cambiar la **contraseña de inicio** (la que pide la aplicación al abrirse).
- **Quitar** la protección de inicio confirmando con la **contraseña de administrador** (no hace falta recordar la contraseña de inicio para quitarla; la seguridad la aporta el administrador).
- Si olvidó la contraseña de inicio, puede **restablecerla** con la contraseña de administrador en el apartado previsto.

#### Contraseña de administrador

Con el modo administrador activo puede **cambiar** o **eliminar** la contraseña de administrador. Si la elimina, la próxima vez que entre en Configuración se le pedirá **definir una nueva**.

### 7.8 Guardar y cancelar

- **Guardar configuración** escribe los cambios en la base de datos local y puede cerrar el panel según el comportamiento de la versión.
- **Cancelar** descarta cambios no guardados (puede pedir confirmación si hay modificaciones pendientes).

---

## 8. Seguridad: resumen de contraseñas

| Concepto | Función |
|----------|---------|
| **Contraseña de inicio** | Opcional. Si existe, se pide **una vez** al abrir la aplicación, antes del calendario. |
| **Contraseña de administrador** | Protege el acceso a **Configuración** y la activación del **modo administrador**. Quien la conozca puede gestionar también las contraseñas y opciones sensibles descritas arriba. |

- Use contraseñas **largas y fáciles de recordar para usted** (por ejemplo una frase), no solo palabras cortas.
- Guarde las contraseñas en un lugar seguro ajeno a la aplicación si necesita recuperarlas (la aplicación no puede “recuperar” una contraseña olvidada: solo restablecerla con los procedimientos previstos).

---

## 9. Datos, privacidad y respaldos

- Toda la información principal reside en un **archivo de base de datos** en el equipo. Haga **copias de respaldo** según la sección **Respaldos** y, si es posible, mantenga copias en otro medio o ubicación segura.
- **El archivo de base de datos no está cifrado:** quien tenga acceso al equipo (con privilegios de administrador del sistema o si el equipo se pierde sin protección) podría abrir el archivo. Las contraseñas de inicio y de administrador se almacenan con técnicas que dificultan adivinarlas (Argon2), pero **no protegen el contenido del resto de la base si alguien copia el archivo**.
- **Proteja el equipo:**
	- Active el **cifrado de disco** del sistema operativo (en Windows: **BitLocker**). Esto protege todo el contenido del equipo si se pierde o se lo roban estando apagado.
	- Use **contraseña de sesión de Windows** y bloqueo automático al ausentarse.
	- Si comparte el equipo con personal del consultorio, considere crear sesiones de Windows separadas.
- **Proteja los respaldos:**
	- El archivo de respaldo (`consultorio_*.db`) **es una copia exacta de la base, igualmente sin cifrar**. Guárdelo en un medio confiable.
	- Para respaldos externos en USB, prefiera unidades con **BitLocker To Go** o equivalente.
	- Para respaldos en la nube, use carpetas en servicios donde usted controla la cuenta y, idealmente, con cifrado en cliente.
- **Si pierde una contraseña**, la aplicación **no puede recuperarla**: solo restablecerla con los procedimientos de Configuración (que a su vez requieren la contraseña de administrador, o pasos guiados si se perdió esta). Guarde sus contraseñas en un lugar seguro fuera de la aplicación.

---

## 10. Consejos prácticos

- Revise periódicamente el **cierre de caja** y los **reportes** para cuadrar con la operación real del consultorio.
- Si varias personas usan el mismo equipo, acuerden quién conoce la **contraseña de administrador** y quién puede activar el **modo administrador**.
- Si algo no permite guardar (mensaje de error), lea el texto del mensaje: suele indicar datos faltantes o reglas de horario/cupo.

---

## 11. Más información técnica

Para desarrolladores o personal de soporte IT:

- [PROJECT.md](./PROJECT.md) — visión del producto y fases.
- [ARQUITECTURA.md](./ARQUITECTURA.md) — detalle técnico de datos y comportamiento del sistema.

---

*Documento alineado con la versión actual de la aplicación. Si tras una actualización alguna pantalla cambia de nombre o ubicación, consulte las notas de la versión o a su proveedor de soporte.*
