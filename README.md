# Evento Escola do Reino — aula "Todos os arrebatamentos da Bíblia"

Sign-up page for the free live class with Pr. Eduardo Reis (Tue 2026-11-10 20:00 BRT, live on YouTube).
Flow: `/` (event page + stepped form) → `/grupo` (button to the WhatsApp group, where the class link is sent).

- Worker `evento-escoladoreino-arrebatamentos` — https://arrebatamentos.escoladoreino.com
  (also https://evento-escoladoreino-arrebatamentos.polaris-web.workers.dev). See CLAUDE.md for the full guide.
- Same backend as the previous class page (github.com/edunascimentt/evento-escoladoreino): writes into the
  **same D1 as escoladoreino.com** (`escoladoreino-club`): each sign-up is a `leads` row (status `cadastrou`,
  `landing_path=/aula-todos-arrebatamentos`) + an `aula_inscricao` event; clicks on the group button add an
  `aula_grupo` event. They show up in escoladoreino.com/admin → Leads. This project never alters tables.
- Same person (WhatsApp or e-mail) already in `leads` is updated, never duplicated.
- CSV of this class only: `/admin/inscritos.csv` (HTTP Basic, any user, password = secret `ADMIN_PASSWORD`).
- Meta Pixel 1818933942616750 (same as the site and the previous class) + Conversions API (secret `META_CAPI_TOKEN`).

## WhatsApp group link

Set `WHATSAPP_GROUP_URL` in `wrangler.jsonc` (must start with `https://chat.whatsapp.com/`), commit, push.
Until then `/grupo` shows "convite sendo liberado" and re-checks every 30 s.

## Local

```bash
npm install
for f in ../escoladoreinoclub/migrations/*.sql; do npx wrangler d1 execute DB --local --file "$f"; done
npx wrangler dev   # .dev.vars: ADMIN_PASSWORD=...
```
