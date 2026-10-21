# Putting the demo live (for the developer, once)

The investor demo runs at https://demo.drquick.co.uk: a second, separate production copy of the site on the same VPS, behind one passcode. The real site at drquick.co.uk is not touched. Once it is set up, the presenter runs everything from a browser (`docs/demo.md`) and needs no terminal.

What makes this copy safe to leave on the internet:

- It has its own database, `drquick_demo`. The demo writes only to a database on this machine whose name contains `demo`, and refuses anything else, so Reset can never touch real data.
- Every page and route sits behind the passcode (a 12-hour session). Tries are limited to 10 per 10 minutes per address.
- It fails closed: a missing flag, passcode or secret, or a `DATABASE_URL` that is not the demo's own database, makes every page answer 503 "Demo not configured".
- Its deploy checks itself: with `BIND_LOCAL=1`, `scripts/deploy.sh` checks `.env.production` before it installs, migrates or builds anything, and checks after the start that the app listens on 127.0.0.1 only.
- It is not indexed (`noindex` on every response).

## Requirements (the demo is safe only if all of these hold)

- **Caddy is the only way in.** Deploy with `BIND_LOCAL=1` so the app listens on 127.0.0.1 only. Put no CDN or shared cache in front of Caddy: prerendered pages carry `s-maxage`, and a cache would serve them to people without the passcode. Set no `trusted_proxies` that applies to this site (it is usually a global option, in the `servers {}` block at the top of the Caddyfile, so check there as well as in the demo's own block), so `X-Forwarded-For` is Caddy's own and cannot be forged by a visitor.
- **The demo's database role cannot reach the real site's database.** It owns `drquick_demo` and has no CONNECT on `drquick` (step 2).
- **DNS is an A record only, no AAAA** (step 1). The passcode's rate limit counts per address, and an IPv6 visitor can change address at will.
- **`DEMO_PASSCODE` is at least 16 characters and `DEMO_SESSION_SECRET` at least 32** (both counted after trimming spaces), both generated, with no `$` in either. A weaker value leaves the whole demo locked: every page answers 503 "Demo not configured".
- **`DATABASE_URL` names the database in its path** (`.../drquick_demo`, the name containing `demo`), **on this machine, and carries no `database`, `db` or `dbname` query parameter**. Anything else leaves the whole demo locked (503), and the deploy refuses it before migrating.

Run every step as root on the VPS unless it says otherwise.

## 0. Commit and push the work first

The demo code is on the branch `feat/livekit-video`: make sure the branch is committed and pushed. `scripts/deploy.sh` pulls a branch and refuses a checkout with local changes, so commit and push it before anything else. The real site stays on `main` and is not affected: only the demo checkout is deployed from this branch. If you would rather keep a tidy name, push it as a `demo` branch and use that name for `BRANCH` below.

## 1. DNS

At your DNS host add an A record: `demo` -> the VPS's own public IPv4 address (the server's address, as `curl -4 ifconfig.me` prints on the VPS). Make it **DNS only**: not proxied through a CDN (with Cloudflare, the grey cloud, not the orange one), so visitors reach Caddy directly and nothing caches the pages. **Add no AAAA record** for `demo`, even if the real site has one: the passcode's rate limit is per IPv4 address. Check it resolves to the VPS before you touch Caddy: `dig +short demo.drquick.co.uk` must print the VPS's address (and `dig +short AAAA demo.drquick.co.uk` should print nothing).

## 2. Postgres: a role and a database of their own

The same pattern as `docs/postgres-vps.md` step 2, with new names. Keep the password for step 4.

```bash
PW=$(openssl rand -hex 24); echo "$PW"
sudo -u postgres psql -v pw="$PW" <<'SQL'
CREATE ROLE drquick_demo LOGIN PASSWORD :'pw';
CREATE DATABASE drquick_demo OWNER drquick_demo;
SQL
```

The database name must contain `demo`. Leave this database out of the nightly backup: it holds nothing worth keeping.

Postgres lets every role connect to every database by default. Close that, so the demo's role cannot even open the real database, while the real role keeps its access:

```bash
sudo -u postgres psql <<'SQL'
REVOKE CONNECT ON DATABASE drquick FROM PUBLIC;
GRANT  CONNECT ON DATABASE drquick TO drquick;
REVOKE CONNECT ON DATABASE drquick_demo FROM PUBLIC;
GRANT  CONNECT ON DATABASE drquick_demo TO drquick_demo;
SQL
```

