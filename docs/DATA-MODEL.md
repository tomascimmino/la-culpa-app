# Data model

The app has two kinds of storage:

1. **Google Sheets** (`SHEET_ID`) — read directly over the public `gviz` CSV endpoint for
   members, meetups, and awards. Read by `loadData` (index.html:1080), `login` (1052), and
   `recargarJuntadas` (2538).
2. **Muro / leyes / conclave / reproducciones** — stored in sheets internal to the Apps
   Script project and exposed as JSON through `APPS_SCRIPT_URL`. The exact sheet layout is
   owned by the backend (see `docs/BACKEND.md`); the **row shape** the frontend expects is
   documented below.

All CSV parsing is done by `parseCSV` (1101) and `parseCSVLine` (1130). A leading UTF-8
BOM is stripped; values starting with `'` have that quote stripped (Google Sheets CSV
quirk).

---

## Sheet `Hoja 1` — meetups

Header row is row 1, so meetup index `i` in `juntadasData` is sheet **row `i + 2`**.

| Column | Used as | Notes |
| --- | --- | --- |
| `Fecha` | `j.Fecha` | `d/m/yyyy` (also tolerated: ISO). Parsed by `parseFecha` (985) |
| `Host` | `j.Host` | One of `CULPOSOS_HOSTS` (857): Pastor, El Bachi, CJ, Corregidores, El 22, Castelar Sarmiento, Castelar Elflein, Perón, Malaver, Otro lugar |
| `Descripción` / `Descripcion` | `j.Descripción` | Free text; both accented/unaccented keys are checked everywhere |
| `Categoría` / `Categoria` | `j.Categoría` | One of `CATEGORIAS` (858): Comida, Salida, Cumpleaños, Entrenamiento, Otro |
| `Hora` | `j.Hora` | `HH:MM` (optional) |
| `Drive ID` | `j['Drive ID']` | Google Drive folder ID for the photo carousel (optional) |
| `Foto Juntada` / `Foto juntada` | `j['Foto Juntada']` | Cover image URL (Imgur). Presence marks a meetup as "realized" |
| `N° Culposos` / `N Culposos` | quorum | Integer; `tieneQuorum` requires ≥ 4 |
| `N° Asist` / `N Asist` | attendee count | Integer displayed on cards |
| `<Nombre de cada culposo>` | `j[Nombre]` | One column per member name. Confirmation value (see below) |

Rows without `Fecha` **and** without `Descripción` are dropped in `parseCSV` (1124).

### Confirmation value encoding

Inconsistent across history; always use the helpers, never compare directly:

- Positive (attends): `TRUE`, `✓`, `1` (string), `1` (number)
- Negative (does not attend / abstains): `FALSE`, `✗`, `2` (string), `2` (number)
- No response: empty

Helpers: `esConfirmadoPositivo` (1027), `esConfirmadoNegativo` (1028),
`estaConfirmado` (1029).

### Derived flags

- `_informal` (set in `renderHome`, 1215) — meetup happened but below quorum; shown in the
  feed, excluded from stats/ranking.
- `puedeConfirmarJuntada` (1002) — a meetup may be "confirmed with photo" when: it has no
  photo yet, ≥ 4 of the 8 original kings confirmed, and its date/time is in the past.

---

## Sheet `CULPOSOS` — members

| Column | Used as | Notes |
| --- | --- | --- |
| `Nombre` | `c.Nombre` | Display name and, crucially, the **column header** on `Hoja 1` |
| `Email` | auth | Lowercased for comparison; also the value stored in `Likes`/`Coronas`/`Autor`/`Votos` |
| `Alias` | calculator | Transfer alias shown at settlement |
| `Bio` | profile | Editable (max 100 chars) via `guardar_bio` |
| `Porcentaje` | ranking | Attendance % (source of truth for ordering) |
| `Asistencias` | stats | Attended count |
| `Total Juntadas` | stats | Denominator |

`getUsuarioActual` (982) resolves the logged-in email to a member row.

## Sheet `PREMIOS` — awards

| Column | Used as | Notes |
| --- | --- | --- |
| `Año` | year filter | Awards tab has hardcoded options 2023–2025; `Año` compared as string in `renderAwards` (2856) |
| `Terna` | award name | Includes `CULPOSO DE ORO` for the top prize |
| `Ganador` | winner | Person name (matches `CULPOSOS.Nombre`) or meetup description |
| `Tipo` | category | `Persona` or `Juntada` |

## Sheet(s) behind `get_muro`

