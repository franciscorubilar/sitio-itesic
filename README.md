# ITESICWS Web Platform Prisma

Proyecto web corporativo y administrable para ITESICWS.

Incluye sitio publico, productos administrables, pagina fuerte de Consultoria IA, leads, configuracion de formulario, envio opcional por correo y WhatsApp, modo claro/oscuro, imagenes SVG propias, Docker, PostgreSQL y Prisma 5.22.0 fijo.

## Levantar con Docker

```bash
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up
```

Luego abre:

- Sitio publico: http://localhost:3000
- Admin: http://localhost:3000/admin

Credenciales iniciales:

- Email: `admin@itesicws.cl`
- Password: `Admin12345!`

## Configurar formulario

Entra a:

http://localhost:3000/admin/settings

Puedes cambiar:

- Correo receptor.
- WhatsApp destino.
- Modo de entrega: solo BD, email, WhatsApp o ambos.
- Mensaje base de WhatsApp.
- Textos del hero principal.

## SMTP

Para envio real de correo, configura variables de entorno en `.env` o en tu ambiente Docker:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@dominio.cl
SMTP_PASS=tu-app-password
SMTP_FROM="ITESICWS <tu-correo@dominio.cl>"
```

Si SMTP no esta configurado, el lead queda guardado de todas formas y WhatsApp funciona si el modo lo permite.

## Prisma

Este proyecto fija Prisma en version `5.22.0` para evitar que Docker descargue Prisma 7.

El arranque usa siempre el binario local:

```bash
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma db push --accept-data-loss
```

No se usa `npx prisma`, por lo tanto no se descarga una version externa.

## Estructura

```txt
server.js
prisma/schema.prisma
prisma/seed.js
views/
public/css/styles.css
public/js/app.js
public/images/*.svg
Dockerfile
docker-compose.yml
```

## Notas

- Dentro de Docker, `DATABASE_URL` usa host `postgres`, no `localhost`.
- Fuera de Docker, puedes usar `localhost` si tienes PostgreSQL local.
- El volumen de Postgres se llama `postgres_data_prisma`.
