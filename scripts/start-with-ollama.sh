#!/bin/bash
# Script de inicio rápido para Ollama + Chatbot mejorado

set -e

echo "🚀 ITESICWS Chatbot Mejorado con Ollama"
echo "========================================"

# Paso 1: Validar Docker
echo -e "\n[1/5] Validando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Instálalo desde https://docker.com"
    exit 1
fi
echo "✅ Docker disponible"

# Paso 2: Levantar servicios
echo -e "\n[2/5] Levantando servicios (PostgreSQL + Web + Ollama)..."
docker-compose -f docker-compose.yml -f docker-compose.ollama.yml up -d
echo "✅ Servicios iniciados"

# Paso 3: Esperar a Ollama
echo -e "\n[3/5] Esperando a que Ollama esté listo..."
sleep 15
for i in {1..30}; do
    if docker exec itesicws-ollama ollama list &> /dev/null; then
        echo "✅ Ollama listo"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Timeout esperando Ollama"
        exit 1
    fi
    sleep 1
done

# Paso 4: Descargar modelo
echo -e "\n[4/5] Descargando modelo Mistral (primera ejecución, ~4GB, toma ~2 min)..."
docker exec itesicws-ollama ollama pull mistral
echo "✅ Modelo Mistral descargado"

# Paso 5: Información final
echo -e "\n[5/5] ✅ ¡TODO LISTO!"
echo ""
echo "📍 Accesos disponibles:"
echo "   🌐 Sitio web:     http://localhost:3001"
echo "   💬 Chat Ollama:   http://localhost:8080 (Open WebUI)"
echo "   📊 Ollama API:    http://localhost:11434"
echo ""
echo "🧠 Tu chatbot ahora es más inteligente:"
echo "   ✓ Fuzzy matching para typos (PERSEUS -> PERSEO)"
echo "   ✓ Respuestas IA local sin APIs externas"
echo "   ✓ Conversación natural con Mistral"
echo ""
echo "📚 Próximos pasos:"
echo "   1. Abre http://localhost:3001 en tu navegador"
echo "   2. Prueba el chatbot con: 'Quiero un asistente inteligente'"
echo "   3. (Opcional) Abre http://localhost:8080 para Open WebUI"
echo ""
echo "📖 Más info en: OLLAMA_SETUP.md"
echo ""
