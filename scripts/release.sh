#!/bin/sh
# Roda antes de cada versão nova no Fly.io: aplica as migrações e, se pedido, carrega os dados de exemplo.
set -e
npx prisma migrate deploy
if [ "$SEED_AO_PUBLICAR" = "true" ]; then
  npx tsx prisma/seed.ts
fi
