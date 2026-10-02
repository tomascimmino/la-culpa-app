# Backend contract (Google Apps Script)

> **STATUS: DOCUMENTED from the live source.** A redacted reference copy of the Apps
> Script project is committed in [`apps-script/`](../apps-script/). The **live project at
> `script.google.com` remains the source of truth** (it holds the real secrets). See
> `apps-script/README.md` for the redaction/deploy rules.

## Endpoint

```
APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycb.../exec   (index.html:854)
```

- All calls are `POST` with a JSON body: `{ accion, ...payload }`.
- Response is JSON. Success shape: `{ success: true, ...data }`.
  Error shape: `{ success: false, error: string }`.

## Deployment configuration

From `apps-script/appsscript.json`:

| Setting | Value | Meaning |
| --- | --- | --- |
| `timeZone` | `America/Argentina/Buenos_Aires` | All dates formatted with this zone |
| `runtimeVersion` | `V8` | |
| `executeAs` | `USER_DEPLOYING` | The script runs as the deploying (owner) account |
| `access` | `ANYONE_ANONYMOUS` | **Anyone** with the URL can call `doPost`, no Google login |

## Dispatch and authorization

`doPost(e)` parses `e.postData.contents`, opens the spreadsheet by `SHEET_ID`, and routes
on `data.accion` with a chain of `if` blocks. Helpers: `ok(data)`, `err(msg)`.

Two important behaviors:

1. **Unmatched `accion` falls through to attendance confirmation.** This is why
   `confirmarAsistencia` in the frontend can omit `accion` — the tail of `doPost` treats
   any unmatched request with `email` + `fila` as an attendance write. See
   "Attendance (default branch)" below.
2. **Authorization is email-string based, not a session.** Several actions compare
   `data.email` against `ADMIN_EMAIL` (`tomascimmino@gmail.com`) or look up a member named
   `Zabala` in `CULPOSOS`. `access: ANYONE_ANONYMOUS` means these checks are the only
   gate and the email is client-supplied (spoofable).

## Sheets used by the backend

| Sheet | Purpose |
| --- | --- |
| `Hoja 1` | Meetups (columns detailed in `docs/DATA-MODEL.md`) |
| `CULPOSOS` | Member roster (`Nombre`, `Email`, `Bio`, …). A legacy `FCMToken` column may exist but is **no longer read** — tokens live in `TOKENS`. |
| `COMENTARIOS` | Muro: posts, polls, comments, meetup interactions |
| `LEYES` | Statute proposals + per-voter columns + vote totals |
| `TOKENS` | FCM tokens (`Email`, `Token`, `Fecha`), **one row per (email, token)** so multiple devices per person work. Created on demand. |
| `REPRODUCCIONES` | Song play counts (`Canción`, `Count`, `Fecha`), created on demand |
| `WORDLE` | Wordle results (backend-only; current frontend does not call it) |

`PREMIOS` is **not** touched by the backend; the frontend reads it directly.

---

## Action catalogue

### Meetups (`Hoja 1`)

| `accion` | Request | Behavior / response |
| --- | --- | --- |
| `crear_juntada` | `{ fecha:'d/m/yyyy', host, descripcion, categoria, hora }` | Finds the last non-empty row in column A, appends: col1 fecha, col2 host, col19 descripción, col20 categoría, col24 hora; clears data validations on cols 3–17; sends a "nueva juntada" push; creates a Drive folder and stores its ID in col23. → `{ success, mensaje, fila }` |
| `editar_juntada` | `{ fila, fecha, host, descripcion, categoria, hora }` | Overwrites cols 1, 2, 19, 20, 24. → `{ success, mensaje }` |
| `eliminar_juntada` | `{ fila }` | `deleteRow(fila)`. → `{ success, mensaje }` |
| `cargar_foto_juntada` | `{ fila, foto }` | Sets col22 = foto; if col25 empty, sets it to `CONFIRMADA`. **Not called by the current frontend.** |
| `confirmar_juntada_con_foto` | `{ fila, fotoUrl }` | Sets col22 = fotoUrl only (does *not* set the col25 marker). → `{ success, mensaje }` |

### Attendance (default branch)

There is **no `accion`** for this. Any request that reaches the tail of `doPost` is handled
here. Payload: `{ email, fila, asistira?:boolean, valor?:1|2 }`.

1. Finds the member by `email` in `CULPOSOS` to get their `Nombre`.
2. Finds the matching column in `Hoja 1` headers (a column named after the member) and
   writes `valor` (or `asistira ? 1 : 2`).