The real site's role `drquick` owns `drquick` and is granted CONNECT explicitly above, so the site is unaffected; the `postgres` superuser (backups, `docs/postgres-vps.md` step 5) is unaffected too. If any other role connects to `drquick` (check `sudo -u postgres psql -c '\l+ drquick'` before the REVOKE), grant it CONNECT as well. Check afterwards: `psql 'postgres://drquick_demo:<password>@127.0.0.1:5432/drquick' -c 'select 1'` must fail with "permission denied for database".

## 3. A second checkout

```bash
git clone --branch feat/livekit-video <the repo's git URL> /var/www/drquick-demo
```

Use the same URL as the real checkout (`git -C /var/www/drquick remote get-url origin`), and your branch name if it is not `feat/livekit-video` (`demo` if you made one). The site lives in its `website` folder, as on the real copy.

The `--branch` matters. Step 5 runs this checkout's own `scripts/deploy.sh`, and a plain clone checks out `main`, whose script knows nothing of the demo: it would build without the safety checks and listen on every address. The script does switch to `BRANCH` itself, but bash keeps running the script it started with, so the switch comes too late for the script itself.

## 4. The demo's `.env.production`

Create `/var/www/drquick-demo/website/.env.production`. **It must be complete before the first build.** The patient pages are prerendered, so the demo switch and the video settings are baked in when `npm run build` runs. A file missing any of them builds a copy that shows the wrong thing or answers 503.

Names, with where each value comes from (never paste real values into a document or a chat):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_DEMO` | `1` |
| `DEMO_DEPLOYMENT` | `1` |
| `NEXT_PUBLIC_SITE_URL` | `https://demo.drquick.co.uk` |
| `DATABASE_URL` | `postgres://drquick_demo:<the password from step 2>@127.0.0.1:5432/drquick_demo` |
| `DEMO_PASSCODE` | a long generated passcode, see below |
| `DEMO_SESSION_SECRET` | `openssl rand -hex 32` |
| `DOCTOR_SESSION_SECRET` | `openssl rand -hex 32`, a new value, not the real site's |
| `CALL_KEY_SECRET` | `openssl rand -base64 32`, a new value, not the real site's |
| `LIVEKIT_URL` | the `wss://...` address of your LiveKit project |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | from the same LiveKit project (the secret is 32+ characters) |
| `LIVEKIT_CLOUD_TEST_ONLY` | `1`; a production server refuses a `*.livekit.cloud` URL without it |

Rules:

- **The passcode.** At least 16 characters (a shorter one leaves the demo locked with "Demo not configured"). The rate limit counts per address only, so an attacker spread over many addresses is not stopped by it. Use a long generated passcode: four random words, or `openssl rand -base64 12` (16 characters). Share it with the presenter privately (not in a ticket or the repo).
- **No `$` in any value.** Next expands it. Use `openssl rand` output as it is, and check a hand-made passcode for a `$`.
- Use a LiveKit project (or API key) that is not the real site's, so the demo never shares rooms with real calls.
- Do not set a `LIVEKIT_WEBHOOK_*` key or a webhook in LiveKit for this copy. The webhook route stays behind the passcode in the demo (LiveKit would get a 401), and calls work without it.
- Leave out everything else in `.env.example` (Stripe, email, admin accounts). The demo does not use them.
- `chmod 600` the file.

## 5. First deploy

First check the checkout is on the demo branch. This must print nothing:

```bash
cd /var/www/drquick-demo/website
grep -q BIND_LOCAL scripts/deploy.sh || echo "wrong branch: clone again with --branch (step 3)"
```

Then deploy:

```bash
APP_DIR=/var/www/drquick-demo PM2_NAME=drquick-demo PORT=3002 BIND_LOCAL=1 BRANCH=feat/livekit-video \
  bash scripts/deploy.sh
```

