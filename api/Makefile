# AsyncAnticheat API - Build & Deployment
#
# Profiles:
#   dev-release: Fast builds (~30s), good for testing/iteration
#   release:     Full optimization (~3-5min), for production
#
# Usage:
#   make deploy        - Fast deploy for testing (dev-release)
#   make deploy-prod   - Production deploy (release, full optimization)
#   make build         - Build dev-release locally
#   make build-prod    - Build release locally

SERVER := root@95.216.244.60
SSH_KEY := ~/.ssh/cursor
REMOTE_PATH := /opt/async_anticheat_api
BINARY := async_anticheat_api
SERVICE := async-anticheat-api.service

.PHONY: build build-prod deploy deploy-prod restart logs check

# Local builds
build:
	cargo build --profile dev-release

build-prod:
	cargo build --release

check:
	cargo check

# Deploy using dev-release (fast, for testing)
deploy:
	@echo "==> Building on server (dev-release profile)..."
	rsync -avz --exclude 'target' --exclude '.git' -e "ssh -i $(SSH_KEY)" \
		./ $(SERVER):$(REMOTE_PATH)/
	ssh -i $(SSH_KEY) $(SERVER) "\
		source ~/.cargo/env && \
		cd $(REMOTE_PATH) && \
		cargo build --profile dev-release && \
		systemctl stop $(SERVICE) && \
		cp target/dev-release/$(BINARY) target/release/$(BINARY) && \
		systemctl start $(SERVICE)"
	@echo "==> Deployed (dev-release)"

# Deploy using release profile (slow, for production)
deploy-prod:
	@echo "==> Building on server (release profile - this takes ~5 min)..."
	rsync -avz --exclude 'target' --exclude '.git' -e "ssh -i $(SSH_KEY)" \
		./ $(SERVER):$(REMOTE_PATH)/
	ssh -i $(SSH_KEY) $(SERVER) "\
		source ~/.cargo/env && \
		cd $(REMOTE_PATH) && \
		cargo build --release && \
		systemctl restart $(SERVICE)"
	@echo "==> Deployed (release)"

restart:
	ssh -i $(SSH_KEY) $(SERVER) "systemctl restart $(SERVICE)"

logs:
	ssh -i $(SSH_KEY) $(SERVER) "journalctl -u $(SERVICE) -f"

status:
	ssh -i $(SSH_KEY) $(SERVER) "systemctl status $(SERVICE) --no-pager"
