#!/bin/sh
set -eu

echo "Esperando PostgreSQL..."
until node scripts/wait-db.js; do
  sleep 2
done

echo "Generando Prisma Client local fijo..."
./node_modules/.bin/prisma generate

echo "Sincronizando schema con PostgreSQL..."
./node_modules/.bin/prisma db push --accept-data-loss

echo "Cargando seed inicial..."
node prisma/seed.js

echo "Iniciando ITESICWS en puerto ${PORT:-3000}..."
node server.js
