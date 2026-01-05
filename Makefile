.PHONY: help build up down logs clean migrate revision shell test

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

build: ## Build all containers
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs only
	docker-compose logs -f backend

clean: ## Remove all containers, volumes, and images
	docker-compose down -v --remove-orphans
	docker system prune -f

migrate: ## Run database migrations
	docker-compose exec backend alembic upgrade head

revision: ## Create a new migration (usage: make revision m="message")
	docker-compose exec backend alembic revision --autogenerate -m "$(m)"

shell: ## Open a shell in the backend container
	docker-compose exec backend /bin/bash

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U signflow -d signflow_db

test: ## Run tests
	docker-compose exec backend pytest -v

test-cov: ## Run tests with coverage
	docker-compose exec backend pytest --cov=app --cov-report=term-missing

restart: ## Restart all services
	docker-compose restart

restart-backend: ## Restart backend only
	docker-compose restart backend

ps: ## Show running containers
	docker-compose ps

