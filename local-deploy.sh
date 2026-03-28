#!/bin/bash
set -e

SERVER="root@217.154.58.85"
REMOTE_PATH="/var/www/syasyah-samaj"
LOCAL_PATH="/Users/aayurtshrestha/projects/self/web/payload/syasha-samaj"

echo "🚀 Starting deploy..."

# 1️⃣ Sync media (local → server)
echo "⬆️ Syncing media (local → server)..."
rsync -avz "$LOCAL_PATH/public/media/" "$SERVER:$REMOTE_PATH/public/media/"

# 2️⃣ Server-side deployment
ssh $SERVER << 'EOF'
set -e

echo "📦 Moving into project..."
cd /var/www/syasyah-samaj

source ~/.nvm/nvm.sh

echo "🔄 Git pull..."
git pull origin

echo "📦 Installing dependencies..."
pnpm install

echo "🏗️ Building project..."
NODE_OPTIONS="--max_old_space_size=3072" pnpm run build

echo "📂 Preparing standalone build..."
mkdir -p .next/standalone/.next

if [ -d "public" ]; then
  cp -r -f public .next/standalone/
  echo "✅ public copied"
fi

if [ -d ".next/static" ]; then
  cp -r -f .next/static .next/standalone/.next/
  echo "✅ static copied"
fi

echo "🔄 Reloading PM2..."
if pm2 describe syasha-samaj > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo "🎉 Server deploy complete!"
EOF

# 3️⃣ Sync media back (server → local)
echo "⬇️ Syncing media (server → local)..."
rsync -avz "$SERVER:$REMOTE_PATH/public/media/" "$LOCAL_PATH/public/media/"

echo "✨ Deploy finished successfully!"