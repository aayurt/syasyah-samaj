# Plan: local HTTPS for syasyah-samaj via Docker + mkcert

## Goal
Serve the syasyah-samaj Next.js app (and billing SPA) locally over HTTPS at
`https://sysyah.local:8443` inside Docker, with mkcert providing the local CA +
certificate, nginx terminating TLS in front of the app containers, and
`better-auth`/Payload generating `https://` URLs for auth callbacks.

## Current context / assumptions
- Workspace: `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/` (git repo,
  pnpm workspaces, Node via nvm).
- Docker `29.9.2` is installed; `mkcert` is NOT installed (`which mkcert`
  fails).
- Next.js app at repo root, port 3000 (`pnpm dev` / `next start`; `next.config.js`
  does NOT use standalone output — server runs `next start` against `.next`).
- Billing SPA at `apps/billing/`, Vite dev server on port 5173, production path
  `/app/` (matches `https://syasyahsamaj.com/app`).
- `.env` uses `NEXT_PUBLIC_SERVER_URL=http://localhost:3000` and
  `BETTER_AUTH_URL=http://localhost:3000` — these must become `https://` for
  local HTTPS auth to work.
- Repo `Dockerfile` and `docker-compose.yml` are stale/drifted (compose references
  `yarn` + `mongo`; Dockerfile expects `output: 'standalone'`). This plan
  REPLACES `docker-compose.yml` rather than fixing the old one.
- Target hostname: `sysyah.local` (user suggestion). `.localhost` is the
  zero-/etc/hosts alternative — see open questions.
- Certs are dev-only: never commit `docker/certs/`; add to `.gitignore` and
  `.dockerignore`.

## Architecture / proposed approach
`mkcert` creates a local root CA (trusted by macOS via `mkcert -install`) and a
leaf cert for `sysyah.local` + `localhost` + `127.0.0.1` + `::1`. Cert/key live
in `docker/certs/` (gitignored). `docker-compose.yml` runs three services:

- `app` — `node:22-alpine`, volume-mounted source, `pnpm dev` on port 3000,
  `env_file: .env.local` with `https://sysyah.local:8443` URLs.
- `billing` — `node:22-alpine`, Vite `pnpm dev` on port 5173.
- `proxy` — `nginx:alpine` built from `docker/nginx/Dockerfile`, listens
  `8443` (SSL, mkcert certs mounted) and `8080` (HTTP → 301 to HTTPS),
  forwards `/` → `app:3000` and `/app/` → `billing:5173`, sets
  `X-Forwarded-Proto: https` so Next.js/better-auth see HTTPS.

Host-side: `127.0.0.1 sysyah.local` in `/etc/hosts`. Browser opens
`https://sysyah.local:8443/` with a valid lock icon (mkcert CA in trust store).

TLS termination happens in nginx; the app speaks plain HTTP internally. This
keeps Next.js unchanged (no custom HTTPS server) and matches production where
the VPS nginx terminates TLS for `syasyahsamaj.com`.

## Step-by-step tasks

### Task 1 — Install mkcert
Command:
```bash
brew install mkcert nss
```
Expected output: `brew` downloads and links `mkcert`; `mkcert -version` prints
something like `mkcert v1.4.4 (built with go1.x)`.
Verify:
```bash
mkcert -version
```
Expected: version line, exit code 0.

