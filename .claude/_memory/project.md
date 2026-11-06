# evento-escoladoreino-arrebatamentos (project memory)

- 2026-11-06: Second class capture page, cloned from ../eventoescoladoreino1 (escatologia.escoladoreino.com).
  Class "Todos os arrebatamentos da Bíblia", Pr. Eduardo Reis, Tue 2026-11-10 20h, YouTube live.
  User asked: same backend (shared D1 escoladoreino-club), same pixel, same everything; new GitHub repo,
  new Cloudflare Worker, subdomain like the old one with another word: arrebatamentos.escoladoreino.com.
- Visual identity comes from the event art (referencias/, gitignored): dark sky, wooden "CLIQUE AQUI PARA
  PARTICIPAR" plaque button, blackletter display font (Pirata One). Theme lives in style.css under `.theme-arreb`.
- AULA_SLUG aula-todos-arrebatamentos. No WhatsApp group (owner, 2026-11-06): /grupo = confirmation + calendar; WHATSAPP_GROUP_URL unused.
- Topic cards copy (Enoque, Elias, Filipe, Paulo, Igreja, duas testemunhas) is a draft by Claude; confirm with the team.
- 2026-11-06: Repo github.com/edunascimentt/evento-escoladoreino-arrebatamentos (public). Workers Builds connected
  (branch main, `npx wrangler deploy`). ADMIN_PASSWORD secret = same as the previous class. META_CAPI_TOKEN not set (optional; owner doesn't have one).
