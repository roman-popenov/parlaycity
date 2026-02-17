#!/usr/bin/env bash
set -euo pipefail

# ParlayCity — install all dev prerequisites
# Usage: ./scripts/bootstrap.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[x]${NC} $1"; exit 1; }
check() { command -v "$1" &>/dev/null; }

# -- Homebrew (macOS) --
if [[ "$(uname)" == "Darwin" ]] && ! check brew; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# -- Node.js --
if ! check node; then
    info "Installing Node.js 20 via nvm..."
    if ! check nvm; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi
    nvm install 20
    nvm use 20
else
    NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if (( NODE_VERSION < 18 )); then
        warn "Node.js $(node -v) detected — v18+ required"
    else
        info "Node.js $(node -v) OK"
    fi
fi

# -- pnpm --
if ! check pnpm; then
    info "Installing pnpm..."
    npm install -g pnpm
else
    info "pnpm $(pnpm -v) OK"
fi

# -- Foundry (forge, anvil, cast) --
if ! check forge; then
    info "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
    foundryup
else
    info "Foundry ($(forge --version | head -1)) OK"
fi

# -- Docker --
if ! check docker; then
    warn "Docker not found — needed for 'make ci' (act)"
    warn "Install Docker Desktop: https://docs.docker.com/desktop/"
else
    info "Docker $(docker --version | awk '{print $3}' | tr -d ',') OK"
fi

# -- act (local CI runner) --
if ! check act; then
    info "Installing act..."
    if check brew; then
        brew install act
    else
        warn "Install act manually: https://github.com/nektos/act#installation"
    fi
else
    info "act $(act --version | awk '{print $NF}') OK"
fi

echo ""
info "All prerequisites checked. Run 'make setup' to install project dependencies."