### Task 2 — Trust the mkcert CA locally
Command:
```bash
mkcert -install
```
Expected output: confirmation that the CA was installed in the system trust store
and Firefox/Chrome trust stores (e.g. "Using ... as the local CA", "added to
the system trust store").
Verify:
```bash
mkcert -install
```
Second run is idempotent and exits 0.

### Task 3 — Generate certs for sysyah.local
Commands:
```bash
mkdir -p docker/certs/nginx
mkcert -key-file docker/certs/nginx/sysyah.local-key.pem \
       -cert-file docker/certs/nginx/sysyah.local.pem \
       sysyah.local localhost 127.0.0.1 ::1
```
Expected output: mkcert writes `docker/certs/nginx/sysyah.local-key.pem` and
`docker/certs/nginx/sysyah.local.pem`, prints "Created a new certificate valid
for the following names ...".
Verify:
```bash
ls -l docker/certs/nginx/ && openssl x509 -in docker/certs/nginx/sysyah.local.pem -noout -subject -issuer
```
Expected: both files exist; subject `CN=sysyah.local`; issuer is the mkcert
local CA.

### Task 4 — Route sysyah.local to localhost
Command:
```bash
grep -q 'sysyah.local' /etc/hosts || echo '127.0.0.1 sysyah.local' | sudo tee -a /etc/hosts
```
Expected output: `127.0.0.1 sysyah.local` appended (or grep finds it already).
Verify:
```bash
ping -c 1 -t 1 sysyah.local 2>&1 || ping -c 1 -W 1 sysyah.local
```
Expected: `64 bytes from 127.0.0.1 ...` (exit 0). Note exact flag differs by OS
(`-t 1` macOS, `-W 1` Linux) — either form acceptable, success is reply from
127.0.0.1.

### Task 5 — Write nginx image (TLS terminator)
Create `docker/nginx/Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY certs/ /etc/nginx/certs/
```
Create `docker/nginx/nginx.conf`:
```nginx
events { worker_connections 1024; }

http {
  map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
  }

  upstream nextjs { server app:3000; }
  upstream billing { server billing:5173; }

  server {
    listen 8443 ssl;
    server_name sysyah.local localhost;

    ssl_certificate     /etc/nginx/certs/sysyah.local.pem;
    ssl_certificate_key /etc/nginx/certs/sysyah.local-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
      proxy_pass http://nextjs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Port $server_port;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }

    location /app/ {
      rewrite ^/app/(.*)$ /$1 break;
      proxy_pass http://billing;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }

  server {
    listen 8080;
    server_name sysyah.local localhost;
    return 301 https://$host:8443$request_uri;
  }
}
```
Verify:
```bash
docker run --rm -v "$(pwd)/docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```
Expected: `nginx: the configuration file /etc/nginx/conf.d/default.conf syntax is ok` and `test is successful`.

### Task 6 — Replace docker-compose.yml
Overwrite `docker-compose.yml` (stale file — full rewrite):
```yaml
version: '3.8'

services:
  app:
    image: node:22-alpine
    working_dir: /app
    volumes:
      - .:/app
      - app_node_modules:/app/node_modules
    command: sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm dev"
    env_file:
      - .env.local
    expose:
      - "3000"
    depends_on:
      - proxy

  billing:
    image: node:22-alpine
    working_dir: /app/apps/billing
    volumes:
      - .:/app
      - billing_node_modules:/app/apps/billing/node_modules
    command: sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm dev"
    expose:
      - "5173"

  proxy:
    build:
      context: .
      dockerfile: docker/nginx/Dockerfile
    ports:
      - "8443:8443"
      - "8080:8080"
    volumes:
      - ./docker/certs:/etc/nginx/certs:ro
    depends_on:
      - app
      - billing

volumes:
  app_node_modules:
  billing_node_modules:
```
Verify:
```bash
docker compose config --quiet
```
Expected: no output, exit code 0 (valid compose).

### Task 7 — Create .env.local with HTTPS URLs
Command:
```bash
cp .env .env.local
```
Then edit `.env.local`:
```bash
NEXT_PUBLIC_SERVER_URL=https://sysyah.local:8443
BETTER_AUTH_URL=https://sysyah.local:8443
NEXT_PUBLIC_BETTER_AUTH_URL=https://sysyah.local:8443
```
(keep all other values from `.env`).
Verify:
```bash
grep -E '^(NEXT_PUBLIC_SERVER_URL|BETTER_AUTH_URL|NEXT_PUBLIC_BETTER_AUTH_URL)=' .env.local
```
Expected: all three lines show `https://sysyah.local:8443`, no trailing slash.

Also confirm `.env.local` is gitignored:
```bash
git check-ignore .env.local && echo IGNORED
```
Expected: `.env.local` printed followed by `IGNORED`. If `git check-ignore` exits non-zero, add `.env.local` and `docker/certs/` to `.gitignore`.

### Task 8 — Add sysyah.local to Next.js image allowlist
Edit `next.config.js` `images.remotePatterns` — add:
```js
{
  protocol: 'https',
  hostname: 'sysyah.local',
},
```
Verify:
```bash
grep -n "sysyah.local" next.config.js
```
Expected: one match with `hostname: 'sysyah.local'` and `protocol: 'https'`.

### Task 9 — Build and start the stack
Command:
```bash
docker compose up --build
```
Expected output: `app-1` runs `pnpm dev` and prints Next.js "Ready in ...";
`billing-1` prints Vite "ready in ..."; `proxy-1` starts nginx; all three
services `Up` in `docker compose ps`.
Verify (in another terminal):
```bash
docker compose ps
```
Expected: NAMES `syasyah-samaj-app-1`, `-billing-1`, `-proxy-1` all state `Up`,
ports `0.0.0.0:8443->8443/tcp`, `0.0.0.0:8080->8080/tcp` on proxy.

### Task 10 — Validate HTTPS endpoints
```bash
curl -i https://sysyah.local:8443/
```
Expected: `HTTP/1.1 200 OK`, content-type `text/html` (Next.js served over TLS
through nginx, no `-k` needed — cert is trusted via mkcert CA).

```bash
curl https://sysyah.local:8443/ -v 2>&1 | grep -E '^(>|<|* subject:|* issuer:)'
```
Expected: `* subject: CN=sysyah.local` and issuer references mkcert local CA;
curl exits 0 without `-k`.

```bash
curl -i http://sysyah.local:8080/
```
Expected: `HTTP/1.1 301 Moved Permanently` with `Location:
https://sysyah.local:8443/`.

```bash
curl -i https://sysyah.local:8443/app/
```
Expected: `HTTP/1.1 200 OK` billing SPA HTML (Vite dev served through proxy).

## Tests / validation
This is an infrastructure task; validation is the exact curl/`docker compose ps`
checks above (each "expected output" doubles as the pass criterion). Order per
task = write config → run command → verify expected output → commit.

No unit tests are added (YAGNI: nginx/compose config isn't unit-testable
meaningfully; the e2e surface is the live curl checks).

Before finishing: `git add` changed files, commit on feature branch
`local-https-sysyah-local` with message `feat(local): https sysyah.local via docker + mkcert`, push, open PR (follow this repo's PR convention — no direct push to main).

## Risks, tradeoffs, and open questions
- **mkcert certs are dev-only**: never ship `docker/certs/` to the VPS; production
  keeps its own cert (current VPS nginx for syasyahsamaj.com). Cert/key are
  excluded via `.gitignore` + `.dockerignore`.
- **`sysyah.local` vs `localhost`**: `.localhost` is reserved and needs no
  `/etc/hosts` edit; `sysyah.local` needs the hosts entry but matches the user's
  request. Decide now: keep `sysyah.local`.
- **OAuth providers**: Google/Apple callbacks are registered for
  `https://syasyahsamaj.com`. Local OAuth won't work against `sysyah.local`
  unless a local OAuth client is registered; plan assumes local dev uses
  email/password (or credentials provider) — add a local Google client as a
  follow-up if needed.
- **Port 8443 in URL**: 443 would need root on the host; 8443 avoids `sudo`
  for `docker compose up`. Accept tradeoff; can switch to 443 later.
- **Next.js dev HMR behind TLS**: HMR connects `wss://` matching `window.location`
  since the page loads over HTTPS — verify hot reload works after Task 10;
  if it fails, set `X-Forwarded-Host` in nginx or disable HMR for the proxy path.
- **Monorepo `pnpm install` in `app` container**: installs the whole workspace
  (heavy but simple). Ponytail: ceiling = `pnpm install` every container start;
  upgrade = bake `node_modules` into the `app` image with a `pnpm install`
  stage and mount only source.