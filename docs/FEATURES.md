# Features

Per-feature behavior with code pointers into `index.html`. Line numbers drift; grep the
function name. Data shapes are in `docs/DATA-MODEL.md`; backend actions in
`docs/BACKEND.md`.

---

## 1. Splash, login and session

- **Splash** (`#splashScreen`, 640) is a full-screen animated logo shown for 3.2s, then
  faded out and removed by `window.onload` (3944).
- **Login** (`login`, 1052) takes an email, fetches the `CULPOSOS` CSV, and accepts it only
  if a member row has a matching `Email` (case-insensitive). On success it persists the
  email in `localStorage.culpaUserEmail`, hides the login screen, shows `#mainApp`, calls
  `loadData()`, and schedules `pedirPermisoNotificaciones()` after 3s.
- **Auto-login:** `window.onload` restores the saved email and logs in automatically.
- **Logout** (`logout`, 1071) clears the key and shows the login screen again.

Limitations: no password, OTP, or server session. Anyone knowing a member email can log in.

---

## 2. Home, agenda and the feed (muro)

### Home summary

`renderHome` (1196) partitions `juntadasData` into future and past meetups:

- Past + quorum → counted as official (`juntadasOficiales`).
- Past + below quorum → flagged `_informal` (shown in feed, excluded from stats).
- Future without photo → agenda.

It fills two stat cards (total official meetups, personal attendance %) and builds:

- **Next meetup card** (1277) with an attendance counter, confirm/edit buttons, and a
  "confirm with photo" button when `puedeConfirmarJuntada` (1002) is true.
- **Agenda** (1300) — collapsible cards for subsequent future meetups with per-user status
  badges, confirm, and host/admin edit/delete.
- **Propose meetup** button (1359) → `abrirModalProponerJuntada` (2543).
- **"que procede, loko?"** composer → `abrirModalNuevoPost` (1717).
- **Feed** — recent meetups (`renderJuntadaCardHTML`, 1421) and posts/polls
  (`renderPostFeedHTML`, 1864) merged and sorted by timestamp (1378–1400).

### Posts and polls

- `abrirModalNuevoPost` (1717) creates a dynamic modal; `toggleEncuestaFields` (1754)
  reveals poll option inputs.
- `publicarPost` (2003) sends `crear_post` or `crear_encuesta`. Polls require ≥ 2 options.
- `votarEncuesta` (2041) sends `votar_encuesta`; results are inline bar charts with
  percentages shown once the user has voted (1941–1955).
- `reaccionarPost` (2055) toggles like/crown **optimistically** on `muroPostsCache`, then
  calls `reaccionar_post` and re-fetches.
- Comments: `comentarPost` (2091) injects the comment into the DOM immediately, posts
  `comentar_post`, and syncs in the background. `eliminarPost` (2141) and
  `eliminarComentarioMuro` (2077) are available to the author and admin.
- Reaction UI for posts/comments is shared via `renderCommentReactionButtons` (1580) →
  `reaccionarComentario` (1601).

Limitation: post/comment text is inserted with `innerHTML` and not escaped (stored XSS).

### Meetup interactions in the feed

`cargarInteraccionesJuntadas` (1621) builds `window.juntadasInteracciones` from `get_muro`
rows whose `Destinatario` starts with `juntada_`. Likes/crowns map to the same
`reaccionar_post` backend, but the first reaction lazily creates the row via
`crear_interaccion_juntada` (1643).

### Legacy: Wordle closing post

`cargarMuroHome` (1769) auto-creates one promotional post on first run, guarded by
`localStorage.wordle_cierre_posteado` (1777–1858). It is hardcoded HTML and can be removed
if no longer desired.

---

## 3. Ranking

