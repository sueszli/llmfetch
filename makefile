.PHONY: clean
clean:
	# rm -rf dist node_modules models
	rm -f scrapers.db scrapers.db-shm scrapers.db-wal

.PHONY: run
run: clean
	npm install

	lsof -ti:3000 > /dev/null 2>&1 || (npm start & echo $$! > /tmp/llmfetch-backend.pid && until curl -s http://localhost:3000 > /dev/null 2>&1; do sleep 0.1; done)

	npm run tui

	[ -f /tmp/llmfetch-backend.pid ] && kill $$(cat /tmp/llmfetch-backend.pid) 2>/dev/null && rm /tmp/llmfetch-backend.pid || true

.PHONY: run-backend
run-backend: clean
	npm start

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: test
test: clean
	chmod +x src/index.e2e.test.sh && src/index.e2e.test.sh
	npm test
