#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Deployment for syasyahsamaj.com..."

git checkout Billings

# 1. Pull the latest changes from GitHub

echo "📥 Pulling latest code from Git..."
git pull origin Billings

# 2. Install dependencies (Clean install is safer for production)
echo "📦 Installing dependencies..."
pnpm install

# 3. Build the Next.js app
echo "🏗️ Building Next.js application..."
NODE_OPTIONS="--max_old_space_size=3072" pnpm run build

# 3b. Build the billing SPA (served by Next at /app/*)
echo "🏗️ Building billing web app (apps/billing)..."
pnpm --dir apps/billing build

# 4. Prepare the Standalone folder
# We must manually copy public and static folders as Next.js standalone doesn't do this
echo "📂 Assembling Standalone folder..."
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo "✅ Copied public/ to standalone"
fi

if [ -d ".next/static" ]; then
    cp -r .next/static .next/standalone/.next/
    echo "✅ Copied .next/static to standalone"
fi

# The standalone server resolves the SPA from cwd/apps/billing/dist
# (.next/standalone/apps/billing/dist) — copy it there so /app/* serves.
if [ -d "apps/billing/dist" ]; then
    mkdir -p .next/standalone/apps/billing
    cp -r apps/billing/dist .next/standalone/apps/billing/
    echo "✅ Copied billing SPA to standalone"
fi

# 5. Reload the app with PM2
# Using 'reload' instead of 'restart' ensures zero-downtime if you use cluster mode
echo "🔄 Reloading PM2 process..."
if pm2 list | grep -q "syasha-samaj"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi

# 6. Finalize
pm2 save
echo "✨ Deployment Complete! Your changes are live."