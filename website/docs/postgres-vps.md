# Postgres on the VPS

The site keeps everything in one Postgres database: the waitlist, the blog, analytics, finance and the admin's logs. These steps get it running on the VPS (Ubuntu or Debian, the same box pm2 runs on). Run each step once, as root.

## 1. Install

```bash
apt update && apt install -y postgresql
systemctl enable --now postgresql
```

Postgres listens on `127.0.0.1:5432` only by default. Keep it that way: the app is on the same machine, and nothing else needs to reach the database.

## 2. Create the role and database

Generate a password, then create a role that owns only this database:

```bash
PW=$(openssl rand -hex 24); echo "$PW"   # keep this for step 3
sudo -u postgres psql -v pw="$PW" <<'SQL'
CREATE ROLE drquick LOGIN PASSWORD :'pw';
CREATE DATABASE drquick OWNER drquick;
SQL
```

## 3. Point the site at it

Add this line to `/var/www/drquick/website/.env.production`:

```
DATABASE_URL=postgres://drquick:<the password>@127.0.0.1:5432/drquick
```

## 4. Deploy

```bash
bash /var/www/drquick/website/scripts/deploy.sh
```

The deploy runs `npm run db:migrate` before building. It creates every table the first time; after that it applies only new migrations. If a migration fails, the deploy stops before the build and the running site is left alone.

Then sign in at `/admin`. Before this change, sign-in failed with "needs the site's Redis store"; with `DATABASE_URL` set, it works.

## 5. Nightly backups

This keeps 14 days of compressed dumps:

```bash
mkdir -p /var/backups/drquick
cat > /etc/cron.d/drquick-backup <<'CRON'
15 3 * * * postgres pg_dump -Fc drquick > /var/backups/drquick/drquick-$(date +\%F).dump && find /var/backups/drquick -name '*.dump' -mtime +14 -delete
CRON
```

To restore a dump into an empty database:

```bash
sudo -u postgres pg_restore -d drquick --clean /var/backups/drquick/drquick-YYYY-MM-DD.dump
```

Copy the dumps off the box as well (rsync or object storage). A backup that lives only on the server it backs up protects against mistakes, not against losing the server.

## 6. Analytics retention (cron)

Raw analytics events older than 13 months are deleted by `scripts/prune-analytics.mjs`:

```bash
cat > /etc/cron.d/drquick-prune <<'CRON'
30 3 * * * root cd /var/www/drquick/website && node scripts/prune-analytics.mjs >> /var/log/drquick-prune.log 2>&1
CRON
```

## Moving old Redis data across (only if it exists)

If the site ever ran against Upstash or Vercel KV, copy its waitlist and blog across once. Put the `KV_REST_API_URL` and `KV_REST_API_TOKEN` values in the environment, then run:

```bash
DATABASE_URL=... KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/import-redis.mjs
```

The import skips rows that already exist, so running it twice does no harm.

## Local development

Nothing to install: with no `DATABASE_URL`, `npm run dev` uses PGlite (Postgres in WebAssembly), stored in `.data/pglite`.

To use a real Postgres locally instead:

```bash
docker run -d --name drquick-pg -e POSTGRES_USER=drquick -e POSTGRES_PASSWORD=drquick \
  -e POSTGRES_DB=drquick -p 127.0.0.1:55432:5432 postgres:17-alpine
echo 'DATABASE_URL=postgres://drquick:drquick@127.0.0.1:55432/drquick' >> .env.local
npm run db:migrate
```

To change the schema, edit `lib/db/schema.ts`, run `npm run db:generate`, and commit the new file in `drizzle/`.
