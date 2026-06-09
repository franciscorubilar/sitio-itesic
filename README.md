# ITESICWS Web Platform Prisma

Proyecto web corporativo y administrable para ITESICWS.

Incluye sitio publico, productos administrables, blog con categorias, buscador, entradas destacadas, editor visual, subida de imagenes, FAQs por articulo, leads, configuracion de formulario, envio opcional por correo y WhatsApp, chatbot flotante, boton de WhatsApp, modo claro/oscuro, Docker, PostgreSQL y Prisma 5.22.0 fijo.

## Levantar con Docker

```bash
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up
```

Luego abre:

- Sitio publico: http://localhost:3000
- Blog: http://localhost:3000/blog
- Admin: http://localhost:3000/admin

Credenciales iniciales:

- Email: `admin@itesicws.cl`
- Password: `Admin12345!`

## Administrar blog

Entra a:

http://localhost:3000/admin/blog

Puedes gestionar:

- Entradas publicadas, borradores y destacadas.
- Categorias del blog.
- Busqueda y filtros internos para administrar mejor.
- Imagen principal por carga directa.
- Editor visual con subtitulos, listas, links, citas e imagenes dentro del articulo.
- FAQs por articulo usando el formato `Pregunta|Respuesta`.

El blog publico incluye buscador, filtros por categoria, entrada destacada y tarjetas responsive.

## Chatbot y WhatsApp

Entra a:

http://localhost:3000/admin/settings

Puedes configurar:

- Activar o desactivar el chatbot publico.
- Titulo del chatbot.
- Mensaje de bienvenida.
- Botones rapidos.
- Mensaje de respuesta cuando no reconoce la consulta.
- WhatsApp destino y mensaje base.

El chatbot responde con reglas locales del sitio, muestra formulario de lead cuando corresponde y guarda la solicitud en la base de datos usando `/api/chatbot/lead`. Si tienes modo de entrega por correo activo, tambien intenta enviar el aviso por SMTP.

### Chatbot IA real con contexto

Para que el asistente deje de responder solo con reglas locales, configura un proveedor IA. DeepSeek es una opción barata y compatible con el SDK de OpenAI:

```env
CHATBOT_AI_ENABLED=true
CHATBOT_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=tu_api_key_deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

También puedes usar OpenAI:

```env
CHATBOT_AI_ENABLED=true
CHATBOT_AI_PROVIDER=openai
OPENAI_API_KEY=tu_api_key_openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_REASONING_EFFORT=low
```

El backend entrega al modelo el contexto de productos, módulos, beneficios, industrias, FAQs, blog e historial reciente de conversación. La respuesta se pide en JSON para que el frontend pueda mostrar texto, chips y acciones. Si falta la API key o hay un error, cae automáticamente a las reglas locales.

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

Si ya tienes una base de datos anterior, ejecuta `prisma db push` para agregar las columnas nuevas del chatbot a `SiteSetting`.

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

## Mejoras adicionales incluidas en esta versión

### Sitio público
- SEO base mejorado con títulos y descripciones dinámicas por página.
- `robots.txt` y `sitemap.xml` generados automáticamente desde productos y artículos publicados.
- Blog con barra de progreso de lectura, tabla de contenidos automática y CTA comercial al final de cada artículo.
- Nueva sección en home para orientar al visitante según su problema: operación, datos, IA o software a medida.
- Menú móvil mejorado para navegación responsive.

### Administración
- Dashboard convertido en centro de control con métricas de productos, blog, leads recientes y pipeline comercial.
- Productos con buscador, filtros por estado/categoría, vista previa, publicar/ocultar, duplicar y eliminar.
- Blog con contadores, acciones rápidas para publicar/borrador, destacar, duplicar, editar y ver en público.
- Categorías del blog muestran cuántas entradas tiene cada una.
- Leads con filtros por texto/estado, tablero por estado, exportación CSV, notas internas, respuesta rápida por email/WhatsApp y eliminación.

### Recomendación después de actualizar
No se agregaron modelos nuevos de base de datos en esta mejora, por lo que normalmente basta con reconstruir el contenedor. Si vienes de una versión anterior sin blog/chatbot, ejecuta igualmente:

```bash
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma db push --accept-data-loss
```

## Chatbot conversacional v3

Esta versión reemplaza el capturador tipo formulario por un asistente conversacional real:

- Endpoint `POST /api/chatbot/message` para responder desde el servidor.
- Detección de intención: cotización/consultoría, humano, IA, chatbot, blog/SEO, Power BI, ERP/operación y productos.
- Respuestas alimentadas por productos y artículos publicados en la base de datos.
- Sugerencias dinámicas después de cada respuesta.
- Acciones contextuales: ver producto, leer artículo, consultoría IA, WhatsApp o dejar datos.
- Captura inteligente de lead solo cuando la conversación lo amerita.
- El lead guarda el contexto conversacional en el mensaje.
- Fallback humano hacia WhatsApp si no puede responder bien.

No requiere migración nueva. Usa las tablas existentes `Product`, `BlogPost`, `Lead` y `SiteSetting`.

## Chatbot v5 proactivo

Esta versión agrega un asistente más conversacional:

- Saludo automático al entrar al sitio.
- Sonido suave de notificación usando Web Audio cuando el navegador lo permite.
- Si el navegador bloquea audio automático, el sonido se reproduce después de la primera interacción del usuario.
- Opciones visuales dentro del chat: Consultoría IA, Software a medida, Power BI/Datos, Automatización, Chatbot inteligente y Humano.
- El formulario sigue oculto hasta que el usuario decide dejar sus datos.

Levantar con Docker:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```
