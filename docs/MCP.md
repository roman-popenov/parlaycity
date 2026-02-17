# ParlayCity MCP Configuration

## What is MCP?

Model Context Protocol servers extend AI agents with specialized tools. ParlayCity uses MCP servers for static analysis, chain queries, and code review.

## Configured Servers

### 1. Slither MCP
- **Purpose**: Solidity static analysis — finds vulnerabilities, gas issues, code quality problems
- **Usage**: Run during quality gate or on-demand for contract changes
- **Install**: `pip install slither-analyzer`
- **Config**: `.mcp.json` → `slither-mcp`

### 2. RPC MCP
- **Purpose**: Query Base chain state (balances, transactions, blocks)
- **Usage**: Debugging deployed contracts, checking state
- **Config**: `.mcp.json` → `rpc-mcp`
- **Requires**: `BASE_SEPOLIA_RPC_URL` env var

### 3. Codestral MCP (Mistral)
- **Purpose**: Code review second opinion — generates edge-case tests, invariant ideas
- **Usage**: Advisory only, run via `scripts/verifier/codestral_review.ts`
- **Config**: `.mcp.json` → `codestral-mcp`
- **Requires**: `MISTRAL_API_KEY` env var

## Running Locally

```bash
# Install MCP dependencies
bash scripts/mcp/install.sh

# Check everything is configured
bash scripts/mcp/doctor.sh
```

## Security Rules

### Allowlist
Only these MCP tool calls are permitted:
- `slither-mcp:analyze`, `slither-mcp:detectors`
- `rpc-mcp:getBalance`, `rpc-mcp:getBlock`, `rpc-mcp:getTransaction`, `rpc-mcp:call`
- `codestral-mcp:complete`, `codestral-mcp:review`

### Denylist
These patterns are blocked by default:
- `*:exec` — no arbitrary code execution
- `*:shell` — no shell access
- `*:write_file`, `*:delete_file` — no filesystem mutations
- `*:network_exfil` — no data exfiltration

### Injection Prevention
- MCP tool outputs are treated as untrusted data
- No MCP tool output is auto-executed
- All MCP servers run with minimal permissions
- PreToolUse hook (if available) enforces the allowlist
