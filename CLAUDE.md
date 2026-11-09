# CLAUDE.md — evento-escoladoreino-arrebatamentos

Context for any Claude Code session working on this repo. Talk to the user in Portuguese (pt-BR);
code, comments and commits stay in English.

## What this is

Capture page for the free live class **"Todos os arrebatamentos da Bíblia"** (Pr. Eduardo Reis,
Mon 2026-11-23 20:00 BRT, live on YouTube) of the Escola do Reino. Cloned from the previous class page
(github.com/edunascimentt/evento-escoladoreino, escatologia.escoladoreino.com): same backend, same pixel.

- Live: https://arrebatamentos.escoladoreino.com (also https://evento-escoladoreino-arrebatamentos.polaris-web.workers.dev)
- Flow: `/` (event page + 3-step form: name → WhatsApp → e-mail + consent) → `/grupo`
  ("Entrar no grupo" WhatsApp button via `/entrar`, plus secondary "save to calendar" buttons:
  Google Calendar link and `/aula.ics`). The live link is posted in the WhatsApp group.
- One Cloudflare Worker (`evento-escoladoreino-arrebatamentos`) serving static files from `public/` and a few
  routes in `src/index.ts`.

## Deploy

- **Push to `main` deploys automatically** (Cloudflare Workers Builds connected to this repo).
  No Cloudflare login is needed to ship a change: edit, commit, push, wait ~1 min, check the site.
- Manual deploy (only for someone logged into the Cloudflare account): `npx wrangler deploy`.
- Never deploy over the Workers `escoladoreinoclub` (the main site escoladoreino.com),
  `escoladoreino` (another project) or `evento-escoladoreino` (previous class).
  This repo only owns `evento-escoladoreino-arrebatamentos`.

## Where things are

| Change | File |
|---|---|
| Texts, sections, form steps of the event page | `public/index.html` |
| Group page (WhatsApp button + calendar) | `public/grupo.html` |
| Look and animations | `public/assets/style.css` |
| Page behaviour (countdown, steps, validation, scroll effects) | `public/assets/app.js` |
| Group page (confetti, group click = CompleteRegistration) | `public/assets/grupo.js` |
| Meta Pixel + event ids | `public/assets/pixel.js` |
| Server: sign-up, CSV, Conversions API `/entrar` group redirect | `src/index.ts` |
| Class name/date ids, pixel id | `wrangler.jsonc` → `vars` |

- Group link: `WHATSAPP_GROUP_URL` in `wrangler.jsonc` (empty = /grupo shows "convite sendo liberado"). Calendar event: `public/aula.ics` + Google link in `public/grupo.html`.
- **Class date/time:** appears in `public/index.html` (`data-countdown="2026-11-23T20:00:00-03:00"`,
  twice, plus visible texts "23 de novembro", "Seg · 23/11 · 20h", "Segunda", ticker, sticky bar),
  `public/grupo.html` (recap list, Google Calendar link), `public/aula.ics` and `AULA_NOME` in `wrangler.jsonc`.

## Data (important)

- Sign-ups are written into the **main site's D1 database** `escoladoreino-club` (shared with
  escoladoreino.com; schema owned by the private repo `edunascimentt/escoladoreinoclub`).
  Each sign-up = a row in `leads` (status `cadastrou`, `landing_path=/aula-todos-arrebatamentos`) + an
  `aula_inscricao` event.
- **Never create, alter or drop tables from this repo.** Never delete leads.
- Leads are visible at https://escoladoreino.com/admin → Leads, and as CSV (this class only) at
  `/admin/inscritos.csv` (HTTP Basic, password = secret `ADMIN_PASSWORD`).

## Secrets (Cloudflare → Worker → Settings → Variables and Secrets; never in the repo)

- `ADMIN_PASSWORD` — CSV export password.
- `META_CAPI_TOKEN` — optional, not set: Meta Conversions API token (pixel 1818933942616750, "Pixel Eduardo Reis").
- Local dev: copy them into `.dev.vars` (gitignored).

## Rules

- This repo is **public**: never commit tokens, passwords, `.dev.vars`, lead data or audio files.
  Design references (event art PNGs) stay local in `referencias/` (gitignored).
- Keep the visual identity: Escola do Reino base (Tawny #DB5500, Poppins + Roboto) plus this event's
  theme `.theme-arreb` in style.css (dark sky art, cream #EDE3D3, Pirata One display, wooden plaque button).
  The owner wants rich, animated pages, never plain ones.
- Every animation must stay off under `prefers-reduced-motion`, and the page must work without JS.
- Test on a phone-sized viewport (390px) before pushing: no horizontal scroll.

## Local dev

```bash
npm install
for f in ../escoladoreinoclub/migrations/*.sql; do npx wrangler d1 execute DB --local --file "$f"; done  # needs the private repo
npx wrangler dev        # http://localhost:8787
npx tsc --noEmit        # typecheck
```

Without the private repo, static pages still render with `npx wrangler dev`; only the sign-up
endpoint needs the tables.
