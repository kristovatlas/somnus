.PHONY: setup setup-backend setup-frontend ensure-python db-location dev dev-backend dev-frontend test test-backend test-frontend test-e2e test-all lint lint-backend lint-frontend format migrate audit clean

# `dev` relies on serial prerequisite order (db-location before migrate);
# don't run it under `make -j` (parallel) — NOTPARALLEL keeps prereqs ordered.
.NOTPARALLEL:

# --- Setup ---
# T-13 (docs/THREAT_MODEL.md, ADR 014): the 7-day install cooldown lives in
# pyproject.toml [tool.uv] and gates `uv lock` — vetting happens when the
# lockfile is updated, not when it is reproduced. uv itself is pinned so the
# gating tool can't be hit by publish-then-yank; bump the pin via a reviewed
# PR. Urgent security fix inside the window: commit an
# exclude-newer-package override in pyproject.toml [tool.uv] and `uv lock`
# (NOT the UV_EXCLUDE_NEWER env var — see the pyproject comment).
UV_VERSION := 0.11.26
# #105: pick the Python environment for setup, in precedence order:
#   1. an active virtualenv (VIRTUAL_ENV set) — install into it, as before;
#   2. CI (GitHub Actions always exports CI=true) — `--system` install into
#      the runner's Python, unchanged, so the later bare `pytest`/`ruff`/
#      `mypy`/`uv` steps keep finding everything;
#   3. neither (e.g. a stock macOS shell, where the system Python is PEP 668
#      externally managed and refuses pip installs) — auto-create a
#      repo-local .venv (gitignored) and drive the whole install through it.
VENV := .venv
ifdef VIRTUAL_ENV
SETUP_PY := python
UV := uv
UV_PIP := $(UV) pip install
# Value-tested, not ifdef: CI=false in a local shell must NOT get the
# --system path (PR #133 review, Codex P2).
else ifeq ($(CI),true)
SETUP_PY := python
UV := uv
UV_PIP := $(UV) pip install --system
else
SETUP_PY := $(VENV)/bin/python
UV := $(VENV)/bin/uv
UV_PIP := $(UV) pip install --python $(SETUP_PY)
endif

setup: setup-backend setup-frontend db-location

# #105: ensure the selected interpreter exists — no-op under CI or an
# active venv. Split out so the standalone `make db-location ARGS=...`
# documented in README and the unmounted-volume guard also works on a
# clean checkout (PR #133 review, Codex P2).
ensure-python:
ifeq ($(SETUP_PY),$(VENV)/bin/python)
	# #105: no active venv and not CI — create the repo-local venv once.
	# Guard BOTH directions (PR #133 review C-1): a stale .venv built by an
	# old interpreter is recreated (build artifact, safe to drop), and a
	# too-old python3 (stock macOS CLT ships 3.9) fails loudly with advice
	# instead of building a venv the locked install will reject.
	@if [ -x $(SETUP_PY) ] && ! $(SETUP_PY) -c 'import sys; raise SystemExit(sys.version_info < (3, 11))'; then 		echo "Recreating .venv: its Python is older than 3.11"; rm -rf $(VENV); fi
	@test -x $(SETUP_PY) || python3 -c 'import sys; ok = sys.version_info >= (3, 11); print("" if ok else "error: python3 is " + sys.version.split()[0] + " but Somnus needs 3.11+ (e.g. brew install python@3.12, then retry)"); raise SystemExit(not ok)'
	test -x $(SETUP_PY) || python3 -m venv $(VENV)
endif

setup-backend: ensure-python
	$(SETUP_PY) -m pip install --quiet uv==$(UV_VERSION)
	# T-13 (ADR 014): install exactly the committed uv.lock resolution.
	# --locked fails loudly if pyproject.toml changed without `uv lock`.
	# Deliberately not `uv sync`: it only targets a project venv
	# (.venv/UV_PROJECT_ENVIRONMENT — no --system mode), so it can't serve
	# the CI no-venv flow. (`--inexact` solves package-stripping,
	# not env-targeting.)
	$(UV) export --locked --quiet --no-emit-project --extra dev -o .uv-export.txt
	# Cooldown off for this line only: these exact pins+hashes were already
	# vetted at lock time; re-filtering by age here would block installing
	# a lock that carries a legitimate emergency override.
	UV_EXCLUDE_NEWER="0 days" $(UV_PIP) --require-hashes -r .uv-export.txt
	# setuptools (build backend) comes pinned+hashed from the lock above.
	$(UV_PIP) --no-deps --no-build-isolation -e .

setup-frontend:
	cd frontend && npm install

# #41 (ADR 015): resolve the DB location. No-ops if already configured
# (env var or saved choice) or on a non-TTY; otherwise prompts once.
# Override headlessly with `make db-location ARGS="--path /your/somnus.db"`
# or the SOMNUS_DB_PATH env var. Runs on the same Python setup-backend
# installed into ($(SETUP_PY)), so `make setup` works without activation.
db-location: ensure-python
	$(SETUP_PY) -m backend.db_location $(ARGS)

# --- Development ---
# #41 (ADR 015): choose the DB location (first-run prompt / env / flag)
# BEFORE migrate, so init_db and alembic use the chosen path. #78: apply
# pending migrations before launching so the dev flow runs against a current
# schema (startup itself stays passive — see THREAT_MODEL B2).
dev: db-location migrate
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait

dev-backend:
	uvicorn backend.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# --- Testing ---
test: test-backend test-frontend

test-backend:
	pytest

test-frontend:
	cd frontend && npm test

test-e2e:
	cd frontend && npx playwright test

test-all: test test-e2e

# --- Linting ---
lint: lint-backend lint-frontend

lint-backend:
	ruff check backend alembic
	mypy backend --ignore-missing-imports

lint-frontend:
	cd frontend && npm run lint

# --- Formatting ---
format:
	ruff format backend alembic
	ruff check --fix backend alembic
	cd frontend && npm run format

# --- Database ---
# Adoption first (idempotent): an unstamped pre-#76 DB would crash a raw
# `alembic upgrade head` (it would re-run the baseline against existing
# tables). init_db stamps/adopts — including the legacy-hybrid repair —
# then upgrade applies anything still pending. (A behind-head DB's
# "run make migrate" log line during this step is self-referential
# noise — the upgrade on the next line is doing exactly that.)
migrate:
	python -c "from backend.database import init_db; init_db()"
	alembic upgrade head

# --- Security ---
audit:
	pip-audit
	cd frontend && npm audit

# --- Clean ---
clean:
	rm -f .uv-export.txt
	rm -rf __pycache__ .pytest_cache .mypy_cache .coverage htmlcov .ruff_cache
	rm -rf backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/dist frontend/.vite frontend/node_modules/.vite
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
