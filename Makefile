.PHONY: help build up down restart logs status update

# Кольори для виводу
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Показати цю довідку
	@echo "$(GREEN)FOP Dollar Bot - Docker Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

build: ## Побудувати Docker образ
	@echo "$(GREEN)Building Docker image...$(NC)"
	docker-compose build --no-cache

up: ## Запустити бота
	@echo "$(GREEN)Starting bot...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Bot started! Use 'make logs' to view logs.$(NC)"

down: ## Зупинити бота
	@echo "$(YELLOW)Stopping bot...$(NC)"
	docker-compose down

restart: ## Перезапустити бота
	@echo "$(YELLOW)Restarting bot...$(NC)"
	docker-compose restart bot

logs: ## Подивитись логи бота
	docker-compose logs -f bot

status: ## Показати статус контейнера
	@echo "$(GREEN)Container Status:$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(GREEN)Resource Usage:$(NC)"
	@docker stats --no-stream fop-dollar-bot

shell: ## Відкрити shell в контейнері бота
	docker-compose exec bot sh

update: ## Оновити бота (rebuild + restart)
	@echo "$(GREEN)Updating bot...$(NC)"
	docker-compose down
	docker-compose build --no-cache bot
	docker-compose up -d
	@echo "$(GREEN)Bot updated and restarted!$(NC)"
