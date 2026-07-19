# ADR 015: Database Location Chosen at Launch (First-Run Terminal Prompt)

## Status
Accepted — 2026-07-16. Implements issue #41 (PLAN Step 4 / §15).

## Context
The database holds the Oura token and all health data **in plaintext** (T-07);
best practice is to keep it on an OS-encrypted volume (full-disk encryption
baseline, optionally a mounted VeraCrypt volume — see the T-07 residual and the
README). For that guidance to matter, the user must be able to choose the
database location *before the file is created* — otherwise Somnus silently
creates `~/.somnus/somnus.db` on first start and the advice arrives too late
(the original #41 complaint).

We explored letting the user choose the location from the web UI and rejected
every browser-based mechanism, because **a browser never exposes an absolute
filesystem path to any process** (its sandbox), so the backend can never be
*told* where to put the file:

- **File / folder picker** (`<input type=file>`, `webkitdirectory`,
  `showDirectoryPicker`): yields a basename, relative paths, or an opaque
  browser-scoped handle — never an absolute path; a folder picker is no better
  than a file picker, and an empty folder (the fresh-volume case) yields
  nothing. `showDirectoryPicker` is also Chromium-only and its handle can't
  cross to the Python backend.
- **Drag-and-drop**: browsers strip the path from dropped items.
- **Scan-and-match** (pick a file, backend finds it by name/size/hash across
  known dirs): reconstructs a path indirectly, but is ambiguous, doesn't fit
  the *create-fresh* case (nothing to pick yet), broadens filesystem
  enumeration surface, and still needs a typed-path fallback anyway.
- **Native OS dialog popped by the backend** (`tkinter`/`zenity`/`osascript`/
  PowerShell): gives a real path, but requires the backend to have a display —
  it breaks on headless/SSH and a future container deploy (#56) — and the
  dialog often opens behind the browser window (a silent-failure trap, cf. #35).

## Decision
**Choose the database location at server launch, from the terminal** — the
user starts the server there anyway, and that process has full filesystem
access, so none of the sandbox/GUI problems apply and **no new HTTP endpoint
is added** (the choice never touches the unauthenticated localhost API).

- **First-run prompt** (`backend/db_location.py`, run by `make setup` and, if
  still unconfigured, `make dev`): shown only when stdin is a TTY. Uses stdlib
  `readline` filesystem **tab-completion** (no third-party TUI dependency),
  offers `~/.somnus/somnus.db` as the enter-to-accept default, validates the
  target directory (exists, is a dir, writable) before accepting, and
  **delivers the T-07 privacy guidance at the prompt** (full-disk encryption +
  encrypted-volume recommendation) — moving that education from the web UI to
  the moment of choice.
- **Precedence** (highest first): `--path` CLI flag → `SOMNUS_DB_PATH` env var
  → saved launcher config file (`~/.somnus/db-location`, a single path string)
  → interactive prompt → default `~/.somnus/somnus.db`.
- **Passive resolution**: `backend/config.py` resolves env → saved file →
  default at import with **no prompt**, so importing the app never blocks
  (tests, CI, uvicorn workers). The interactive prompt lives only in
  `db_location.main`, invoked once by the launcher.
- **Headless / non-interactive**: on a non-TTY with nothing configured, we do
  **not** prompt — config falls through to `SOMNUS_DB_PATH` or the default,
  which is exactly how CI and a container are configured (`-e SOMNUS_DB_PATH=…`
  + a volume mount). This is why the launcher prompt, unlike the native OS
  dialog, does not break headless.

## Consequences
**Positive:** the location is chosen before any DB is created (fixes #41 at the
source); path-native UX with tab-completion and no sandbox fight; works over
SSH; **removes** the filesystem-enumeration attack surface the in-browser
options would have added; the plaintext-at-rest guidance reaches the user at
the decisive moment.

**Negative / costs:** the choice lives in the launcher, not an in-app Settings
control, so *changing* the location later means re-running `make db-location
ARGS="--force"` (bare `make db-location` reports the current location — #97)
(or editing the config file / setting the env var) rather than a UI action —
acceptable for a single-user local tool that rarely relocates its data. A small
launcher config file is introduced (holds only a path string — no secret — so
it is not subject to T-07/T-08 hardening). The onboarding "Data Storage" step
changes from *instructing* the user to set `SOMNUS_DB_PATH` to *confirming*
where data is stored.

## References
- Issue #41; scope decision recorded 2026-07-16 (`docs/releases/v0.1.0-scope-discussion.md`)
- `docs/THREAT_MODEL.md` T-07 (plaintext at rest), T-08 (file perms), B2
- PLAN.md Step 4 / §15
