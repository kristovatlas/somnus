"""Database-location selection at launch time (#41, ADR 015).

The DB path is chosen when the user starts the server from the terminal —
a process with real filesystem access, so there is no browser sandbox to
fight and no GUI dialog to require. Precedence, highest first:

  1. ``--path`` CLI flag to this module
  2. ``SOMNUS_DB_PATH`` environment variable
  3. the saved launcher config file (this module wrote it on a prior run)
  4. an interactive first-run prompt (only when stdin is a TTY)
  5. the default ``~/.somnus/somnus.db``

Levels 1–3 and 5 are *passive* — resolved by :mod:`backend.config` at
import with no I/O prompt — so importing the app never blocks. The
interactive prompt (4) happens only in this module's ``main`` (run once by
``make setup`` / ``make dev``), never at import, so tests, CI, and uvicorn
workers are unaffected. On a non-TTY launch with nothing configured, we do
not prompt: config falls through to the env var or the default, which is
exactly how a headless/containerised deploy is configured.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

from backend.config import CONFIG_FILE, DEFAULT_DB_DIR, read_saved_db_path

DEFAULT_DB_PATH = DEFAULT_DB_DIR / "somnus.db"

_PRIVACY_NOTICE = """\
Where should Somnus store your database?

  It holds your Oura token and every health entry — sleep, and sensitive
  categories like alcohol, illness, and sexual activity — as PLAIN TEXT.
  Somnus does not encrypt the file itself. Anyone who can read it can read
  all of it.

  Best practice:
    • Turn on full-disk encryption (FileVault / BitLocker / LUKS).
    • For an extra layer, keep the database on an encrypted volume
      (e.g. a mounted VeraCrypt volume) and point Somnus at it here —
      mount the volume first, then enter its path below.
"""


def _validate_target(raw: str) -> tuple[Path | None, str | None]:
    """Resolve a user-entered path and check its directory is usable.

    Returns ``(path, None)`` when acceptable, else ``(None, reason)``. Does
    not create anything; the app's ``init_db`` creates and adopts on start.
    """
    if not raw.strip():
        return None, "Please enter a path (or press Enter for the default)."
    path = Path(raw.strip()).expanduser()
    if path.is_dir():
        return None, f"{path} is a directory — include a filename, e.g. {path / 'somnus.db'}"
    parent = path.parent
    if not parent.exists():
        return None, (
            f"{parent} does not exist. Create it first, or (for an encrypted "
            "volume) make sure it is mounted."
        )
    if not parent.is_dir():
        return None, f"{parent} is not a directory."
    # Best-effort writability probe: a UNIQUE temp file in the parent, so we
    # never touch or delete a real file the user happens to have named
    # `.somnus-write-test`. tempfile handles create + cleanup atomically.
    try:
        with tempfile.NamedTemporaryFile(dir=parent, prefix=".somnus-write-"):
            pass
    except OSError:
        return None, f"{parent} is not writable."
    return path, None


def _enable_tab_completion() -> None:
    """Wire readline filesystem tab-completion, if readline is available."""
    try:
        import readline
    except ImportError:  # pragma: no cover — readline absent (e.g. some Windows)
        return

    def complete(text: str, state: int) -> str | None:
        expanded = Path(text).expanduser()
        base = str(expanded)
        matches = [str(p) + ("/" if p.is_dir() else "") for p in _glob_prefix(base)]
        return matches[state] if state < len(matches) else None

    readline.set_completer_delims(" \t\n")
    readline.parse_and_bind("tab: complete")
    readline.set_completer(complete)


def _glob_prefix(base: str) -> list[Path]:
    parent = Path(base).parent if base and not base.endswith("/") else Path(base or ".")
    prefix = Path(base).name if base and not base.endswith("/") else ""
    try:
        return sorted(p for p in parent.iterdir() if p.name.startswith(prefix))
    except OSError:
        return []


def prompt_for_location(*, default: Path = DEFAULT_DB_PATH) -> Path:
    """Interactively ask the user where to store the database (TTY only)."""
    print(_PRIVACY_NOTICE)
    _enable_tab_completion()
    while True:
        raw = input(f"Database path [{default}]: ").strip()
        if not raw:
            return default
        path, reason = _validate_target(raw)
        if path is not None:
            return path
        print(f"  → {reason}\n")


def is_configured() -> bool:
    """True when a DB path is already pinned (env var or saved config)."""
    return bool(os.environ.get("SOMNUS_DB_PATH")) or read_saved_db_path() is not None


def main(argv: list[str] | None = None) -> int:
    """Launcher entry point: resolve + persist the DB location.

    Idempotent: when already configured it reports the current location
    and exits (unless ``--force``);
    on a non-TTY, never prompts (headless uses the env var / default).
    """
    parser = argparse.ArgumentParser(
        prog="python -m backend.db_location",
        description="Choose where Somnus stores its database.",
    )
    parser.add_argument("--path", help="Set the DB path non-interactively (headless).")
    parser.add_argument(
        "--force", action="store_true", help="Re-prompt even if already configured."
    )
    args = parser.parse_args(argv)

    if args.path:
        path, reason = _validate_target(args.path)
        if path is None:
            print(f"error: {reason}", file=sys.stderr)
            return 2
        _persist(path)
        print(f"Somnus database location set to {path}")
        return 0

    if is_configured() and not args.force:
        # #97: a bare re-run used to exit silently, making the documented
        # "re-run make db-location to move it" advice a no-op. Report where
        # data lives and how to actually change it — which depends on HOW it
        # is pinned: the env var outranks the saved config, so --force/--path
        # (which only rewrite the saved file) cannot move an env-configured
        # location (PR #121 review, Codex P2).
        env_path = os.environ.get("SOMNUS_DB_PATH")
        if env_path:
            print(
                f"Somnus database location: {env_path} "
                "(set by SOMNUS_DB_PATH — change or unset that variable "
                "to move it)."
            )
        else:
            print(
                f"Somnus database location: {read_saved_db_path()} "
                '(already configured — use ARGS="--force" to change it, '
                'or ARGS="--path <file>").'
            )
        return 0

    if not sys.stdin.isatty():
        # Headless with nothing configured: don't block. config.py falls
        # through to SOMNUS_DB_PATH or the default.
        print(
            "Somnus: no database location configured and no TTY to prompt; "
            f"using SOMNUS_DB_PATH or the default ({DEFAULT_DB_PATH}). "
            "Set --path or SOMNUS_DB_PATH to choose.",
            file=sys.stderr,
        )
        return 0

    chosen = prompt_for_location()
    _persist(chosen)
    print(f"Somnus database location set to {chosen}")
    return 0


def _persist(path: Path) -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(f"{path}\n")


if __name__ == "__main__":  # pragma: no cover — CLI entry
    raise SystemExit(main())
