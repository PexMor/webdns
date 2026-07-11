BINARY      := dns-backend
BIN_DIR     := bin
CARGO       := cargo
# Pin target dir so cross-build artifacts land under dns-backend/target/ even when
# CARGO_TARGET_DIR is set by the environment (e.g. IDE sandboxes).
export CARGO_TARGET_DIR := $(abspath target)
HOST_TRIPLE := $(shell rustc -vV | sed -n 's/^host: //p')

# Linux deployment targets (cross-compiled via cargo-zigbuild + Zig linker).
LINUX_X86_64 := x86_64-unknown-linux-gnu
LINUX_ARMHF  := armv7-unknown-linux-gnueabihf

NATIVE_BIN := $(BIN_DIR)/$(BINARY).$(HOST_TRIPLE)
X86_64_BIN := $(BIN_DIR)/$(BINARY).$(LINUX_X86_64)
ARMHF_BIN  := $(BIN_DIR)/$(BINARY).$(LINUX_ARMHF)

.PHONY: all native cross install clean help

.DEFAULT_GOAL := all

help: ## Show build targets
	@echo "dns-backend build targets:"
	@echo "  make all     — native + Linux x86_64 + Linux armhf → bin/"
	@echo "  make native  — host binary only"
	@echo "  make cross   — Linux cross-compiles only (zigbuild)"
	@echo "  make install — copy built artifacts into bin/"
	@echo ""
	@echo "Host:   $(HOST_TRIPLE)"
	@echo "Output: $(NATIVE_BIN), $(X86_64_BIN), $(ARMHF_BIN)"
	@echo "        $(BIN_DIR)/$(BINARY) → $(BINARY).$(HOST_TRIPLE)"

all: install ## Build and install all deployment binaries

native: ## Release build for the host (native)
	$(CARGO) build --release
	@mkdir -p $(BIN_DIR)
	@cp target/release/$(BINARY) $(NATIVE_BIN)
	@ln -sf $(BINARY).$(HOST_TRIPLE) $(BIN_DIR)/$(BINARY)

cross: cross-x86_64 cross-armhf ## Cross-compile Linux x86_64 and armhf via zigbuild

cross-x86_64: ## Cross-compile for x86_64-unknown-linux-gnu
	$(CARGO) zigbuild --release --target $(LINUX_X86_64)
	@mkdir -p $(BIN_DIR)
	@cp target/$(LINUX_X86_64)/release/$(BINARY) $(X86_64_BIN)

cross-armhf: ## Cross-compile for armv7-unknown-linux-gnueabihf (armhf)
	$(CARGO) zigbuild --release --target $(LINUX_ARMHF)
	@mkdir -p $(BIN_DIR)
	@cp target/$(LINUX_ARMHF)/release/$(BINARY) $(ARMHF_BIN)

install: native cross ## Install all binaries into bin/
	@echo "Installed:"
	@ls -lh $(BIN_DIR)/$(BINARY)*

clean: ## Remove build artifacts and installed binaries
	$(CARGO) clean
	rm -rf $(BIN_DIR)
