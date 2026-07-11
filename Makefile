.DEFAULT_GOAL := help

BLUE   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
BOLD   := \033[1m
RESET  := \033[0m

WEBAPP_DIR   := webapp
DOCS_APP_DIR := docs/app
BACKEND_DIR  := dns-backend
BACKEND_BIN  := $(BACKEND_DIR)/bin/dns-backend

.PHONY: help all webapp backend backend-native backend-cross clean run

help: ## Show this help
	@echo ""
	@echo "$(BOLD)$(BLUE)🌐 webdns$(RESET) — DNS query webapp + backend"
	@echo ""
	@echo "$(YELLOW)Usage:$(RESET) make $(GREEN)<target>$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@echo ""

all: webapp backend ## Build webapp and backend

webapp: ## 📦 Build the Vite/Preact PWA (docs/app)
	@echo "$(BLUE)📦 Building webapp...$(RESET)"
	corepack enable 2>/dev/null || true
	cd $(WEBAPP_DIR) && yarn install
	cd $(WEBAPP_DIR) && yarn build
	@echo "$(GREEN)✅ Webapp built → $(DOCS_APP_DIR)/$(RESET)"

backend: webapp ## 🦀 Build native + Linux x86_64/armhf backends into dns-backend/bin/
	@echo "$(BLUE)🦀 Building backend (native + cross via zigbuild)...$(RESET)"
	$(MAKE) -C $(BACKEND_DIR) all
	@echo "$(GREEN)✅ Backends installed → $(BACKEND_DIR)/bin/$(RESET)"

backend-native: webapp ## 🦀 Build host-native backend only
	@echo "$(BLUE)🦀 Building native backend...$(RESET)"
	$(MAKE) -C $(BACKEND_DIR) native
	@echo "$(GREEN)✅ Backend installed → $(BACKEND_BIN)$(RESET)"

backend-cross: webapp ## 🦀 Cross-compile Linux x86_64 + armhf backends (zigbuild)
	@echo "$(BLUE)🦀 Cross-compiling backends...$(RESET)"
	$(MAKE) -C $(BACKEND_DIR) cross
	@echo "$(GREEN)✅ Cross builds installed → $(BACKEND_DIR)/bin/$(RESET)"

run: backend ## 🚀 Run the backend (builds first)
	@echo "$(BLUE)🚀 Starting server...$(RESET)"
	$(BACKEND_BIN)

clean: ## 🧹 Remove build artifacts
	@echo "$(YELLOW)🧹 Cleaning...$(RESET)"
	cargo clean --manifest-path $(BACKEND_DIR)/Cargo.toml
	find $(DOCS_APP_DIR) -mindepth 1 -not -name '.keep' -delete
	rm -rf $(WEBAPP_DIR)/dist $(WEBAPP_DIR)/dev-dist $(BACKEND_DIR)/bin
	@echo "$(GREEN)✅ Clean complete$(RESET)"
