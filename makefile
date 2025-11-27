.PHONY: install
install:
	npm install

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: test
test:
	chmod +x ./test.sh && ./test.sh
	npm test

.PHONY: run
run:
	npm start

.PHONY: clean
clean:
# 	rm -rf dist node_modules models *.db
	rm -rf *.db
