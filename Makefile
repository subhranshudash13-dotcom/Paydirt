# Paydirt — Loop Engineering build targets.
# Each `loop-*` target is one demoable slice: build → verify → commit.
.PHONY: up down logs models health install dev dev-api dev-web dev-worker test lint migrate loop1 loop2

DB_USER := ledger
DB_NAME := quarry

up:            ## start db, ollama, temporal in the background
	docker compose up -d

down:          ## stop the stack
	docker compose down

logs:          ## tail compose logs
	docker compose logs -f

models:        ## pull local open-weight models into ollama
	docker exec paydirt-ollama ollama pull gemma3:4b
	docker exec paydirt-ollama ollama pull embeddinggemma

install:       ## install workspace deps
	npm install

migrate:       ## apply SQL migrations
	npm run db:migrate

dev-api:       ## run the Fastify API (watch)
	npm run dev -w @paydirt/api

dev-web:       ## run the Vite UI
	npm run dev -w @paydirt/web

dev-worker:    ## run the Temporal worker
	npm run dev -w @paydirt/worker

health:        ## check /api/health responds
	curl -fsS http://localhost:3000/api/health && echo

test:          ## run JS tests
	npm run test --workspaces --if-present

lint:          ## typecheck + lint
	npm run typecheck

loop1: up install migrate health   ## scaffold verified end to end
