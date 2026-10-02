# apps-script — Backend reference (REDACTED)

This folder is a **read-only reference copy** of the live Google Apps Script project
that powers LA CULPA. It exists so the backend logic is visible and versioned alongside
the frontend.

## ⚠️ Important

- This is **not** the deployable source. The **live project at
  `script.google.com` is the source of truth**.
- Secrets were **redacted** before committing:
  - `SA_PRIVATE_KEY` (Firebase service-account private key)
  - `SA_CLIENT_EMAIL` (Firebase service-account email)

  The real values live **only** in the live Apps Script project. Never commit them here.
- **Do not run `clasp push` from this folder.** Pushing this redacted copy would break
  FCM notifications in production. The `.clasp.json` file is gitignored on purpose so a
  fresh clone cannot push by accident.
- If you need a faithful local copy (with real secrets) for backup, keep it **outside**
  this repository. See the maintainer's local backup.

## Files

| File | Description |
| --- | --- |
| `Asistencia.js` | All backend logic: `doPost` dispatch for meetups, muro, laws/Cónclave, FCM, Drive, Wordle, triggers |
| `appsscript.json` | Apps Script manifest (timezone, runtime, webapp `executeAs` / `access`) |

## How to update this copy

To refresh the reference from the live project (without ever pushing):

```bash
clasp clone <SCRIPT_ID> --rootDir /some/temp/dir
# redact SA_PRIVATE_KEY / SA_CLIENT_EMAIL again, then copy over apps-script/
```

Always re-run a secret scan before committing: search the tree for a PEM private-key
block or the Firebase service-account email (use your preferred pattern).

## See also

- `docs/BACKEND.md` — full request/response contract for every `accion`.
- `docs/ARCHITECTURE.md` — how the frontend consumes this backend.
