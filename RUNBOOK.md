# Operational Runbook — syasyah-samaj

## System Overview

| Component | Technology | Port | Health Check |
|-----------|------------|------|--------------|
| Payload CMS | Next.js + Payload 3 | 3000 | `GET /api/health` |
| Billing SPA | Vite + React 19 | 5173 (dev) | `GET /` |
| Database | PostgreSQL 16 | 5432 | `pg_isready` |
| Redis | Redis 7 | 6379 | `PING` |
| Sync API | Payload endpoint | 3000 | `POST /api/sync` |

## Deployment

### Production (VPS)
```bash
# On VPS
cd /var/www/syasyah-samaj
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart ecosystem.config.cjs
```

### Docker (Alternative)
```bash
docker compose -f docker-compose.yml up -d --build
```

### Desktop (Tauri)
```bash
cd apps/desktop
pnpm tauri build
# Output: DMG (macOS), MSI (Windows), AppImage (Linux)
```

## Health Checks

### Automated (PM2 + Cron)
```bash
# Every 5 min: check API health
*/5 * * * * curl -sf https://api.syasyah.org/api/health || pm2 restart payload

# Daily: check sync lag
0 2 * * * curl -sf https://api.syasyah.org/api/admin/sync-stats | jq '.maxLagMinutes' | awk '$1 > 10 { exit 1 }'
```

### Manual Verification
```bash
# API health
curl https://api.syasyah.org/api/health

# Database connectivity
curl https://api.syasyah.org/api/health/db

# Sync engine (check last sync across tenants)
curl -X POST https://api.syasyah.org/api/sync \
  -H "Content-Type: application/json" \
  -d '{"lastSyncAt": "2026-01-01T00:00:00.000Z", "operations": []}'
```

## Common Operations

### 1. Create New Tenant (Ilaka)
```bash
# Via Payload Admin
# 1. Go to https://admin.syasyah.org
# 2. Collections → Tenants → Create
# 3. Fill: name, code, district, fiscalYearStart
# 4. Save → auto-creates default DocSequences, FiscalYears

# Or via API
curl -X POST https://api.syasyah.org/api/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Ilaka", "code": "ILK-001", "district": "Kathmandu"}'
```

### 2. Reset Tenant Data (Cleanup)
```bash
# Via DataManagement page (UI)
# Select tenant → Cleanup → Type "DELETE ALL TRANSACTIONS" → Confirm

# Or via API (admin only)
curl -X POST https://api.syasyah.org/api/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "tenant-uuid", "collections": ["documents", "journal-entries"]}'
```

### 3. Seed Demo Data
```bash
# Via DataManagement page (UI)
# Select tenant → Demo Data → "Add Demo Data" (requires feature toggle)

# Or via API
curl -X POST https://api.syasyah.org/api/seed-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tenantId": "tenant-uuid"}'
```

### 4. Backup Database
```bash
# Automated (daily cron)
pg_dump -h localhost -U postgres syasyah_samaj | gzip > /backups/syasyah-$(date +%F).sql.gz

# Manual with tenant filter
pg_dump -h localhost -U postgres -t "tenant_*" syasyah_samaj > tenant-backup.sql
```

### 5. Restore Database
```bash
# Full restore
gunzip -c /backups/syasyah-2026-10-01.sql.gz | psql -h localhost -U postgres syasyah_samaj

# Single tenant (careful!)
# 1. Create new DB
# 2. Restore specific tables with tenant filter
# 3. Update tenant ID references
```

### 6. Clear Sync State (Troubleshooting)
```bash
# For specific tenant - clears local cache, forces full resync
# Run in browser console on affected client:
const engine = getEngine()
await engine.adapter.clearCollection('tenant-uuid:members')
await engine.adapter.clearCollection('tenant-uuid:vouchers')
await engine.deleteKey('cursor:tenant-uuid:members')
await engine.deleteKey('cursor:tenant-uuid:vouchers')
await engine.deleteKey('pulled:tenant-uuid:members')
await engine.deleteKey('pulled:tenant-uuid:vouchers')
location.reload()
```

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|------------|---------------|------------|
| **P0** | Data loss, all tenants down, security breach | 15 min | Page on-call immediately |
| **P1** | Single tenant down, sync broken, payments failing | 1 hour | Alert on-call |
| **P2** | Degraded performance, non-critical feature broken | 4 hours | Next business day |
| **P3** | Minor bug, cosmetic issue | Next sprint | Backlog |

