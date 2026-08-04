install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

lint-fix:
	npm run lint:fix

test:
	npm test

check: lint test build

.PHONY: install dev build start lint lint-fix test check
