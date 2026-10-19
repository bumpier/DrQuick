#!/usr/bin/env bash
# Updates the live site on the VPS: pulls main, rebuilds, restarts under pm2,
# then waits until the site answers. Caddy proxies drquick.co.uk to $PORT;
# port 3000 on this box belongs to another app, so never use it here.
#
#   bash /var/www/drquick/website/scripts/deploy.sh
#
# Override the defaults with env vars, e.g.  PORT=3002 bash scripts/deploy.sh
# BIND_LOCAL=1 is the demo copy (docs/demo-deploy.md). Before installing anything
# it checks the copy's .env.production (scripts/demo-preflight.mjs) and refuses an
# existing pm2 process of that name not bound to 127.0.0.1; it starts next on
# 127.0.0.1 only, so just Caddy can reach it, and after the start checks that
# nothing listens on $PORT beyond loopback. Unset, none of that runs and the
# real site deploys as before.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/drquick}"
PM2_NAME="${PM2_NAME:-drquick}"
PORT="${PORT:-3001}"
BRANCH="${BRANCH:-main}"
BIND_LOCAL="${BIND_LOCAL:-}"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

cd "$APP_DIR" || die "No checkout at $APP_DIR (set APP_DIR)."

# Edits made directly on the server would be silently mixed into the deploy.
[ -z "$(git status --porcelain --untracked-files=no)" ] \
  || die "Uncommitted changes in $APP_DIR — commit or discard them first."

say "Pulling $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
git log --oneline -1

cd website
[ -f .env.production ] || [ -f .env ] \
  || die "No .env.production in $PWD — copy it from .env.example and fill it in."

# The demo copy: its settings are checked before anything is installed,
# migrated or built (names only; no value is printed).
if [ "$BIND_LOCAL" = "1" ]; then
  say "Checking the demo copy's .env.production"
  node scripts/demo-preflight.mjs "$PWD" \
    || die "The demo copy's settings are not ready (above). Nothing was installed, migrated or built."
fi

# Two pm2 processes under one name fight over the port and one crash-loops.
count=$(pm2 jlist | node -e "
  let s = ''; process.stdin.on('data', d => s += d).on('end', () =>
    console.log(JSON.parse(s).filter(p => p.name === process.argv[1]).length));
" "$PM2_NAME")
[ "$count" -le 1 ] \
  || die "$count pm2 processes are named $PM2_NAME. Keep one: pm2 delete <id>, then rerun."

# The binding is fixed when pm2 creates the process, and a restart keeps it: a
# demo process that exists without -H 127.0.0.1 would stay reachable from
# outside whatever BIND_LOCAL says, so stop here rather than ignore it.
if [ "$BIND_LOCAL" = "1" ] && [ "$count" -eq 1 ]; then
  args=$(pm2 jlist | node -e "
    let s = ''; process.stdin.on('data', d => s += d).on('end', () => {
      const p = JSON.parse(s).find(p => p.name === process.argv[1]);
      console.log([].concat(p.pm2_env.args || []).join(' '));
    });
  " "$PM2_NAME")
  case " $args " in
    *" -H 127.0.0.1 "*) ;;
    *) die "$PM2_NAME exists but is not bound to 127.0.0.1. Run: pm2 delete $PM2_NAME && pm2 save, then rerun this deploy with BIND_LOCAL=1." ;;
  esac
fi

say "Installing dependencies"
npm ci

say "Migrating the database"
npm run db:migrate || die "Migrations failed — the old build is still running. Check DATABASE_URL (docs/postgres-vps.md)."

say "Building"
npm run build

say "Restarting $PM2_NAME on port $PORT"
# pm2 restart keeps the process's old cwd, so a process started from another
# checkout would come back serving that checkout's stale build. Recreate it here.
if [ "$count" -eq 1 ]; then
  cwd=$(pm2 jlist | node -e "
    let s = ''; process.stdin.on('data', d => s += d).on('end', () =>
      console.log(JSON.parse(s).find(p => p.name === process.argv[1]).pm2_env.pm_cwd));
  " "$PM2_NAME")
  if [ "$cwd" != "$PWD" ]; then
    say "$PM2_NAME was running from $cwd; moving it to $PWD"
    pm2 delete "$PM2_NAME"
    count=0
  fi
fi
if [ "$count" -eq 1 ]; then
  PORT="$PORT" pm2 restart "$PM2_NAME" --update-env
else
  if [ "$BIND_LOCAL" = "1" ]; then
    # next start directly, so -H reaches it without relying on how npm forwards flags.
    PORT="$PORT" pm2 start node_modules/next/dist/bin/next --interpreter node \
      --name "$PM2_NAME" --cwd "$PWD" -- start -p "$PORT" -H 127.0.0.1
  else
    PORT="$PORT" pm2 start npm --name "$PM2_NAME" --cwd "$PWD" -- start
  fi
fi
pm2 save

# Whether every socket listening on $PORT is a loopback one (ss -ltn's local
# address column on stdin). False when there is none.
loopback_only() {
  local addr any=0
  while read -r addr; do
    [ -n "$addr" ] || continue
    any=1
    case "$addr" in
      "127.0.0.1:$PORT"|"[::1]:$PORT") ;;
      *) return 1 ;;
    esac
  done
  [ "$any" = "1" ]
}

# Asked as a browser asks for a page: the demo copy answers anything else 401
# without its passcode, but a page visit with a redirect (307), which curl -f
# counts as an answer. A demo copy that is not configured answers 503 and fails.
say "Waiting for http://127.0.0.1:$PORT"
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null -H 'Accept: text/html' "http://127.0.0.1:$PORT"; then
    if [ "$BIND_LOCAL" = "1" ] && ! ss -ltnH "sport = :$PORT" | awk '{print $4}' | loopback_only; then
      pm2 stop "$PM2_NAME" >/dev/null 2>&1 || true
      die "$PM2_NAME listens beyond 127.0.0.1:$PORT (ss -ltn | grep :$PORT), so it was stopped. Run: pm2 delete $PM2_NAME && pm2 save, then rerun with BIND_LOCAL=1."
    fi
    say "Live: $(git log --oneline -1)"
    exit 0
  fi
  sleep 2
done
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
die "Site did not answer on port $PORT — logs above."