### Common Incidents

#### P0: Database Down
1. Check `pg_isready` on VPS
2. Check disk space: `df -h`
3. Check Postgres logs: `journalctl -u postgresql`
4. Restart: `systemctl restart postgresql`
5. Verify: `curl /api/health/db`

#### P1: Sync Stuck for Tenant
1. Check sync state: `GET /api/sync` with empty operations
2. Check outbox size: `GET /api/admin/outbox-stats?tenant=X`
3. Clear stuck entries: `POST /api/admin/outbox/clear?tenant=X&seq=123`
4. Force resync: Client runs `engine.syncAll()`

#### P1: Import Failed (Duplicate Data)
1. Check import logs in DataManagement page
2. Identify duplicate keys from error report
3. Advise user: use "Update Existing" conflict rule
4. If data corrupted: restore from backup + re-import

#### P2: Slow Voucher Save
1. Check Network tab → `/api/sync` latency
2. Check DB: `EXPLAIN ANALYZE` on slow queries
3. Check Redis: `INFO memory`, `SLOWLOG GET`
4. Add indexes if missing (create migration)

## Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API p95 latency | < 500ms | > 2s |
| Sync success rate | > 99.9% | < 99% |
| Database connections | < 80% pool | > 90% |
| Disk usage | < 70% | > 85% |
| Memory usage | < 70% | > 85% |
| Failed imports/day | 0 | > 5 |

### Dashboards
- **Grafana**: `https://grafana.syasyah.org/d/syasyah-samaj`
- **Payload Admin**: `https://admin.syasyah.org` (audit log, users)
- **PM2**: `pm2 monit` on VPS

### Log Locations
| Service | Location |
|---------|----------|
| Payload/Next.js | `pm2 logs payload` |
| Nginx | `/var/log/nginx/access.log`, `error.log` |
| Postgres | `/var/log/postgresql/postgresql-16-main.log` |
| Sync (client) | Browser DevTools → Console → `[SyncEngine]` |

## Security Operations

### Rotate Secrets (Quarterly)
```bash
# 1. Generate new PAYLOAD_SECRET
openssl rand -base64 32

# 2. Update in .env on VPS
# 3. Restart: pm2 restart payload

# 4. Rotate RESEND_API_KEY in Resend dashboard
# 5. Update .env and restart
```

### Audit Log Review (Weekly)
```bash
# Via Payload Admin → Audit Log
# Filter: last 7 days, severity: error/warn
# Look for: failed logins, permission denials, sync conflicts
```

## Backup & Recovery Testing

### Monthly Drill
1. Restore latest backup to staging DB
2. Verify tenant count matches production
3. Run smoke tests: login, create voucher, sync
4. Document time-to-recovery

### Quarterly Full DR
1. Simulate VPS loss
2. Provision new VPS from infrastructure repo
3. Restore DB + config
4. Verify all tenants accessible
5. Update DNS
6. Document RTO/RPO

## Scaling Guidelines

| Trigger | Action |
|---------|--------|
| DB CPU > 70% sustained | Upgrade instance, add read replica |
| Sync queue > 1000 entries | Increase sync frequency, batch size |
| Redis memory > 80% | Increase TTL, add cluster node |
| Bundle size > 500KB gz | Code-split heavy pages, analyze deps |

## Contact

- **On-call**: Check PagerDuty / Opsgenie rotation
- **Slack**: #syasyah-ops
- **Email**: ops@syasyah.org
- **Repo**: https://github.com/aayurt/syasyah-samaj