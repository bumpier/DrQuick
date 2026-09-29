#!/usr/bin/env bash
# Updates the live site on the VPS: pulls main, rebuilds, restarts under pm2,
# then waits until the site answers. Caddy proxies drquick.co.uk to $PORT;
# port 3000 on this box belongs to another app, so never use it here.
#
#   bash /var/www/drquick/website/scripts/deploy.sh
#
# Override the defaults with env vars, e.g.  PORT=3002 bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/drquick}"
PM2_NAME="${PM2_NAME:-drquick}"
PORT="${PORT:-3001}"
BRANCH="${BRANCH:-main}"

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

# Two pm2 processes under one name fight over the port and one crash-loops.
count=$(pm2 jlist | node -e "
  let s = ''; process.stdin.on('data', d => s += d).on('end', () =>
    console.log(JSON.parse(s).filter(p => p.name === process.argv[1]).length));
" "$PM2_NAME")
[ "$count" -le 1 ] \
  || die "$count pm2 processes are named $PM2_NAME. Keep one: pm2 delete <id>, then rerun."

say "Installing dependencies"
npm ci

say "Building"
npm run build

say "Restarting $PM2_NAME on port $PORT"
if [ "$count" -eq 1 ]; then
  PORT="$PORT" pm2 restart "$PM2_NAME" --update-env
else
  PORT="$PORT" pm2 start npm --name "$PM2_NAME" --cwd "$PWD" -- start
fi
pm2 save

say "Waiting for http://127.0.0.1:$PORT"
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT"; then
    say "Live: $(git log --oneline -1)"
    exit 0
  fi
  sleep 2
done
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
die "Site did not answer on port $PORT — logs above."