`get_muro` returns `{ success, rows: [...] }`. Each row is a heterogeneous record
distinguished by `Tipo` + `Destinatario`:

| `Tipo` | Meaning | Key fields |
| --- | --- | --- |
| `post` | Text post | `ID`/`ID2`, `Autor` (email), `Texto`, `Fecha`, `Likes`, `Coronas`, `Destinatario = MURO` |
| `encuesta` | Poll | as post + `Opciones` (pipe-separated), `Votos` (`email:index,email:index`) |
| `comentario` | Comment | `Autor`, `Texto`, `Fecha`, `Likes`, `Coronas`; `Destinatario` = post ID, `post_*`, `juntada_*`, or a member name (profile comments) |
| `juntada` | Meetup interaction | `Destinatario = juntada_<fila>`, `Likes`, `Coronas`; carries the `interaccionID` |

ID handling: rows may have a legacy `ID` (epoch timestamp) or a newer `ID2` with a prefix
(`post_*`, `com_*`, `juntada_*`). Always resolve with `getRegistroId` (1565), which also
builds a deterministic fallback key when no ID exists.

`getReacciones(row, key)` (1576) splits `Likes`/`Coronas` into trimmed, non-empty values
(they are email lists).

### Linking a card to its interaction row

`getJuntadaId(ri)` = `'juntada_' + (ri + 2)` (1563). The meetup index is converted to the
sheet row, so the interaction record stays addressable even if the frontend array order
changes.

## Laws and Cónclave (backend JSON)

- `get_leyes` → `{ success, leyes: [{ nombre, titulo, descripcion, timestamp }] }`
- `get_conclave` → `{ success, iniciado, leyActiva, leyes: [{ index, titulo, descripcion,
  nombre, votos: { <nombre>: <voto> }, favor, contra, abstenciones }] }`

Vote codes: `1` = favor, `2` = contra, `3` = abstención. The voter roster is the hardcoded
`VOTANTES_CONCLAVE` (3068): the 8 kings + 6 queens + Matu = 15.

## Play counts (backend JSON)

- `get_reproducciones` → `{ success, total, canciones: [{ cancion, reproducciones }] }`
- `registrar_reproduccion` returns the updated count for the song.

---

## Domain dictionaries (hardcoded)

| Constant | Line | Purpose |
| --- | --- | --- |
| `CULPOSOS_HOSTS` | 857 | Host/venue options for forms |
| `CATEGORIAS` | 858 | Meetup categories |
| `NOMBRES_MESES` | 859 | Month labels for history filters |
| `ALIAS_HOST` | 861 | Short-name aliases used in host matching |
| `GUARIDAS` | 866 | Maps host-pair strings to canonical venue (`Zabala - Sami` → `CJ`, …) |
| `FOTOS` | 879 | Member avatar URLs (Imgur) |
| `DRIVE_FECHAS` | 890 | Date/description → Drive folder ID fallback when `Drive ID` is empty |
| `GUARIDA_HOST` | 961 | Canonical venue → host pair (inverse of `GUARIDAS`) |
| `REYES` / `REINAS` / `AGREGADOS` | 1008, 1145–1147 | King/queen rosters; quorum counts kings |
| `TODOS_NOMBRES` | 2878 | Calculator participant list |
| `PAREJAS` | 2925, 3002 | Couples, prioritized in settlement to minimize transfers |
| `CUMPLES` | 4267 | Birthdays (`d`, `m`) |

The three original sheets and these dictionaries are the effective "schema". If a member is
renamed, both the `Hoja 1` column header **and** the dictionaries/rosters must be updated.

## Derived rules

- **Quorum:** `parseInt(N° Culposos) >= 4` (`tieneQuorum`, 979). Many views also recompute
  king confirmations directly (`REYES` roster).
- **Attendance %:** from `CULPOSOS.Porcentaje` for ranking; profile/home recompute from
  `juntadasPasadas` when showing "your" attendance.
- **Streak (`racha`):** `calcularRacha` (1030) counts consecutive past quorum meetups
  (most recent first) where the member is positive; `calcularRachaHistorica` (1039) finds
  the longest run ever. Badges at ≥ 5 (⚡) and ≥ 10 (🔥).
- **CULPOSO DE ORO:** latest year whose `PREMIOS` row has `Terna` containing "CULPOSO DE
  ORO" and `Ganador` equal to the member.
- **Drive photos:** `getDriveLink` (902) prefers `Drive ID`, then `DRIVE_FECHAS` by
  `d-m-yyyy`, then date+suffix (description/host) matching.
