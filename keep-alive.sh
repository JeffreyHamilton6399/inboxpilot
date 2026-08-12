#!/usr/bin/env bash
# keep-alive.sh — restarts the Next.js dev server if it dies (sandbox OOM protection).
cd /home/z/my-project
LOG=dev.log
start_server() {
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1
  setsid env -u DATABASE_URL -u DIRECT_DATABASE_URL NODE_OPTIONS="--max-old-space-size=1536" \
    bunx next dev -p 3000 >> "$LOG" 2>&1 &
  echo "[keep-alive $(date +%H:%M:%S)] server started (pid $!)"
}
echo "[keep-alive $(date +%H:%M:%S)] starting watchdog (pid $$)"
start_server
sleep 15
while true; do
  if curl -s -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null; then
    : # healthy
  else
    echo "[keep-alive $(date +%H:%M:%S)] server down, restarting..."
    start_server
    sleep 15
  fi
  sleep 6
done
