# Backend contract (Google Apps Script)

> **STATUS: TODO / inferred.** The Apps Script source is **not in this repository**. Every
> request/response below was inferred from how `index.html` calls the endpoint. Anything
> you need to change server-side must be done in the Apps Script project itself. Replace
> the `TODO` sections with the real source when available.

## Endpoint

```
APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycb.../exec   (index.html:854)
```

- All calls are `POST` with `Content-Type` left to the browser default and a JSON body.
- The response is expected to be JSON. The general shape is
  `{ success: boolean, error?: string, ... }`, but not every action follows it (see
  quirks).

## Authentication / authorization

- **None.** Writes trust the payload (`email`, `nombre`, `autor`, etc.). There is no
  session, token, or signature verification in the client.
- `ADMIN_EMAIL` (`tomascimmino@gmail.com`) is a **client-side** gate only; the server is
  expected to also enforce it for `iniciar_conclave` / `avanzar_ley` / `reset_conclave`,
  but that cannot be verified from here. **TODO: confirm server-side checks.**

## Action catalogue

### Muro (social feed)

| `accion` | Caller(s) | Request payload | Expected response | RW |
| --- | --- | --- | --- | --- |
| `get_muro` | `cargarInteraccionesJuntadas` (1623), `cargarMuroHome` (1771), `cargarComentarios` (3859) | `{ accion:'get_muro' }` | `{ success, rows: MuroRow[] }` | R |
| `crear_post` | `publicarPost` (2027), Wordle auto-post (1846) | `{ accion:'crear_post', autor, texto }` | `{ success, error? }` | W |
| `crear_encuesta` | `publicarPost` (2024) | `{ accion:'crear_encuesta', autor, pregunta, opciones: string[] }` | `{ success, error? }` | W |
| `votar_encuesta` | `votarEncuesta` (2043) | `{ accion:'votar_encuesta', id, email, opcionIdx }` | `{ success, error? }` | W |
| `comentar_post` | `comentarJuntadaFeed` (1680), `comentarPost` (2123) | `{ accion:'comentar_post', postId, autor, texto }` | `{ success, error? }` | W |
| `comentar` | `enviarComentario` (3916) | `{ accion:'comentar', destinatario, autor, texto }` | `{ success, error? }` | W |
| `reaccionar_post` | `reaccionarJuntada` (1649, 1657), `reaccionarPost` (2067) | `{ accion:'reaccionar_post', id, tipo:'like'\|'corona', email }` | `{ success, error? }` | W |
| `reaccionar_comentario` | `reaccionarComentario` (1604) | `{ accion:'reaccionar_comentario', id, tipo, email }` | `{ success, error? }` | W |
| `crear_interaccion_juntada` | `reaccionarJuntada` (1652) | `{ accion:'crear_interaccion_juntada', juntadaId, tipo, email }` | `{ success, error? }` (then re-fetches `get_muro`) | W |
| `eliminar_post` | `eliminarPost` (2149) | `{ accion:'eliminar_post', id, email }` | `{ success, error? }` | W |
| `eliminar_comentario` | `eliminarComentarioMuro` (2083), `eliminarComentario` (3937) | `{ accion:'eliminar_comentario', id, email }` | `{ success, error? }` | W |

`MuroRow` shape is documented in `docs/DATA-MODEL.md`.

### Meetups

| `accion` | Caller(s) | Request payload | Expected response | RW |
| --- | --- | --- | --- | --- |
| `crear_juntada` | `enviarPropuesta` (2727) | `{ accion:'crear_juntada', fecha:'d/m/yyyy', host, descripcion, categoria, hora }` | `{ success, error? }` | W |
| `editar_juntada` | `enviarEdicion` (2460) | `{ accion:'editar_juntada', fila, fecha, host, descripcion, categoria, hora }` | `{ success, error? }` | W |
| `eliminar_juntada` | `eliminarJuntada` (2416) | `{ accion:'eliminar_juntada', fila }` | `{ success, error? }` | W |
| `confirmar_juntada_con_foto` | `procesarSubirFotoLink` (2681) | `{ accion:'confirmar_juntada_con_foto', fila, fotoUrl }` | `{ success, error? }` | W |
| *(attendance — no `accion`)* | `confirmarAsistencia` (2529) | `{ email, fila, asistira:boolean, valor:1\|2 }` | `{ success, mensaje?, error? }` | W |

