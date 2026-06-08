# Integración Ollama con Chatbot ITESICWS

## Opción A: Usa Ollama + Open WebUI (Recomendado - Amigable)

### Paso 1: Levanta los servicios
```bash
# Inicia Ollama + Open WebUI
docker-compose -f docker-compose.yml -f docker-compose.ollama.yml up -d

# Espera ~30 segundos a que Ollama esté listo
sleep 30

# Descarga un modelo local (elige UNO):
# Recomendado: Mistral 7B (rápido, inteligente, ~4GB)
docker exec itesicws-ollama ollama pull mistral

# Alternativas:
# docker exec itesicws-ollama ollama pull neural-chat  # Ultra rápido, ~2GB
# docker exec itesicws-ollama ollama pull llama2        # Más pesado, ~7GB
```

### Paso 2: Accede a Open WebUI
- URL: http://localhost:8080
- Crea cuenta, selecciona modelo Mistral
- Prueba el chat

### Paso 3 (Opcional): Integra con tu chatbot existente

En `server.js`, antes de `chatbotAnswerWithAI`, agrega esta función:

```javascript
async function chatbotAnswerWithOllama({ message, state, settings, products, posts }) {
  try {
    const response = await fetch('http://ollama:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt: `Sistema: Eres el asistente comercial amigable de ITESICWS. Responde en español, claro y conciso.
Usuario: ${message}
Respuesta:`,
        stream: false,
        temperature: 0.7
      })
    });
    
    if (!response.ok) throw new Error('Ollama no disponible');
    
    const data = await response.json();
    return {
      ok: true,
      intent: 'ai_ollama',
      lead: false,
      answer: data.response.trim(),
      suggestions: ['Otra opción', 'Ver productos', 'Hablar por WhatsApp'],
      actions: [
        settings.whatsappNumber ? { type: 'link', label: 'Hablar por WhatsApp', url: buildChatbotWhatsApp(settings, message) } : null,
        { type: 'lead', label: 'Dejar mis datos' }
      ].filter(Boolean),
      state: { intent: 'ai_ollama', leadHint: message }
    };
  } catch (error) {
    console.log('Ollama no disponible:', error.message);
    return null;
  }
}
```

Luego, en la función `chatbotAnswer`, después de intentar OpenAI, agrega:
```javascript
if (openAiConfigured()) {
  try {
    const aiAnswer = await chatbotAnswerWithAI({ message: text, state, settings, products, posts });
    if (aiAnswer) return aiAnswer;
  } catch (error) {
    console.error('OpenAI no disponible, intentando Ollama...');
  }
}

// Intenta Ollama local como fallback
try {
  const ollamaAnswer = await chatbotAnswerWithOllama({ message: text, state, settings, products, posts });
  if (ollamaAnswer) return ollamaAnswer;
} catch (error) {
  console.error('Ollama no disponible, usando reglas locales');
}
```

---

## Opción B: Solo Ollama CLI (Más ligero)

Si no quieres Open WebUI:

```bash
# Descarga modelo
docker exec itesicws-ollama ollama pull mistral

# Prueba via curl
curl http://localhost:11434/api/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "prompt": "¿Qué es un ERP?",
    "stream": false
  }'
```

---

## Ventajas de Ollama Local

✅ **100% privado** - Sin APIs externas, los datos nunca salen  
✅ **Rápido** - Respuesta en ~1 segundo con Mistral  
✅ **Barato** - No hay costos por token  
✅ **Amigable** - Respuestas conversacionales naturales  
✅ **Contextual** - Puede entender tu negocio mejor  
✅ **Offlne-ready** - Funciona sin internet  

---

## Modelos Disponibles (Comparativa)

| Modelo | Tamaño | Velocidad | Inteligencia | Recomendado |
|--------|--------|-----------|--------------|-------------|
| neural-chat | 1.3GB | ⚡⚡⚡ | ⭐⭐ | Demos rápidas |
| mistral | 4GB | ⚡⚡ | ⭐⭐⭐⭐ | **RECOMENDADO** |
| llama2 | 7GB | ⚡ | ⭐⭐⭐ | Si tienes GPU |
| dolphin-mixtral | 27GB | 🐌 | ⭐⭐⭐⭐⭐ | Producción avanzada |

---

## Troubleshooting

**Error: "No space left on device"**
```bash
# Ollama descarga modelos grandes. Necesitas ~10GB libres mínimo
docker system prune -a  # Limpia Docker
```

**Ollama lento**
- Usa `mistral` en lugar de `llama2`
- Si tienes GPU NVIDIA, descomenta la sección de GPU en docker-compose.ollama.yml

**Integración lenta con Node.js**
- Asegúrate que ambos están en la misma red Docker
- Usa `http://ollama:11434` (no localhost)

---

## Próximos Pasos

1. Levanta Ollama
2. Prueba con Open WebUI
3. Integra con tu chatbot actual
4. Entrena el modelo con contexto específico (opcional)

¡Tu chatbot será mucho más inteligente sin APIs externas! 🚀
