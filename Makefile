.PHONY: setup setup-backend setup-frontend dev dev-backend dev-frontend test test-backend test-frontend test-e2e test-all lint lint-backend lint-frontend format migrate clean

# --- Setup ---
# T-13 (docs/THREAT_MODEL.md, ADR 014): the 7-day install cooldown lives in
# pyproject.toml [tool.uv] and gates `uv lock` — vetting happens when the
# lockfile is updated, not when it is reproduced. uv itself is pinned so the
# gating tool can't be hit by publish-then-yank; bump the pin via a reviewed
# PR. Urgent security fix inside the window: commit an
# exclude-newer-package override in pyproject.toml [tool.uv] and `uv lock`
# (NOT the UV_EXCLUDE_NEWER env var — see the pyproject comment).
UV_VERSION := 0.11.26
UV_PIP := uv pip install $(if $(VIRTUAL_ENV),,--system)

setup: setup-backend setup-frontend

setup-backend:
	python -m pip install --quiet uv==$(UV_VERSION)
	# T-13 (ADR 014): install exactly the committed uv.lock resolution.
	# --locked fails loudly if pyproject.toml changed without `uv lock`.
	# Deliberately not `uv sync`: it only targets a project venv
	# (.venv/UV_PROJECT_ENVIRONMENT — no --system mode), so it can't serve
	# the CI/README no-venv flow. (`--inexact` solves package-stripping,
	# not env-targeting.)
	uv export --locked --quiet --no-emit-project --extra dev -o .uv-export.txt
	# Cooldown off for this line only: these exact pins+hashes were already
	# vetted at lock time; re-filtering by age here would block installing
	# a lock that carries a legitimate emergency override.
	UV_EXCLUDE_NEWER="0 days" $(UV_PIP) --require-hashes -r .uv-export.txt
	# setuptools (build backend) comes pinned+hashed from the lock above.
	$(UV_PIP) --no-deps --no-build-isolation -e .

setup-frontend:
	cd frontend && npm install

# --- Development ---
dev:
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
migrate:
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
