# Architecture

LA CULPA is a **single-page, single-file application**. `index.html` contains the markup,
styles, and all logic for the frontend. There are only two other runtime files:
the FCM service worker and a static Google verification page.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (mobile-first)                        │
│                                                                      │
│  index.html                                                          │
│  ├─ <style> global theme                                             │
│  ├─ HTML shell: splash / login / #mainApp (7 tabs) / modals          │
│  ├─ <script> main: state, render*(), actions                         │
│  ├─ <style> player                                                   │
│  ├─ <script> player + Drive carousel + birthday widget               │
│  └─ floating widgets + Cónclave overlay                              │
│                                                                      │
│  firebase-messaging-sw.js  ← FCM background handler (service worker) │
└───────────┬───────────────────────────────┬──────────────────────────┘
            │                               │
   public CSV reads                   JSON POST (accion)
            │                               │
            ▼                               ▼
┌────────────────────────┐     ┌──────────────────────────────────────┐
│ Google Sheets (gviz)   │     │ Google Apps Script Web App (/exec)    │
│  Hoja 1 / CULPOSOS /   │◄────│  reads + writes: muro, juntadas,      │
│  PREMIOS               │     │  leyes/cónclave, tokens, plays        │
└────────────────────────┘     └──────────────────────────────────────┘
            ▲
            │ Google Drive API (read photos), Imgur (cover images)
            │
      Firebase Cloud Messaging → push notifications
```

There is no application server owned by this repo. The Apps Script project is external
and its source is not versioned here (see `docs/BACKEND.md`).

---

## Boot sequence

Entry point is `window.onload` (index.html:3944):

1. `initFirebase()` — initializes the Firebase compat SDK and registers an in-app
   `onMessage` handler. Failures are swallowed with `console.warn`.
2. A 3.2s timer removes the splash screen (`#splashScreen`).
3. If `localStorage.culpaUserEmail` exists, it fills the email input and calls `login()`
   automatically.

`login()` (1052) validates the email by fetching the `CULPOSOS` sheet CSV and checking the
address exists, then:

- stores the email in `localStorage`,
- hides `#loginScreen`, shows `#mainApp`,
- calls `loadData()`,
- schedules `pedirPermisoNotificaciones()` after 3s.

`loadData()` (1080) fetches three sheets in parallel (`Hoja 1`, `CULPOSOS`, `PREMIOS`),
parses them with the hand-rolled `parseCSV`/`parseCSVLine`, loads muro interactions
(`cargarInteraccionesJuntadas`), resets history filters, and calls every render function
for the initial paint.

The second script **wraps** `loadData` (4570) so the birthday widget re-initializes after
data is loaded. New post-load initialization should extend this wrapper.

---

## Layers

### 1. Presentation (tabs)

`#mainApp` holds seven `.content` panes, toggled by `showTab(tabName, el)` (3744):

`home`, `ranking`, `juntadas`, `awards`, `calculadora`, `leyes`, `perfil`.

- Only the active pane has the `.active` class; animation is CSS-driven
  (`tabFadeIn`/`tabFadeOut`).
- `showTab('leyes')` also starts the Cónclave polling interval (admin only) and
  `cargarLeyes()`.
- Switching to any other tab clears the polling interval.
- Detail views and forms are **full-screen modals/overlays** that are shown/hidden rather
  than separate routes. The meetup detail (`#juntadaDetalle`) and confirm/edit/propose
  modals live in the DOM; the "new post" and "confirm with photo" modals are created
  dynamically and removed on close.

### 2. State

There is no state container. State is module-level globals in the script's scope plus a
few `window.*` globals shared with the later script tag. Render functions are
**imperative**: they rebuild chunks of `innerHTML` from the current globals.

Key caches:

- `muroPostsCache` — last `get_muro` rows (posts + comments + reactions).
- `window.juntadasInteracciones` — map keyed by `juntada_<fila>`.
- `window._carruselData` — per-meetup Drive photo cache.
- `leyesData`, `conclaveData` — statute and live-vote snapshots.

See `AGENTS.md` for the full inventory.

### 3. Data access

Two distinct paths:

- **Public sheet reads** — `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<name>`
  for `Hoja 1`, `CULPOSOS`, `PREMIOS`. No auth, no `accion`.
- **Apps Script writes/reads** — `fetch(APPS_SCRIPT_URL, { method:'POST', body: JSON.stringify({ accion, ... }) })`.
  Used for the muro, juntadas mutations, leyes/cónclave, tokens, and play counts.

Google Drive photo listing uses the Drive v3 REST API with a public API key. Cover photos
are hosted on Imgur.

There is **no retry, no request queue, and no error boundary**. Failures generally fall
back to `console.error`/`alert`. Optimistic UI is used for reactions, comments, and posts:
the local cache/DOM is updated first, then the backend is called and the muro is
re-fetched.

---

## Cross-cutting flows

### Muro / feed

`cargarMuroHome()` (1769) fetches `get_muro` into `muroPostsCache`. The feed interleaves
recent meetup cards and posts in `renderHome()` by sorting on a computed timestamp.

