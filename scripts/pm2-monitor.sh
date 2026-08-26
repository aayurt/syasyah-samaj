#!/bin/bash
# PM2 crash/memory monitor for syasha-samaj -> ntfy.sh push alerts
# Runs every minute via cron. Alerts on:
#   - process offline
#   - restart count increase (crash-looping)
#   - memory above threshold
#   - site health check failing 2x in a row
# Sends a recovery notification when an active alert clears.
# Repeat alerts for the same issue are rate-limited (cooldown).

source /root/.nvm/nvm.sh >/dev/null 2>&1

APP="syasha-samaj"
NTFY_TOPIC="syasha-prod-e54ee2f6352f"
STATE="/root/.pm2-monitor.state"
HEALTH_URL="https://syasyahsamaj.com/en"
MEM_THRESHOLD_MB=700      # alert if RSS exceeds this
COOLDOWN=900              # seconds between repeat alerts of the same key
HEALTH_FAILS_TO_ALERT=2

now=$(date +%s)
touch "$STATE"

state_get() { grep "^$1 " "$STATE" 2>/dev/null | tail -1 | awk '{print $2}'; }
state_set() { sed -i "/^$1 /d" "$STATE"; echo "$1 $2" >> "$STATE"; }
state_del() { sed -i "/^$1 /d" "$STATE"; }

send() { # key title message [priority]
  local key="$1" title="$2" msg="$3" prio="${4:-high}"
  local last; last=$(state_get "alert:$key")
  if [ -n "$last" ] && [ $((now - last)) -lt $COOLDOWN ]; then return 0; fi
  curl -s -m 10 \
    -H "Title: $title" -H "Priority: $prio" -H "Tags: rotating_light" \
    -d "$msg" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1
  state_set "alert:$key" "$now"
}

recover() { # key message
  local key="$1" msg="$2"
  if [ -n "$(state_get "alert:$key")" ]; then
    state_del "alert:$key"
    curl -s -m 10 \
      -H "Title: ✅ $APP recovered" -H "Priority: default" -H "Tags: white_check_mark" \
      -d "$msg" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1
  fi
}

# ── Gather PM2 stats ────────────────────────────────────────────────
stats=$(pm2 jlist 2>/dev/null | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try {
    const p=JSON.parse(d).find(x=>x.name==="'$APP'");
    if(!p){console.log("offline 0 0");return}
    console.log([p.pm2_env.status, p.pm2_env.restart_time,
      Math.round((p.monit&&p.monit.memory||0)/1048576)].join(" "));
  } catch { console.log("offline 0 0"); }
})' 2>/dev/null)

status=$(echo "$stats" | awk '{print $1}')
restarts=$(echo "$stats" | awk '{print $2}')
mem=$(echo "$stats" | awk '{print $3}')

# ── 1. Offline ──────────────────────────────────────────────────────
if [ "$status" != "online" ]; then
  send "offline" "🚨 $APP is $status" "PM2 process is $status on $(hostname) at $(date '+%H:%M')."
else
  recover "offline" "Process is online again ($(date '+%H:%M'))."
fi

# ── 2. Crash-looping (restart count went up) ────────────────────────
last_restarts=$(state_get restarts)
if [ -n "$last_restarts" ] && [ "$restarts" -gt "$last_restarts" ]; then
  delta=$((restarts - last_restarts))
  send "restarts" "🔁 $APP restarted $delta×" "Restart count $last_restarts → $restarts. Possible crash-loop. Mem ${mem}MB at $(date '+%H:%M')."
fi
[ -n "$restarts" ] && state_set restarts "$restarts"
recover "restarts" "No new restarts in the last $((COOLDOWN/60)) min ($(date '+%H:%M'))."

# ── 3. Memory ───────────────────────────────────────────────────────
if [ "$mem" -gt "$MEM_THRESHOLD_MB" ] 2>/dev/null; then
  send "memory" "🧠 $APP memory ${mem}MB" "RSS exceeded ${MEM_THRESHOLD_MB}MB threshold at $(date '+%H:%M'). OOM risk on this 1.8GB box."
else
  recover "memory" "Memory back to ${mem}MB (below ${MEM_THRESHOLD_MB}MB)."
fi

# ── 4. Site health ──────────────────────────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" 2>/dev/null)
fails=$(state_get health_fails); fails=${fails:-0}
if [ "$code" != "200" ] && [ "$code" != "308" ]; then
  fails=$((fails + 1)); state_set health_fails "$fails"
  if [ "$fails" -ge "$HEALTH_FAILS_TO_ALERT" ]; then
    send "health" "🌐 Site down ($code)" "$HEALTH_URL returned HTTP $code $fails× in a row at $(date '+%H:%M')."
  fi
else
  state_del health_fails
  recover "health" "$HEALTH_URL is responding $code again ($(date '+%H:%M'))."
fi

exit 0
