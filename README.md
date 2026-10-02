# LA CULPA (`la-culpapp`)

A private social PWA for a group of friends ("los 8 Reyes"). It tracks attendance at
meetups (`juntadas`), ranks members, runs awards, splits expenses, and hosts a small
social feed plus a themed "Cónclave" where the group votes on its own constitution.

It is intentionally zero-build: **the entire frontend is a single `index.html`** served
by GitHub Pages. All persistence lives in Google Sheets, reached through a Google Apps
Script Web App. Push notifications run through Firebase Cloud Messaging.

- **Live app:** https://tomascimmino.github.io/la-culpa-app/
- **Repo:** https://github.com/tomascimmino/la-culpa-app

> This project started as "vibe coding" and has no automated tests, no build step, and no
> dependency manager. Treat documentation as the source of truth when in doubt.

---

## Feature summary

| Tab | What it does |
| --- | --- |
| 🏠 Home | Next meetup + agenda, attendance confirmation, "proponer juntada", feed (posts, polls, recent meetups), music player, birthday widget |
| 👑 Culposos | Ranking by attendance % with streaks (`racha`) and top-3 shields |
| 📅 Juntadas | Meetup history with filters (month/category/host/attendee), records, "doble jornada" pairing, detail modal with Drive photo carousel |
| 🏆 Awards | Year-filtered awards (`CULPOSO DE ORO`, individual prizes, best meetups) with Drive photo links |
| 💰 Cuentas | Expense splitter with balances, couple-aware settlements, WhatsApp share, aliases |
| ⚖️ Ley | Statute proposals and the "Cónclave" live voting experience (admin-driven) |
| 👤 Perfil | Personal stats, bio, palmarés, hosted meetups, comments |

Extras: audio player (songs from a GitHub Release), Google Drive photo carousels, and a
birthday widget that plays a full-screen animated "palmarés" sequence.

---

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| UI | Vanilla HTML/CSS/JS | Everything inline in `index.html`, no framework, no bundler |
| Hosting | GitHub Pages | Serves `index.html` at the repo root; no CI workflow |
| Backend | Google Apps Script Web App | Deployed externally; a **redacted reference copy** is mirrored in `apps-script/`. Called via `APPS_SCRIPT_URL` |
| Database | Google Sheets | `SHEET_ID` is public-read via the `gviz/tq` CSV endpoint |
| Realtime-ish | Polling | The Cónclave polls every 4s for admins |
| Notifications | Firebase Cloud Messaging | `firebase-messaging-sw.js` service worker |
| Media | Imgur + Google Drive | Meetup cover photos and per-event Drive folders |
| Fonts | Google Fonts | Cinzel, Cinzel Decorative, EB Garamond |

---

## Repository layout

```
.
├── index.html                     # The whole app (HTML + CSS + JS, ~4,600 lines)
├── firebase-messaging-sw.js       # FCM background service worker
├── google0145b332920248a3.html    # Google Search Console site-verification file
├── README.md                      # This file
├── AGENTS.md                      # Guide for AI coding agents
├── .gitignore
├── apps-script/                   # Redacted reference copy of the live backend
│   ├── Asistencia.js              #   secrets replaced by placeholders (see README inside)
│   ├── appsscript.json            #   manifest (timezone, webapp config)
│   └── README.md                  #   redaction + deploy rules
└── docs/
    ├── ARCHITECTURE.md            # Layers, boot flow, data flow
    ├── DATA-MODEL.md              # Sheets, columns, muro rows, derived rules
    ├── BACKEND.md                 # Apps Script contract (real, from source)
    └── FEATURES.md                # Per-feature deep dive with code references
```

---

## Running locally

There is nothing to install or compile. Serve the folder over HTTP (the app uses
`fetch`, service workers, and absolute `/la-culpa-app/` paths, so opening the file
directly will partially fail):

```bash
python3 -m http.server 8080
# open http://localhost:8080/
```

The app talks to the public Google Sheet and the Apps Script endpoint regardless of
host, so local development hits production data. Login is just an email check against
the `CULPOSOS` sheet.

### Deploying

Push to `main`. GitHub Pages publishes the repo root automatically. There is **no build
step and no GitHub Actions workflow** to update.

---

## Configuration

These values are hardcoded in `index.html` (see the top of the main `<script>`):

| Constant | Purpose |
| --- | --- |
| `SHEET_ID` | Google Sheet containing the data |
| `APPS_SCRIPT_URL` | Apps Script Web App endpoint (all write actions + muro/leyes reads) |
| `ADMIN_EMAIL` | Single admin account (Cónclave controls, can edit/delete any meetup) |
| `FIREBASE_CONFIG` / `VAPID_KEY` | FCM project + web push key |
| `DRIVE_FECHAS` | Maps specific meetup dates to Google Drive folder IDs |
| `FOTOS`, `GUARIDAS`, `PAREJAS`, `CUMPLES` | Domain dictionaries (avatars, host pairs, couples, birthdays) |

---

## External resources

- **Google Sheet:** `161VeGFs7DuavtXRwt0QRgnoObuD-QeNDnfXnJvlESZE`. Tabs read by the frontend:
  `Hoja 1`, `CULPOSOS`, `PREMIOS`. Managed by the backend: `COMENTARIOS`, `LEYES`,
  `TOKENS`, `REPRODUCCIONES`, `WORDLE`.
- **Apps Script endpoint:** a `script.google.com/macros/s/.../exec` deployment, deployed as
  `USER_DEPLOYING` with access `ANYONE_ANONYMOUS`. Source mirrored (redacted) in `apps-script/`.
- **Firebase project:** `la-culpa` (FCM sent server-side by the Apps Script)
- **Music files:** GitHub Release tag `v1.0-music` under `tomascimmino/la-culpa-app`

---

## Security notes

This is a private friends app, but the repo is public. Be aware:

- **Client secrets are in the source and visible to anyone:** the Imgur `Client-ID`, the
  Google API key used for Drive reads, the Firebase web config, and the VAPID key. Web
  keys and the Imgur client ID are inherently public/client-side, but you should still
  restrict them (HTTP referrer restrictions, API scoping) and rotate the Imgur one if it
  was ever issued as anything other than a public client.
- **Backend secrets never go in git.** The live Apps Script hardcodes a Firebase
  service-account private key (`SA_PRIVATE_KEY`) and client email. The committed
  `apps-script/` copy has these **redacted**; the real values live only in the live
  project and the maintainer's local backup. Never `clasp push` the redacted copy.
- **No real authentication.** "Login" only verifies an email exists in the `CULPOSOS`
  sheet and stores it in `localStorage`. The web app is deployed `ANYONE_ANONYMOUS` and all
  write actions trust the payload; the only server checks are string comparisons against
  `ADMIN_EMAIL` / a member named `Zabala`. There is no session or token.
- **Drive photo folders are shared `ANYONE_WITH_LINK` + `EDIT`** by the backend's
  `crearCarpetaJuntada`. Anyone with the link can edit event photos.
- **User-generated content is rendered with `innerHTML` without escaping** (posts,
  comments, bios, law proposals). This is a stored-XSS risk. See
  `docs/ARCHITECTURE.md` → Known weaknesses.

---

## Documentation

- Humans: this README + [`docs/`](docs/).
- AI agents: start with [`AGENTS.md`](AGENTS.md), which contains the file map, conventions,
  global state inventory, and a smoke-test checklist.
