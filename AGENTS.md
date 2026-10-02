# AGENTS.md — Guide for AI coding agents

This file is the fastest way to become productive in this repo. Read it before editing.
Line numbers refer to `index.html` at the time of writing; **always verify with a quick
grep for the function name** since the file is edited by hand and numbers drift.

## TL;DR

- The entire app is **one file: `index.html`** (~4,600 lines). No build, no framework,
  no npm, no tests. Edit it directly.
- Backend is an **external Google Apps Script Web App**. Its source is **not in this
  repo**. Never assume/rewrite server logic; only call it through `APPS_SCRIPT_URL` with
  an `accion` field.
- Data comes from a **public Google Sheet** via the `gviz/tq?tqx=out:csv` endpoint.
- The app is Spanish-language and full of inline styles and inline `onclick` handlers.
  Match that style; do not introduce modules, bundlers, or CSS files.
- Validate changes manually (no test runner). See "Smoke test checklist" below.

## File map of `index.html`

| Lines | Section | Notes |
| --- | --- | --- |
| 1–11 | `<head>`, meta, PWA manifest (base64 data URI) | |
| 12–632 | Global CSS (`<style>`): theme vars, tabs, cards, ranking, animations, Cónclave | |
| 633–635 | Firebase compat SDK CDN scripts | |
| 636–850 | HTML shell: splash, login, `#mainApp`, 7 tabs, modals, overlays | |
| 852–3954 | Main `<script>`: config, data load, all render + action functions | |
| 3958–4048 | Player CSS (`<style>`) | |
| 4048 | `<audio id="player">` | |
| 4050–4575 | Player + Drive carousel + birthday widget `<script>` | |
| 4579–4611 | Floating widgets (`#bdayWidget`) and Cónclave overlay markup | |

Key anchor functions (grep these; approximate lines):

- Config/dictionaries: `SHEET_ID` (853), `APPS_SCRIPT_URL` (854), `ADMIN_EMAIL` (855),
  `CULPOSOS_HOSTS`/`CATEGORIAS` (857), `FOTOS` (879), `DRIVE_FECHAS` (890),
  `GUARIDA_HOST` (961), `REYES`/`REINAS` inline in `renderContadorAsistencia` (1144) and
  `puedeConfirmarJuntada` (1002).
- Auth/data: `login` (1052), `logout` (1071), `loadData` (1080), `parseCSV` (1101),
  `parseCSVLine` (1130), `recargarJuntadas` (2538), `getUsuarioActual` (982).
- Helpers: `parseFecha` (985), `esHostDe` (970), `tieneQuorum` (979),
  `esConfirmadoPositivo/Negativo` (1027–1029), `calcularRacha` (1030),
  `calcularRachaHistorica` (1039), `getDriveLink` (902), `getJuntadaId` (1563),
  `getRegistroId` (1565), `getReacciones` (1576), `formatFechaPost` (1982).
- Home/feed: `renderHome` (1196), `renderJuntadaCardHTML` (1421),
  `renderContadorAsistencia` (1144), `abrirModalNuevoPost` (1717),
  `cargarMuroHome` (1769), `renderPostFeedHTML` (1864), `publicarPost` (2003),
  `votarEncuesta` (2041), `reaccionarPost` (2055), `comentarPost` (2091),
  `eliminarPost` (2141).
- Meetups: `renderJuntadas` (2192), `verDetalleJuntada` (2400), `eliminarJuntada` (2414),
  `abrirModalEditarJuntada` (2423), `abrirModalConfirmar` (2467),
  `confirmarAsistencia` (2525), `abrirModalProponerJuntada` (2543),
  `abrirModalSubirFoto` (2564), `procesarSubirFotoLink` (2628), `enviarPropuesta` (2718).
- Ranking/profile/awards: `renderRanking` (2159), `renderPerfilCulposo` (2753),
  `renderHostPanel` (2826), `verPerfilCulposo` (2845), `renderAwards` (2854).
- Calculator: `agregarGasto`/`renderGastos`/`calcularDivision`/`compartirResultado`
  (2877–3057).
- Laws/Cónclave: `cargarLeyes` (3093), `cargarConclave` (3116),
  `actualizarVotosEnVivo` (3137), `renderConclave` (3317), `renderVotoBtns` (3484),
  `votarConclave` (3502), `avanzarLeyConclave` (3553), `iniciarConclave` (3590),
  `resetConclave` (3599), `iniciarSuspensoConclave` (3664), `enviarLey` (3725).
- Navigation/notifs: `showTab` (3744), `FIREBASE_CONFIG` (3775),
  `initFirebase` (3783), `activarNotificaciones` (3824), `cargarComentarios` (3855),
  `enviarComentario` (3891), `window.onload` (3944).
- Media/birthdays: `songs` (4052), `togglePlay` (4082), `registrarReproduccion` (4095),
  `cargarCarruselDrive` (4208), `CUMPLES` (4267), `initBdayWidget` (4285),
  `renderBdayHomeCardAnimada` (4371), `spawnConfetti` (4549).

## Conventions (follow these, do not "modernize")

- **Single file, no modules.** Function declarations at script top level; they are
  implicitly global. HTML calls them via `onclick="fnName(...)"`.
