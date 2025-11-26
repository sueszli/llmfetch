.PHONY: install
install:
	npm install

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: run
run:
	npm start
