# Configurar Chatbot IA - OpenAI o Deepseek

## Opción A: Deepseek (Recomendado - Barato y Rápido) 🐋

### Paso 1: Obtener API Key
1. Ve a https://platform.deepseek.com
2. Regístrate (gratis, sin tarjeta de crédito para pruebas)
3. Copia tu API key

### Paso 2: Configurar en .env
```bash
# En tu servidor, edita .env
nano .env

# Agrega estas líneas:
OPENAI_API_KEY=sk-xxxxxxxxxxxx  # Tu Deepseek API key aquí
OPENAI_MODEL=deepseek-chat       # El modelo Deepseek
CHATBOT_AI_ENABLED=true
```

### Paso 3: Reinicia la app
```bash
# Si usas docker
docker-compose restart web

# O si es Node.js directo
npm start
```

**Ventajas Deepseek:**
✅ API abierta y amigable  
✅ Muy barato (~$0.14 por 1M tokens)  
✅ Excelente para chatbots  
✅ Respuestas en español  
✅ Sin límites de rate  

---

## Opción B: OpenAI (Si ya tienes cuenta)

### Paso 1: Obtener API Key
1. Ve a https://platform.openai.com/account/api-keys
2. Crea una nueva key

### Paso 2: Configurar en .env
```bash
nano .env

# Agrega:
OPENAI_API_KEY=sk-proj-xxxxx  # Tu OpenAI API key
OPENAI_MODEL=gpt-4o-mini      # Modelo recomendado (barato y rápido)
CHATBOT_AI_ENABLED=true
```

### Paso 3: Reinicia
```bash
docker-compose restart web
```

**Ventajas OpenAI:**
✅ Más inteligente (GPT-4)  
✅ Mejor comprensión de contexto  
✅ Español excelente  
❌ Más caro (~$0.15 por 1M input tokens)  

---

## Opción C: Hybrid (Alternancia inteligente)

Usa Deepseek primero (barato) y fallback a OpenAI si necesitas más poder:

```bash
# .env
OPENAI_API_KEY=sk-xxxx-deepseek-xxxx
OPENAI_MODEL=deepseek-chat
OPENAI_FALLBACK_KEY=sk-proj-openai-xxxx
OPENAI_FALLBACK_MODEL=gpt-4o-mini
```

---

## Quick Test: ¿Funciona?

```bash
# Desde tu servidor
curl -X POST http://localhost:3001/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{"text":"Hola, ¿qué es PERSEUS?"}'

# Deberías recibir respuesta IA en segundos
```

---

## Precios Actuales (2026)

| API | Input | Output | Latencia | Recomendación |
|-----|-------|--------|----------|---------------|
| **Deepseek** | $0.14/M | $0.28/M | ~500ms | ⭐ Mejor relación precio |
| **GPT-4o Mini** | $0.15/M | $0.60/M | ~1s | Más inteligente |
| **Claude 3.5** | $3/M | $15/M | ~2s | Premium |

---

## Troubleshooting

**Error: "Invalid API key"**
```bash
# Verifica que la key está bien en .env
cat .env | grep OPENAI_API_KEY

# Reinicia Docker
docker-compose down
docker-compose up -d
```

**Chatbot responde mal**
→ Revisa en el admin: Settings → Chatbot → activa "Usar IA"

**Rate limit en Deepseek**
→ Usa plan pagado, cuesta ~$5-10/mes para uso normal

---

## Configuración en Admin Panel

1. Abre http://localhost:3001/admin/settings
2. Baja a sección "IA y Chatbot"
3. Verifica: "✓ Chatbot IA Activado"
4. Prueba: "Necesito software a medida"

---

¿Cuál prefieres: **Deepseek** (barato) u **OpenAI** (más potente)?