3. Quorum side-effect: counts the 8 original kings
   (`Mateo, Rama, Tirri, Toti, Toto, Caamaño, Zabala, Santi`) confirmed as
   `TRUE`/`'TRUE'`/`✓`/`true`/`1`/`'1'`. If ≥ 4: creates the Drive folder (col23) only if
   col23 is empty, and — independently of the folder — if col25 does **not** already
   contain `QUORUM_NOTIF_SENT`, sets that marker and sends the quorum push.

→ `{ success, mensaje:'Confirmación guardada' }`.

### Muro (`COMENTARIOS`)

Column layout: `[0]ID · [1]Destinatario · [2]Autor · [3]Texto · [4]Fecha · [5]Likes ·
[6]Coronas · [7]Tipo · [8]ID2 · [9]Opciones · [10]Votos`.
Row ID resolution: `getIdFila(row) = row[8] || row[0]`.

| `accion` | Request | Behavior / response |
| --- | --- | --- |
| `crear_post` | `{ autor, texto }` | Appends a `post` row with id `post_<timestamp>`, `Destinatario=MURO`. → `{ success, id }` |
| `crear_encuesta` | `{ autor, pregunta, opciones:[..] }` | Requires ≥ 2 options; joins with `|` in col9; id `enc_<timestamp>`, `Tipo=encuesta`. → `{ success, id }` |
| `votar_encuesta` | `{ id, email, opcionIdx }` | Replaces that email's vote in col10 (`email:idx` pairs). → `{ success, votos }` |
| `comentar_post` | `{ postId, autor, texto }` | Appends a `comentario` row (id `com_<timestamp>`). Sends push notifications, via `getTokensDe(email)` (all of the recipient's devices): to the profile owner if `postId` is a member name; to the post author if `postId` is a post/poll; to other commenters if `postId` starts with `juntada_`. → `{ success, id }` |
| `comentar` | `{ destinatario, autor, texto }` | Legacy profile comment. Appends a `comentario` row. → `{ success, mensaje }` |
| `reaccionar_post` / `reaccionar_comentario` / `likear_comentario` | `{ id, tipo:'like'\|'corona', email }` | All three route to `toggleReaccion_(id, email, tipo)`, which toggles the email in col5 (`like`) or col6 (`corona`). `likear_comentario` is legacy and forces `tipo='like'`. → `{ success }` |
| `crear_interaccion_juntada` | `{ juntadaId, tipo, email }` | Creates the interaction row id `juntadaId + '_reac'`, `Tipo=juntada`, only once. → `{ success }` |
| `eliminar_post` | `{ id, email }` | Deletes the post row (author or admin only) and all its comments. → `{ success }` |
| `eliminar_comentario` | `{ id, email }` | Deletes one comment (author or admin only). → `{ success, mensaje }` |
| `get_muro` | `{}` | Returns all rows as `{ ID, Destinatario, Autor, Texto, Fecha, Likes, Coronas, Tipo, Opciones, Votos }` (ID2 collapsed into `ID`). → `{ success, rows }` |

> `eliminar_post` permission check compares the row author to `data.email`, then allows the
> admin. Comment cleanup matches by `Destinatario` or `ID2`.

### Laws / Cónclave (`LEYES` + Script Properties)

| `accion` | Request | Behavior / response |
| --- | --- | --- |
| `proponer_ley` | `{ nombre, titulo, descripcion }` | Max **3** proposals per `nombre`; appends `[nombre, titulo, descripcion, timestamp]`. → `{ success, mensaje }` |
| `get_leyes` | `{}` | → `{ success, leyes:[{ nombre, titulo, descripcion, timestamp }] }` |
| `get_conclave` | `{}` | Reads properties `conclave_iniciado` / `conclave_ley_activa`; builds votes for the 15 `VOTANTES` from cols 5–19, totals from cols 20–22. → `{ success, leyes, leyActiva, iniciado }` |
| `iniciar_conclave` | `{ email }` | Allowed for `ADMIN_EMAIL`, `agustin.zabala.731@gmail.com`, or any member named `Zabala`. Sets `conclave_iniciado=true`, `conclave_ley_activa=0`. → `{ success, mensaje }` |
| `votar_ley` | `{ nombre, voto:1\|2\|3, leyIndex }` | Writes the vote in the voter's column, recounts, updates totals (cols 20/21/22). → `{ success, favor, contra, abstenciones, totalVotos }` |
| `avanzar_ley` | `{ email }` | Allowed for admin or `Zabala`. Increments `conclave_ley_activa`. → `{ success, leyActiva }` |
| `reset_conclave` | `{ email }` | **Admin only.** Deletes properties and clears vote/total columns (5–22). → `{ success, mensaje }` |

Vote codes: `1` favor, `2` contra, `3` abstención. `VOTANTES` (15): the 8 kings + 6 queens
+ `Matu`.

### Reproducciones (`REPRODUCCIONES`)

| `accion` | Request | Behavior / response |
| --- | --- | --- |
| `registrar_reproduccion` | `{ cancion }` | Increments the song count (creates the row if needed) and stores the timestamp. → `{ success, reproducciones }` |
| `get_reproducciones` | `{}` | → `{ success, total, canciones:[{ cancion, reproducciones }] }` |

### Profile / FCM tokens

| `accion` | Request | Behavior / response |
| --- | --- | --- |
| `guardar_bio` | `{ email, bio }` | Finds the member by email in `CULPOSOS` and writes the `Bio` column. → `{ success }` or `err('Columna Bio no existe')` |
| `guardar_token` | `{ email, token }` | Appends the device token in `TOKENS` if the `(email, token)` pair is new, else just refreshes `Fecha`. Multiple devices per person are kept. → `{ success }` |

### Wordle (backend-only, unused by the current frontend)

`guardar_wordle`, `get_wordle_dia`, `get_wordle_historial` operate on the `WORDLE` sheet.
They are present in the backend but **not called** by `index.html` today (the frontend
only shows a static Wordle summary post). Kept for a future/removed feature.

---

## Server-side helpers

- **Tokens:** `getTokens()` returns all unique tokens, `getTokensDe(email)` the tokens of
  one member, `guardarToken(email, token)` upserts a `(email, token)` pair and
  `eliminarToken_(token)` prunes a row. All notification reads go through these — the old
  `CULPOSOS.FCMToken` column is no longer used.
- **FCM:** `getFcmAccessToken()` signs a JWT with the service-account private key and
  exchanges it for an OAuth token (cached in memory across a batch);
  `enviarNotificacion(token, title, body)` posts a **data-only** message to the FCM v1 API
  (`data: { title, body }`, no `notification` field — the service worker renders it, which
  avoids double notifications). On HTTP 404 / `UNREGISTERED` it prunes the token.
  `enviarNotificacionNuevaJuntada` and `enviarNotificacionQuorum` broadcast to every token.
- **Diagnostics:** `diagnosticoTokens()` logs token counts only (no sends); safe to run from
  the editor to verify registrations.
- **Drive:** `crearCarpetaJuntada(fecha, descripcion)` creates `Mes/<d-m-yyyy descripcion>`
  under `DRIVE_FOTOS_ROOT` and sets `ANYONE_WITH_LINK` + `EDIT` sharing. Returns the folder
  ID. Utilities `arreglarCarpetasAnteriores()` and `diagnostico()` exist for maintenance.

## Triggers (functions present; installed triggers not exported by clasp)

| Function | Likely trigger |
| --- | --- |
| `verificarQuorumYNotificar` | Scheduled — notifies once per meetup row when kings reach 4 |
| `recordatorioJuntadaHoy` | Scheduled — "today's meetup" reminder |
| `limpiarJuntadasSinQuorum` | Scheduled — deletes past meetups with fewer than 4 attendees |

> **TODO:** verify the actual installed triggers and their schedules in the Apps Script
> editor (clock icon). They are project metadata and cannot be pulled with `clasp`.

## Read-only Sheet endpoints (not Apps Script)

| What | Used by |
| --- | --- |
| `.../gviz/tq?tqx=out:csv&sheet=Hoja%201` | `loadData`, `recargarJuntadas` |
| `.../gviz/tq?tqx=out:csv&sheet=CULPOSOS` | `loadData`, `login` |
| `.../gviz/tq?tqx=out:csv&sheet=PREMIOS` | `loadData` |

## Other external endpoints

| Service | Used by |
| --- | --- |
| Drive v3 `files` listing (public API key) | `cargarCarruselDrive` (4214) |
| Imgur `api.imgur.com/3/image` | `subirFotoImgur` (928) — **unused**; manual link flow is used instead |

## Open items

- [ ] Verify installed triggers/schedules in the editor.
- [ ] Confirm whether `Hoja 1` column 18 is `N° Asist` (frontend reads it by header name).
- [ ] Consider moving `SA_PRIVATE_KEY` / `SA_CLIENT_EMAIL` to Script Properties and
      rotating the service-account key (the raw key exists in the live project and in the
      maintainer's local backup; it must never reach git).
- [ ] Re-deploying can change the `/exec` URL hardcoded in `index.html:854`; coordinate
      any deployment change.