- Put your branch name in `BRANCH` (`demo` if you made one), the same one you cloned. The script checks it out in the demo checkout only.
- `BIND_LOCAL=1` marks this as the demo copy. `PORT=3002` is the demo's; port 3000 belongs to another app and 3001 to the real site.
- Before installing anything, the script checks `.env.production` (`scripts/demo-preflight.mjs`). It names each setting that is missing, empty, short, set twice or containing a `$`; a `DATABASE_URL` that is not the demo's own database; a `DATABASE_URL` exported in your shell (the migration would read it before the file); and a stray `.env.local` or `.env.production.local` (Next would read it over `.env.production`). It prints names only, never values. Fix what it names and run the command again: nothing has been installed, migrated or built.
- It then installs, migrates `drquick_demo`, builds, and starts `drquick-demo` under pm2 as `next start -p 3002 -H 127.0.0.1`, so only Caddy can reach it.
- It waits for the app to answer a page request. A healthy demo answers with its redirect to the passcode page; one that answers 503 "Demo not configured" fails the deploy, with the logs shown.
- After the start it checks with `ss` that nothing listens on port 3002 beyond 127.0.0.1. If something does, it stops the app and tells you to `pm2 delete drquick-demo && pm2 save` and deploy again.
- The binding is fixed when pm2 creates the process. If a `drquick-demo` process already exists without `-H 127.0.0.1` (for example from a deploy without `BIND_LOCAL=1`), the script stops before installing anything and tells you to `pm2 delete drquick-demo && pm2 save`, then deploy again.
- To update later, run the same command again with the same variables.

## 6. Caddy

Add this block to the Caddyfile (usually `/etc/caddy/Caddyfile`), next to the real site's:

```
demo.drquick.co.uk {
    reverse_proxy 127.0.0.1:3002
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

Caddy gets the certificate by itself once the DNS record resolves. It sets `X-Forwarded-For`, which the passcode's rate limit uses.

## 7. Check it

From your laptop:

```bash
curl -sI -H 'Accept: text/html' https://demo.drquick.co.uk | head -3               # 307, location: /demo-access
curl -sI https://demo.drquick.co.uk | head -1                                      # 401: not a page request, so no redirect
curl -s  https://demo.drquick.co.uk/api/waitlist -o /dev/null -w '%{http_code}\n'  # 401
curl -s  https://drquick.co.uk/demo-access -o /dev/null -w '%{http_code}\n'        # 404: the real site has no such page
```

On the VPS, the app must listen on loopback only:

```bash
ss -ltn | grep ':3002'     # must show 127.0.0.1:3002, not 0.0.0.0, * or [::]
```

From your laptop, `curl -m3 http://<the VPS IP>:3002` must fail (time out or refuse). If it answers, fix the binding (see step 5) before going on.

Then in Chrome:

1. Open https://demo.drquick.co.uk and enter the passcode. You land on the presenter page.
2. Press **Reset**. This seeds the demo doctor (`demo.doctor@example.com`, prefilled on the sign-in page) and clears earlier state. The presenter presses it again before every run.
3. Do one full run of the run sheet in `docs/demo.md`, including a real video call between two windows, on the laptop the presenter will use. Allow the camera and microphone in the doctor window when asked.
4. Press **Sign out of the demo**: you are back at the passcode page.

If every page answers **503 "Demo not configured"** (the passcode page too), a name in step 4 is missing or wrong, a secret or the passcode is short, `DATABASE_URL` is not the demo's own database, or the app was built before the file was complete. Fix `.env.production` and run the deploy again so it rebuilds. `pm2 logs drquick-demo --lines 40 --nostream` shows the server's side.

## Changing the passcode

Edit `DEMO_PASSCODE` in `/var/www/drquick-demo/website/.env.production`, then:

```bash
pm2 restart drquick-demo --update-env
```

This signs everybody out (each session carries a keyed fingerprint of the passcode) and needs no rebuild. Tell the presenter the new one privately. Changing `DEMO_SESSION_SECRET` the same way also signs everybody out.

## Taking the demo down

```bash
pm2 delete drquick-demo && pm2 save
```

Then remove the `demo.drquick.co.uk` block from the Caddyfile, run `systemctl reload caddy`, and delete the DNS record. To remove the data and the checkout as well, drop the `drquick_demo` database and role in `psql` and delete `/var/www/drquick-demo`. The real site is unaffected by any of this.

## Notes

- The doctor's picture of the patient is a generated illustration, not a camera, so the patient window never asks for one.
- `/_next/static` and `/assets` are served without the passcode, because the passcode page itself needs them. They hold no secrets.
- To run the demo locally instead of on the VPS, see "For the developer" at the end of `docs/demo.md`.
