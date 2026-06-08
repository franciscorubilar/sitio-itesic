# 🚀 Quick Start - Chatbot IA en Producción

## TL;DR (Rápido)

Tu servidor está en `/var/www/sitio-itesic` y necesitas IA. Aquí va:

### Paso 1: Instala Docker Compose (si no lo tienes)
```bash
cd /var/www/sitio-itesic
bash scripts/install-docker-compose.sh
```

### Paso 2: Copia el archivo de configuración
```bash
cp .env.example .env
# Edita .env con tu API key (Deepseek o OpenAI)
nano .env
```

### Paso 3: Levanta la app CON IA
```bash
# Opción A: Con Docker (recomendado en producción)
sudo docker compose -f docker-compose.yml up -d

# Opción B: Node.js directo (si no quieres Docker)
npm install
npm start
```

### Paso 4: Prueba
```bash
curl -X POST http://localhost:3001/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{"text":"Hola, necesito software"}'
```

---

## 📋 Opciones de IA Recomendadas

### 🐋 Deepseek (MEJOR para empezar)
**Pros:**
- Muy barato (~$5-10/mes para uso normal)
- API abierta y amigable
- Excelente para chatbots
- Respuestas en español perfectas

**Setup:**
```bash
# 1. Ve a https://platform.deepseek.com → crea cuenta
# 2. Copia tu API key
# 3. En .env:
OPENAI_API_KEY=sk-xxxxxxx
OPENAI_MODEL=deepseek-chat
```

### 🔑 OpenAI
**Pros:**
- Más inteligente (GPT-4o)
- Mejor comprensión
- Si ya tienes cuenta

**Setup:**
```bash
# 1. Ve a https://platform.openai.com/account/api-keys
# 2. Copia tu API key
# 3. En .env:
OPENAI_API_KEY=sk-proj-xxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

---

## 🎯 Próximos Pasos

1. **Configura tu API key** → Edita `.env`
2. **Levanta Docker** → `sudo docker compose -f docker-compose.yml up -d`
3. **Prueba el chatbot** → http://localhost:3001
4. **Admin** → http://localhost:3001/admin (usuario/pass en BD)

---

## 🐛 Troubleshooting

**Error: "docker-compose: command not found"**
```bash
# Usa docker compose (v2, sin guión)
sudo docker compose -f docker-compose.yml up -d
```

**Error: "Invalid API key"**
```bash
# Verifica la key en .env
cat .env | grep OPENAI_API_KEY

# Reinicia Docker
sudo docker compose restart web
```

**El chatbot responde mal/lento**
- ¿Está configurada la API key? → Revisa `.env`
- ¿Está el contenedor corriendo? → `docker ps`
- ¿Timeout de OpenAI? → Usa Deepseek (más rápido)

---

## 📚 Archivos Importantes

- **API_SETUP.md** → Guía detallada de APIs
- **.env.example** → Template con ejemplos
- **scripts/setup-ai.sh** → Setup interactivo
- **scripts/install-docker-compose.sh** → Instalar Docker Compose

---

¿Preguntas? Lee **API_SETUP.md** para más detalles. 🎉
