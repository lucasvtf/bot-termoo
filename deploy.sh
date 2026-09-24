#!/bin/sh
# Atualiza o bot na VM: puxa o código, builda, aplica o schema e troca o container.
# Chamado pelo GitHub Actions (via SSH) a cada push na main, ou manualmente: ~/bot-termoo/deploy.sh
set -eu
cd "$(dirname "$0")"

git pull --ff-only
docker build -t bot-termo .
docker run --rm --env-file .env bot-termo node src/db/migrate.js
docker rm -f bot-termo 2>/dev/null || true
docker run -d --name bot-termo --restart unless-stopped \
  --env-file .env --log-opt max-size=10m --log-opt max-file=3 \
  bot-termo
docker image prune -f >/dev/null   # remove imagens antigas pra não encher o disco

echo "Deploy ok: $(git log -1 --format='%h %s')"
