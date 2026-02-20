---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, correctness, pr18]
dependencies: []
---

# Ticket ID race condition via ticketCount() - 1

## Problem Statement

risk-agent.ts reads ticketCount after buying a ticket and assumes the newest ticket is ticketCount - 1. On a shared chain, another user could buy a ticket between the bot's transaction and the ticketCount read.

## Proposed Solutions

### Option A: Parse TicketCreated event from receipt logs (Recommended)
- Effort: Small

## Acceptance Criteria

- [ ] Ticket ID obtained from transaction receipt event logs, not ticketCount

## Resources

- PR #18: https://github.com/roman-popenov/parlaycity/pull/18