`fila` is the sheet row = `juntadasData index + 2`.

> **Quirk:** the attendance call (2529) sends **no `accion` field**. This is either an
> implicit default handler in the Apps Script `doPost` or a latent bug. **TODO: confirm.**

### Profile / notifications

| `accion` | Caller(s) | Request payload | Expected response | RW |
| --- | --- | --- | --- | --- |
| `guardar_bio` | `editarBio` (2740) | `{ accion:'guardar_bio', email, bio }` | `{ success, error? }` | W |
| `guardar_token` | `pedirPermisoNotificaciones` (3819), `activarNotificaciones` (3843) | `{ accion:'guardar_token', email, token }` | `{ success, error? }` | W |

### Laws / Cónclave

| `accion` | Caller(s) | Request payload | Expected response | RW |
| --- | --- | --- | --- | --- |
| `get_leyes` | `cargarLeyes` (3100, 3109) | `{ accion:'get_leyes' }` | `{ success, leyes: Ley[] }` | R |
| `proponer_ley` | `enviarLey` (3733) | `{ accion:'proponer_ley', nombre, titulo, descripcion }` | `{ success, error? }` | W |
| `get_conclave` | `cargarConclave` (3118) | `{ accion:'get_conclave' }` | `{ success, iniciado, leyActiva, leyes: LeyVotacion[] }` | R |
| `votar_ley` | `votarConclave` (3536) | `{ accion:'votar_ley', nombre, voto:1\|2\|3, leyIndex }` | `{ success, error? }` | W |
| `avanzar_ley` | `avanzarLeyConclave` (3568) | `{ accion:'avanzar_ley', email }` | `{ success, error? }` | W |
| `iniciar_conclave` | `iniciarConclave` (3594) | `{ accion:'iniciar_conclave', email }` | `{ success, error? }` | W |
| `reset_conclave` | `resetConclave` (3602) | `{ accion:'reset_conclave', email }` | `{ success, error? }` | W |

`Ley` = `{ nombre, titulo, descripcion, timestamp }`.
`LeyVotacion` adds `index`, `votos: { <nombre>: 1|2|3 }`, `favor`, `contra`, `abstenciones`.

### Player

| `accion` | Caller(s) | Request payload | Expected response | RW |
| --- | --- | --- | --- | --- |
| `registrar_reproduccion` | `registrarReproduccion` (4098) | `{ accion:'registrar_reproduccion', cancion }` | `{ success, reproducciones }` | W |
| `get_reproducciones` | `cargarReproducciones` (4185) | `{ accion:'get_reproducciones' }` | `{ success, total, canciones: [{ cancion, reproducciones }] }` | R |

## Read-only Sheet endpoints (not Apps Script)

| What | URL | Used by |
| --- | --- | --- |
| Meetups | `.../gviz/tq?tqx=out:csv&sheet=Hoja%201` | `loadData`, `recargarJuntadas` |
| Members | `.../gviz/tq?tqx=out:csv&sheet=CULPOSOS` | `loadData`, `login` |
| Awards | `.../gviz/tq?tqx=out:csv&sheet=PREMIOS` | `loadData` |

## Other external endpoints

| Service | Endpoint | Used by |
| --- | --- | --- |
| Drive v3 file listing | `googleapis.com/drive/v3/files?q='<folder>' in parents ...&key=<API_KEY>` | `cargarCarruselDrive` (4214) |
| Imgur upload | `api.imgur.com/3/image` (Client-ID hardcoded, placeholder) | `subirFotoImgur` (928) — **currently unused** |

---

## TODO — fill when the Apps Script source is available

- [ ] Paste/link the Apps Script project source (or mirror it into `apps-script/`).
- [ ] Document `doPost` dispatch: how `accion` is routed; what happens when absent
      (attendance quirk).
- [ ] Document the exact backend sheets/tabs for muro, leyes, conclave, tokens, plays.
- [ ] Document ID generation (`ID` vs `ID2` prefixes) and the interaction-row key format.
- [ ] Confirm server-side admin enforcement for Cónclave actions.
- [ ] Confirm validation, rate limiting, and how HTML in posts is stored (raw HTML is
      used by the Wordle post and rendered unescaped).
- [ ] Document timestamp format/timezone returned in muro rows.
- [ ] Note deployment ID/versioning practice (the `/exec` URL is baked into the client, so
      redeploys must preserve the URL or the app breaks).
