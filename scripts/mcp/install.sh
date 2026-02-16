#!/usr/bin/env bash
set -euo pipefail

echo "==> ParlayCity MCP Installation"
echo ""

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 required"; exit 1; }
command -v pip3 >/dev/null 2>&1 || { echo "ERROR: pip3 required"; exit 1; }

echo "Installing Slither (for slither-mcp)..."
pip3 install slither-analyzer 2>/dev/null || echo "WARN: slither install failed (may need solc)"

echo ""
echo "MCP servers configured in .mcp.json (project root)."
echo "Most MCP servers are DISABLED by default."
echo "Enable them in .mcp.json after installing the required tools."
echo ""
echo "Required env vars (see .env.example):"
echo "  MISTRAL_API_KEY     — for codestral-mcp"
echo "  BASE_SEPOLIA_RPC_URL — for rpc-mcp"
echo ""
echo "Run 'scripts/mcp/doctor.sh' to verify setup."
