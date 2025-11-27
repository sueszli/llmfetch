.PHONY: install
install:
	npm install

.PHONY: fmt
fmt:
	npx prettier --write .

.PHONY: test
test:
	npm test

.PHONY: run
run:
	npm start

# .PHONY: clean
# clean:
# 	rm -rf *.db
