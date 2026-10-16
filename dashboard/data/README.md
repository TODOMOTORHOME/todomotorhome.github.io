# Contrato de datos – `dashboard/data/`

La **interfaz** del dashboard (`dashboard/index.html`, `dashboard/assets/`) se edita en este repo (Patricio + Claude Code).
Los **datos** de esta carpeta los genera cada semana el recolector de Grok Bot (`collect.py`) y se publican con el commit
`Dashboard: datos semana AAAA-MM-DD`. La corrida semanal **solo** reemplaza los `.json` de esta carpeta y `snapshots/`;
nunca toca `index.html`, `assets/` ni otros archivos (este README tampoco).

**Reglas para cambios de UI**
- No renombrar, mover ni cambiar el formato de estos archivos o campos: el recolector los va a seguir escribiendo así.
- No editar a mano los `.json` (se sobrescriben cada semana). Se pueden *leer* otros campos que existan, pero solo estos están garantizados.
- Fechas `date`: texto `AAAA-MM-DD` en fecha de Argentina. Números: enteros (`null` = sin dato).
- Si hace falta un dato nuevo, pedírselo a Grok Bot: se agrega como campo nuevo, sin romper los existentes.

## Archivos y campos garantizados

| Archivo | Campos |
|---|---|
| `meta.json` | `updated_at` (ISO con −03:00), `updated_label` (texto), `errors` (lista de textos), `dashboard_url` |
| `censo.json` (Censo Rodantero) | `totals.unique_users`, `totals.unique_emails`, `totals.responses`; `daily[]`: `date`, `new_users` (nuevos registrados únicos por día) |
| `ga.json` (Google Analytics) | `daily[]`: `date`, `users`, `new_users`, `sessions`, `page_views`; `periods.{m2,m1,mtd,mtd_prev}`: `start`, `end`, `users`, `sessions`, `page_views` |
| `sharetribe.json` | `totals.users`, `totals.listings`, `totals.transactions`, `totals.inquiries_without_payment`, `totals.listings_by_state.{published,draft,closed}`; `inquiry_rule` (texto); `daily[]`: `date`, `users`, `listings`, `transactions`, `inquiries` (nuevos por día) |
| `mailjet.json` | `lists[]`: `id`, `name`, `total`, `subscribed`, `unsubscribed`, `spam_complaints`, `blocked`, `hard_bounced`, `main` (true = "Base de registrados") |
| `social.json` (Meta) | `status` (`ok` / `stale`), `as_of`, `facebook_page_followers.value`, `instagram_followers.value`, `instagram_followers.username`; `history[]`: `date`, `facebook_page_followers`, `instagram_followers` |
| `manual.json` | `facebook_group_members`: `value`, `as_of`, `rounded`, `history[]`: `date`, `value`, `rounded` |
| `snapshots.json` | lista de `{date, metrics, mailjet_lists}`; `metrics`: `censo_unique_users`, `censo_responses`, `ga_users_last7`, `ga_sessions_last7`, `ga_page_views_last7`, `st_users`, `st_listings`, `st_listings_published`, `st_transactions`, `st_inquiries`, `mj_total`, `mj_subscribed`, `mj_unsubscribed`, `mj_spam`, `mj_blocked`, `fb_page_followers`, `ig_followers`, `fb_group_members` |
| `snapshots/AAAA-MM-DD.json` | una foto semanal con la misma forma que cada elemento de `snapshots.json` |

Otros archivos del sitio que usa el email (no borrar ni renombrar): `assets/todomotorhome-logo.png`
(logo del email semanal, se carga desde `https://patriciobrunoar.github.io/todomotorhome/dashboard/assets/todomotorhome-logo.png`).
