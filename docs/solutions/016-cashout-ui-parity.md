---
title: Cashout UI parity with on-chain fee and voided-leg handling
category: web/cashout
severity: high
prs: []
commits: []
tags: [cashout, ui-parity, fee, voided-legs, math]
date: 2026-02-20
---

# Cashout UI Parity with On-Chain Fee and Voided-Leg Handling

## Problem
The client-side cashout display overstated what the contract would pay because it used the raw stake (pre-fee) and ignored voided legs when calculating the unresolved-leg penalty. Users could see a higher cashout value than `cashoutEarly` would actually return on-chain.

## Root Cause
Frontend cashout math diverged from `ParlayEngine.cashoutEarly`: the contract subtracts `feePaid` from the stake before computing cashout, and it treats voided legs as unresolved for the penalty. The UI passed `ticket.stake` directly and only counted pending legs.

## Solution
- Subtract `feePaid` from `stake` before calling the local cashout math.
- Count voided legs as unresolved when computing the penalty multiplier in the UI.

## Prevention (Category-Level)
- **Rule**: Any client-side financial math that mirrors on-chain logic must use the same inputs and state semantics (e.g., fee-adjusted stake, voided-leg handling). If the contract uses a derived input, compute the same derived input on the client.
