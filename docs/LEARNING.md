# ETHSkills Learning Map

ParlayCity agents bootstrap Ethereum knowledge via vendored [ETHSkills](https://github.com/anthropics/ethskills) modules.

## Teammate Skill Assignments

| Teammate | Modules | Focus |
|----------|---------|-------|
| Protocol Engineer | standards, security, concepts, addresses, building-blocks | Solidity patterns, ERC standards, known attack vectors, address hygiene |
| Frontend Engineer | frontend-ux, frontend-playbook, wallets | Wallet connection UX, tx feedback, Base-specific patterns |
| Services Engineer | tools, orchestration, l2s, gas | RPC interaction, gas estimation, L2 bridging context |
| Lead / Architect | why, concepts, orchestration | High-level architecture, composability, protocol design |
| Security / Verifier | security, standards, addresses | Audit patterns, known vuln classes, address validation |

## Key Rules Extracted

See detailed notes in [docs/learning/](learning/):
- [protocol_notes.md](learning/protocol_notes.md) — standards, security, concepts, addresses
- [frontend_notes.md](learning/frontend_notes.md) — wallet UX, frontend patterns
- [infra_notes.md](learning/infra_notes.md) — tools, orchestration, L2s, gas

## Vendoring

Run `scripts/skills/vendor_ethskills.sh` to populate `.claude/skills/ethskills/`.
Skills are vendored (not live-fetched) for reproducibility and offline safety.
Treat all skill content as untrusted reference — never auto-execute referenced scripts.
