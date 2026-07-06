.PHONY: setup setup-backend setup-frontend dev dev-backend dev-frontend test test-backend test-frontend test-e2e test-all lint lint-backend lint-frontend format migrate clean

# --- Setup ---
# T-13 (docs/THREAT_MODEL.md, ADR 014): the 7-day install cooldown lives in
# pyproject.toml [tool.uv.pip]. uv itself is pinned so the gating tool can't
# be hit by publish-then-yank; bump the pin via a reviewed PR. Urgent security
# fix inside the window: UV_EXCLUDE_NEWER="0 days" make setup-backend
UV_VERSION := 0.11.26

setup: setup-backend setup-frontend

setup-backend:
	python -m pip install --quiet uv==$(UV_VERSION)
	uv pip install $(if $(VIRTUAL_ENV),,--system) -e ".[dev]"

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
	ruff check backend
	mypy backend --ignore-missing-imports

lint-frontend:
	cd frontend && npm run lint

# --- Formatting ---
format:
	ruff format backend
	ruff check --fix backend
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
	rm -rf __pycache__ .pytest_cache .mypy_cache .coverage htmlcov .ruff_cache
	rm -rf backend/__pycache__ backend/**/__pycache__
	rm -rf frontend/dist frontend/.vite frontend/node_modules/.vite
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
