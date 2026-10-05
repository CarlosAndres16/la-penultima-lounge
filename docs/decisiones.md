# Decisiones del equipo

## Base de datos
- Mientras el esquema se estabiliza, todo el esquema vive en un único archivo: `back-end/db/migrations/001_esquema_inicial.sql`.
- Los datos de prueba viven aparte, en `002_datos_prueba.sql`.
- Cada vez que se cambie el esquema o los datos de prueba, se regenera la base:
  `docker compose down -v` y luego `docker compose up --build`.
- Quien cambie el esquema debe AVISAR al otro (mensaje o Pull Request).
- Cuando el esquema se estabilice, los cambios pasarán a archivos nuevos (`003_...`, etc.).
- Valores de estado provisionales (según el DDL de la arquitectura): `Activo` / `Inactivo` / `Bloqueado`. Pendiente confirmar.

## Rutas del gateway (propuesta, no documentada)
- `/api/v1/auth` y `/api/v1/users` → servicio `auth` (puerto 3001)
- `/api/v1/sedes` → servicio `sedes` (puerto 3002)

## Pendientes por consultar
- Idioma de la interfaz (inglés según la propuesta, español en las HU).
- Momento del bloqueo: tercer intento o cuarto intento (HU-06 vs HU-07).
- Código de sede y de usuario, y tabla de auditoría (no están en el DDL).
- Si el Administrador lleva sede o no.