- **Inline styles everywhere.** Most rendering is template literals with `style="..."`.
  Do not move to classes unless the change is scoped and intentional.
- **Spanish identifiers, UI text, and comments.** Keep them (`juntadas`, `culposos`,
  `racha`, `guarida`, `reaccionar`).
- **Optimistic UI.** Reactions/comments/posts mutate local caches and DOM first, then
  call the backend. Follow that pattern.
- **HTML strings via `innerHTML`.** Be careful: user content is interpolated without
  escaping (see Known issues).
- **Escape single quotes** when interpolating IDs into `onclick` attributes
  (existing code uses `.replace(/'/g, "\\'")`).
- **No comments unless meaningful.** Existing code has sparse comments; don't decorate.

## Global state inventory

Declared once and shared across all render functions:

| Variable | Meaning |
| --- | --- |
| `currentUser` | Logged-in email (lowercase) or `null` |
| `juntadasData` | Array of meetup rows (`Hoja 1`) |
| `culpososData` / `window.culpososData` | Member rows (`CULPOSOS`) |
| `premiosData` / `window.premiosData` | Award rows (`PREMIOS`) |
| `muroPostsCache` | Posts/comments/reactions from `get_muro` |
| `window.juntadasInteracciones` | Map `juntada_<row>` → `{likes, coronas, comentarios, interaccionID}` |
| `window._comentariosCache` | Raw rows from last `get_muro` |
| `window.juntadasMesActivo`, `window.juntadasVerMas`, `window.juntadasDesde/Hasta/CatActiva/HostActivo/AsistenteActivo` | History filters |
| `window._pollVoting` | Set of post IDs currently voting |
| `window._carruselData` | Map `ri` → `{fotos, idx}` for Drive carousels |
| `leyesData`, `conclaveData`, `leyesVistaAdmin`, `conclavePollingInterval`, `conclaveSuspensoDisparado` | Laws/Cónclave state |
| `gastosArray`, `invitadosExtras` | Expense calculator state |
| `currentIndex`, `reproData`, `yaContado` | Player state |

`loadData` is **wrapped** at the end of the second script (4570) so the birthday widget
re-initializes after data loads. If you add post-load initialization, wrap it the same way
or extend that wrapper.

## Backend contract rules

- All calls are `fetch(APPS_SCRIPT_URL, { method:'POST', body: JSON.stringify({ accion, ... }) })`
  except the public CSV reads against the Sheet.
- Expected response shape is generally `{ success: boolean, error?: string, ...data }`.
- See `docs/BACKEND.md` for the full list of `accion` values and payloads. It is a TODO
  skeleton because the Apps Script source is external.
- **Do not invent new `accion` values** unless you can also add them to the Apps Script
  project; the frontend alone cannot change server behavior.
- Row addressing: meetup row index `i` maps to sheet row `i + 2` (header is row 1). This
  appears as `fila: index + 2` in edit/delete/confirm calls.

## Data gotchas

- `parseFecha` accepts `d/m/yyyy`, `yyyy-mm-dd`, and `yyyy/mm/dd`/fallbacks. Keep it.
- Confirmation values are inconsistent: positive = `TRUE`, `✓`, `1`, `1`; negative =
  `FALSE`, `✗`, `2`, `2`. Always use `esConfirmadoPositivo` / `esConfirmadoNegativo`.
- Quorum = at least 4 of the 8 original `REYES`. Meetups below quorum are `_informal`
  (shown in feed, excluded from stats/ranking).
- Record IDs are dual-format: legacy `ID` (timestamp) and newer `ID2` (`post_*`, `com_*`,
  `juntada_*`). Always resolve via `getRegistroId`.
- `getJuntadaId(ri)` = `'juntada_' + (ri + 2)` links a card to its interaction row.
- Photos: newest flow asks the user to paste an Imgur link manually. `subirFotoImgur`
  exists but is unused and its Client-ID is a placeholder.

## Editing guidelines

1. Search for the function you are changing; do not rely on line numbers in this doc.
2. Keep changes inside the existing script; avoid adding new `<script>` tags unless there
   is a strong reason.
3. When adding UI, mirror the surrounding template-literal style and color tokens
   (`--gold`, `--purple-*` in `:root`).
4. If you touch shared helpers, grep for every caller.
5. Never commit secrets; if you must add config, ask first. The existing keys are
   client-public by design (see README security notes).

## Smoke test checklist (manual, no test suite)

Run `python3 -m http.server 8080`, open in a mobile-sized viewport, and verify:

1. Splash shows ~3.2s, then login. Enter a known email from `CULPOSOS`; session persists
   after reload via `localStorage`.
2. Home loads stats, next meetup, agenda, feed, and the player (play/pause, next/prev,
   volume, seek).
3. Confirm attendance for a future meetup, then edit the response.
4. Open a past meetup detail: info, attendees, reactions, comments, Drive carousel.
5. Ranking, Juntadas (filters + "ver más"), Awards (year switch), Perfil (own + other).
6. Calculator: add an expense, toggle consumers, calculate, share text to WhatsApp.
7. Laws: propose a statute (up to 3). As admin, open the Cónclave, vote, advance, reset.
8. Birthday widget opens; if someone's birthday is today, verify the animated sequence.
9. Check the console for errors; verify each `fetch` returns `success`.
