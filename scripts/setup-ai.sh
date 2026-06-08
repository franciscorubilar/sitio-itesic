#!/bin/bash
# Script de configuración rápida para Deepseek o OpenAI

set -e

echo "🤖 Configurar Chatbot IA - ITESICWS"
echo "===================================="
echo ""

# Detectar si existe .env
if [ ! -f .env ]; then
    echo "❌ No existe .env. Copia .env.example primero:"
    echo "   cp .env.example .env"
    exit 1
fi

echo "Selecciona tu proveedor IA:"
echo "1) Deepseek (barato, recomendado)"
echo "2) OpenAI (más inteligente)"
echo ""
read -p "Opción (1 o 2): " choice

case $choice in
    1)
        echo ""
        echo "🐋 Deepseek seleccionado"
        echo "1. Accede a https://platform.deepseek.com"
        echo "2. Regístrate y copia tu API key"
        echo ""
        read -p "Pega tu API key Deepseek: " api_key
        
        # Actualiza .env
        sed -i.bak "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$api_key|" .env
        sed -i.bak "s|OPENAI_MODEL=.*|OPENAI_MODEL=deepseek-chat|" .env
        sed -i.bak "s|CHATBOT_AI_ENABLED=.*|CHATBOT_AI_ENABLED=true|" .env
        
        echo "✅ Configurado con Deepseek"
        ;;
    2)
        echo ""
        echo "🔑 OpenAI seleccionado"
        echo "1. Accede a https://platform.openai.com/account/api-keys"
        echo "2. Copia tu API key"
        echo ""
        read -p "Pega tu API key OpenAI: " api_key
        
        # Actualiza .env
        sed -i.bak "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$api_key|" .env
        sed -i.bak "s|OPENAI_MODEL=.*|OPENAI_MODEL=gpt-4o-mini|" .env
        sed -i.bak "s|CHATBOT_AI_ENABLED=.*|CHATBOT_AI_ENABLED=true|" .env
        
        echo "✅ Configurado con OpenAI"
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "🔄 Reiniciando servicios..."
if command -v docker-compose &> /dev/null; then
    docker-compose restart web
elif command -v docker &> /dev/null; then
    docker compose restart web
else
    npm start
fi

echo ""
echo "✅ ¡Listo! Tu chatbot ahora usa IA"
echo "📍 Prueba en: http://localhost:3001"
echo "💬 Pregunta: 'Necesito software a medida'"
echo ""