- Posts: `Tipo` = `post` or `encuesta`, `Destinatario` = `MURO`.
- Comments: `Tipo` = `comentario`, `Destinatario` = the post ID or `post_*` ID.
- Polls: `Opciones` pipe-separated, `Votos` as `email:index` pairs.
- Reactions: `Likes` / `Coronas` are comma-separated email lists; toggle logic lives in
  `reaccionarPost` (2055) and `reaccionarComentario` (1601).

Meetup interactions reuse the same muro table with `Destinatario = juntada_<fila>`
(`getJuntadaId`). `reaccionarJuntada` (1643) lazily creates the interaction row via
`crear_interaccion_juntada`, then re-fetches and applies `reaccionar_post`.

One special case: `cargarMuroHome` silently creates a one-time promotional "Wordle cierre"
post guarded by `localStorage.wordle_cierre_posteado` (index.html:1777–1858). This is
legacy and can be removed if no longer wanted.

### Meetups

- Row index `i` in `juntadasData` maps to sheet row `i + 2`.
- `renderJuntadas` (2192) filters by quorum, sorts desc, groups same-date pairs as
  "doble jornada", and appends records (most/least attended, most/least kings, streaks,
  most active hosts).
- Detail (`renderJuntadaCardHTML` with `modoDetalle=true`) shows attendees, comments,
  reactions, and a Drive carousel loaded lazily via `cargarCarruselDrive` (4208).
- Photo confirmation (`abrirModalSubirFoto` 2564 → `procesarSubirFotoLink` 2628) asks for
  a direct Imgur link and calls `confirmar_juntada_con_foto`.

### Cónclave (live voting)

The admin (`ADMIN_EMAIL`) sees a toggle between proposals and the Cónclave.
`cargarConclave()` (3116) polls `get_conclave` every 4s while the Leyes tab is open
(`showTab`, 3752).

- If the same law is still active, `actualizarVotosEnVivo` (3137) patches only counters,
  bars, avatars, vote buttons, and the advance button — avoiding a full re-render.
- When all voters have voted, `iniciarSuspensoConclave` (3664) plays a Web Audio drum
  roll/gong and a full-screen result overlay, then auto-closes.
- Admin actions: `iniciar_conclave`, `avanzar_ley`, `reset_conclave`, plus a forced
  advance that bypasses the "everyone voted" gate.

### Notifications

- `firebase-messaging-sw.js` handles background messages and click-to-focus.
- Foreground messages go through `messagingInstance.onMessage` →
  `showInAppNotification` (3795), a temporary DOM toast.
- The token is obtained with `messagingInstance.getToken({ vapidKey, serviceWorkerRegistration })`
  and sent to the backend via `guardar_token`. Token registration errors are logged only.

### Media

- Player: hardcoded `songs` array (4052) pointing at a GitHub Release; `registrar_reproduccion`
  increments global/per-song counters.
- Drive carousel: Drive v3 `files` listing by folder ID, thumbnails via
  `lh3.googleusercontent.com/d/<id>=w800`.

### Birthday widget

`initBdayWidget` (4285) computes days until each `CUMPLES` entry. If someone's birthday is
today, `renderBdayHomeCardAnimada` (4371) runs a full-screen sequence: confetti
(`spawnConfetti`), animated award-to-award suspense using `premiosData`, optional
per-person catchphrases (`MENSAJES_ESPECIALES`), and finally an inline home card.

---

## Known weaknesses / risks

These are documented, not necessarily scheduled for fixing:

1. **Stored XSS.** Post/comment/bio/law text is interpolated into `innerHTML` without
   escaping (e.g. `renderPostFeedHTML` 1864, `cargarComentarios` 3855). Posts starting with
   `<` are treated as raw HTML by design (used for the Wordle post). Any authenticated
   member can inject markup/scripts. Fix would require an escape helper plus an allowlist
   for trusted posts.
2. **No real auth.** Email-only login and unauthenticated write endpoints. Anyone who
   knows a member email (or guesses the endpoint) can act as them.
3. **Global namespace.** Hundreds of top-level function/var declarations in one scope;
   accidental collision risk high. `window.*` globals are used to bridge script tags.
4. **No build/type safety/tests.** Refactors cannot be verified automatically.
5. **Massive functions.** `renderHome`, `renderJuntadas`, `renderConclave`, and
   `renderPerfilCulposo` are hundreds of lines of template literals.
6. **External backend is unversioned.** Frontend/backend drift can't be reviewed here.
7. **Polling.** Cónclave polls every 4s; muro only refreshes on explicit actions.
8. **Public client secrets.** See README "Security notes".

## Related docs

- `docs/DATA-MODEL.md` — sheets, columns, derived rules.
- `docs/BACKEND.md` — Apps Script `accion` contract.
- `docs/FEATURES.md` — per-feature behavior and code pointers.
- `AGENTS.md` — editing conventions and smoke test checklist.
