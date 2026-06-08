#!/bin/bash
# Instalar Docker Compose v2 en Linux

set -e

echo "📦 Instalando Docker Compose v2..."

# Detectar OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

case $OS in
    ubuntu|debian)
        echo "🐧 Detectado Debian/Ubuntu"
        sudo apt-get update
        sudo apt-get install -y docker-compose-plugin
        ;;
    centos|rhel|fedora)
        echo "🔴 Detectado RHEL/CentOS"
        sudo yum install -y docker-compose-plugin
        ;;
    *)
        echo "⚠️  OS no detectado. Instala manualmente:"
        echo "   https://docs.docker.com/compose/install/linux/"
        exit 1
        ;;
esac

echo ""
echo "✅ Docker Compose v2 instalado"
echo ""
echo "Ahora puedes usar:"
echo "   docker compose -f docker-compose.yml up -d"
echo ""