`renderRanking` (2159) sorts `culpososData` by `Porcentaje` desc and renders a shield-styled
card per member (top 3 are highlighted, #1 gets a crown SVG). It shows streak badges from
`calcularRacha` (1030): ⚡ at ≥ 5, 🔥 at ≥ 10, plus a 👑 badge at 100%. Clicking a member
opens their profile via `verPerfilCulposo` (2845).

---

## 4. Juntadas (meetup history)

`renderJuntadas` (2192) is the largest view:

- **Banner** (2207) with the logged-in user's total attendance and a motivational message.
- **Filters** (2219): month selector built from observed months, plus date-range / category
  / host / attendee filters held in `window.juntadas*`.
- **Cards**: up to 10 by default, "Ver más" expands. Same-date meetups are grouped under a
  "⚔ DOBLE JORNADA ⚔" divider (2263–2278).
- **Records** (2303–2378): most/least attended, most/least kings, current and historical
  streak leaders, and most active venues.
- **Motivational card** per current filter (2290).

### Detail view

`verDetalleJuntada` (2400) renders `renderJuntadaCardHTML(..., modoDetalle=true)` into
`#juntadaDetalle`: photo, badges, attendee grid (click → profile), reactions, comments, and
a lazy Drive carousel.

### Confirm / edit / delete

- `abrirModalConfirmar` (2467) shows quorum status and lets the user respond;
  `confirmarAsistencia` (2525) writes the sheet row and refreshes.
- `abrirModalEditarJuntada` (2423) → `enviarEdicion` (2449) sends `editar_juntada`.
- `confirmarEliminar` (2409) → `eliminarJuntada` (2414) sends `eliminar_juntada`.
- Permission model: **hosts** can edit/delete upcoming meetups; **admin** can edit/delete
  past ones (`renderJuntadaCardHTML`, 1455–1457).

### Propose

`abrirModalProponerJuntada` (2543) → `enviarPropuesta` (2718) sends `crear_juntada` and
reloads the page on success.

### Photo confirmation

`abrirModalSubirFoto` (2564) asks for a direct Imgur link (with live preview). On confirm,
`procesarSubirFotoLink` (2628) sends `confirmar_juntada_con_foto` and reloads the meetup
data. The unused `subirFotoImgur` (928) upload helper has a placeholder Client-ID.

---

## 5. Awards

`renderAwards` (2854) filters `premiosData` by the year `<select>` (hardcoded 2023–2025):

- **CULPOSO DE ORO** — large hero card.
- **Individual prizes** (`Tipo:'Persona'`) — clickable rows → profile.
- **Best meetups** (`Tipo:'Juntada'`).

Also renders a Drive link per year from a hardcoded `driveLinks` map (2866):
`2024` and `2025` folders. Note the year options and Drive map must be updated manually
for new years.

---

## 6. Calculator (Cuentas)

State: `gastosArray` and `invitadosExtras` (2877–2882).

- Add/remove guests (`agregarInvitado` / `quitarInvitado`); guests participate like members.
- Add expenses with payer, concept, amount, and consumers (`renderGastos`, 2886).
- `calcularDivision` (2900) computes per-person balances, prioritizes **couple-to-couple**
  settlements using `PAREJAS` (2925), then settles the remainder greedily.
- Results show total, transfers, and transfer aliases (`getAlias`).
- `compartirResultado` (2983) builds a WhatsApp message (with aliases) and opens
  `api.whatsapp.com/send?text=...`.

Edge cases: rounds/ignores balances under $1; all fields are required to calculate.

Limitation: the couple map and participant list are hardcoded; a new member must be added
to `TODOS_NOMBRES` (2878).

---

## 7. Laws (Ley) and the Cónclave

### Proposals

`renderLeyes` (3228) / `renderLeyesConToggle` (3271):

- Any member may propose up to 3 statutes (`misProps < 3`); `enviarLey` (3725) sends
  `proponer_ley` with `{ nombre, titulo, descripcion }`.
- Proposals are listed; a member sees their own marked "tuya".
- Admin (and member `Zabala`) also see the full list of proposals.

### Cónclave

Admin-only experience driven by `get_conclave` polling every 4s (`showTab`, 3752):

- `renderConclave` (3317) has three states: not started, active, and finished.
- Active view shows the current law card, live vote bars, voter avatars, and vote buttons
  (`renderVotoBtns`, 3484).
- `votarConclave` (3502) sends `votar_ley` with codes 1/2/3 after a deliberate 900 ms
  suspense delay and optimistic avatar highlight.
- `actualizarVotosEnVivo` (3137) patches the DOM on each poll (no full re-render) and
  triggers the result sequence when voting completes.
- `avanzarLeyConclave` (3553) sends `avanzar_ley` and animates the slide transition.
- `iniciarConclave` (3590) / `resetConclave` (3599) control the session.
- `iniciarSuspensoConclave` (3664) plays a Web Audio drum roll (`tocarRedobleConclave`,
  3638) and gong (`tocarGongConclave`, 3651), then shows the APPROVED/REJECTED overlay.
  The result is simply `favor > contra` (3694).

Admin can force-advance without waiting for all votes (3465). The voter roster
`VOTANTES_CONCLAVE` (3068) and codes are hardcoded.

Limitation: polling only runs while the Leyes tab is open and only for admins.

---

## 8. Profile

`renderPerfil` (2751) → `renderPerfilCulposo` (2753):

- Own or another member's profile (via `verPerfilCulposo`, 2845).
- Shows avatar, bio (editable own via `editarBio`, 2734 → `guardar_bio`), stats, perfect
  attendance card, current CULPOSO DE ORO, streak card, hosted meetups
  (`renderHostPanel`, 2826), palmarés, and comments.
- Profile comments use `cargarComentarios` (3855) / `enviarComentario` (3891) /
  `eliminarComentario` (3928), keyed by member name as `Destinatario`.
- Own profile includes a link to history and a notifications activation card.

---

## 9. Music player

- `songs` (4052) lists tracks hosted on a GitHub Release (`v1.0-music`).
- `loadSong` (4075), `togglePlay` (4082) with rotating vinyl, `nextSong` (4110),
  `prevSong` (4131), seek via `#progressBar`, volume via `#volume`.
- `registrarReproduccion` (4095) posts `registrar_reproduccion` once per play session
  (`yaContado`), and `cargarReproducciones` (4183) / `actualizarContadorUI` (4194) show
  global and per-song counts.

---

## 10. Drive photo carousel

`cargarCarruselDrive` (4208) lists images in a folder via the Drive v3 API using the public
API key, builds thumbnails (`lh3.googleusercontent.com/d/<id>=w800`), and caches them in
`window._carruselData[ri]`. `renderCarruselSlide` (4237), `moverCarrusel` (4253), and
`irASlide` (4260) handle navigation/dots. Folder IDs come from `Drive ID` or
`DRIVE_FECHAS` (`getDriveLink`, 902).

---

## 11. Birthday widget

- `CUMPLES` (4267) holds each member's day/month.
- The floating `#bdayWidget` (4580) shows the next birthday (`initBdayWidget`, 4285) and a
  list of the next five; `toggleBday` (4563) opens the panel.
- If someone's birthday is today, `renderBdayHomeCardAnimada` (4371) runs a full-screen
  sequence: confetti (`spawnConfetti`, 4549), an animated reveal of that person's awards
  from `premiosData` (with gold specials), an optional catchphrase
  (`MENSAJES_ESPECIALES`, 4374), and finally an inline home card
  (`_bdayBuildCard`, 4499 / `_bdayMostrarCardHome`, 4539).
- `renderBdayHomeCard` (4321) is a simpler non-animated variant.

---

## 12. Notifications

- `firebase-messaging-sw.js` handles background pushes, dedupes with a fixed `tag`,
  offers "Ver juntada"/"Cerrar" actions, and focuses/opens the app on click.
- Foreground pushes use `messagingInstance.onMessage` → `showInAppNotification` (3795).
- `pedirPermisoNotificaciones` (3803) auto-registers a token after login;
  `activarNotificaciones` (3824) is the explicit button flow (profile) with status text.
- Both send the token with `guardar_token`.

Limitations: registration requires notification permission and a supported browser; errors
are only logged or shown inline. The service-worker scope/paths assume the app is served
from `/la-culpa-app/`.

---

## Cross-feature limitations

- No offline support beyond the service worker's messaging role (no app-shell cache).
- No routing/URL state; reload always returns to Home.
- No optimistic concurrency control: two users editing the same meetup or reacting at once
  can overwrite each other.
- Hardcoded rosters/dictionaries must be kept in sync with the sheets.
