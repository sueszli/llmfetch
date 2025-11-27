.PHONY: install
install:
	npm install

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: test
test:
	rm -f scrapers.db scrapers.db-shm scrapers.db-wal
	chmod +x src/index.e2e.test.sh && src/index.e2e.test.sh
	npm test

.PHONY: run
run:
	npm start

.PHONY: clean
clean:
# 	rm -rf dist node_modules models *.db
	rm -rf *.db
