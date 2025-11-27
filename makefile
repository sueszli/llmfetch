.PHONY: run
run:
	npm install
	npm start

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: test
test:
	rm -f scrapers.db scrapers.db-shm scrapers.db-wal
	chmod +x src/index.e2e.test.sh && src/index.e2e.test.sh
	npm test

.PHONY: clean
clean:
# 	rm -rf dist node_modules models
	rm -rf *.db
