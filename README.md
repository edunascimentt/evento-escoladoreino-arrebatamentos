# Evento Escola do Reino — aula "Todos os arrebatamentos da Bíblia"

Sign-up page for the free live class with Pr. Eduardo Reis (Tue 2026-11-10 20:00 BRT, live on YouTube).
Flow: `/` (event page + stepped form) → `/grupo` (WhatsApp group button via `/entrar`, plus save-to-calendar buttons).
Group link: `WHATSAPP_GROUP_URL` in `wrangler.jsonc`.

- Worker `evento-escoladoreino-arrebatamentos` — https://arrebatamentos.escoladoreino.com
  (also https://evento-escoladoreino-arrebatamentos.polaris-web.workers.dev). See CLAUDE.md for the full guide.
- Same backend as the previous class page (github.com/edunascimentt/evento-escoladoreino): writes into the
  **same D1 as escoladoreino.com** (`escoladoreino-club`): each sign-up is a `leads` row (status `cadastrou`,
  `landing_path=/aula-todos-arrebatamentos`) + an `aula_inscricao` event. They show up in escoladoreino.com/admin → Leads. This project never alters tables.
- Same person (WhatsApp or e-mail) already in `leads` is updated, never duplicated.
- CSV of this class only: `/admin/inscritos.csv` (HTTP Basic, any user, password = secret `ADMIN_PASSWORD`).
- Meta Pixel 1818933942616750 (same as the site and the previous class) + Conversions API (optional secret `META_CAPI_TOKEN`, not set).

## Calendar

`public/aula.ics` and the Google Calendar link in `public/grupo.html` carry the class date (2026-11-10 23:00 UTC).

## Local

```bash
npm install
for f in ../escoladoreinoclub/migrations/*.sql; do npx wrangler d1 execute DB --local --file "$f"; done
npx wrangler dev   # .dev.vars: ADMIN_PASSWORD=...
```
