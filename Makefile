PORT     ?= 8080
HOSTNAME := $(shell hostname -s).local
PID_FILE := .server.pid

.PHONY: start stop serve test

start:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (PID $$(cat $(PID_FILE))) — http://$(HOSTNAME):$(PORT)"; \
	else \
		python3 -m http.server $(PORT) --bind 0.0.0.0 >/dev/null 2>&1 & \
		echo $$! > $(PID_FILE); \
		echo "Started http://$(HOSTNAME):$(PORT) (PID $$(cat $(PID_FILE)))"; \
		sleep 0.5; \
		open -a Safari "http://$(HOSTNAME):$(PORT)"; \
	fi

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null && rm -f $(PID_FILE) && echo "Server stopped"; \
	else \
		echo "No server running"; \
	fi

# Headless server for Playwright (no browser open)
serve:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (PID $$(cat $(PID_FILE))) — http://localhost:$(PORT)"; \
	else \
		python3 -m http.server $(PORT) --bind 0.0.0.0 >/dev/null 2>&1 & \
		echo $$! > $(PID_FILE); \
		echo "Started http://localhost:$(PORT) (PID $$(cat $(PID_FILE)))"; \
	fi

test:
	npx playwright test && npx playwright show-report
