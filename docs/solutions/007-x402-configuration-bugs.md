---
title: x402 configuration bugs -- silent production failures
category: services/config
severity: high
prs: [5]
tags: [x402, env-vars, configuration, zero-address, production]
date: 2026-02-18
---

# x402 Configuration Bugs -- Silent Production Failures

## Problem
Six configuration issues found in x402 payment integration, all causing silent failures in production:

1. **`accepts` is object, not array**: SDK expects `accepts: [{...}]`, code passed `accepts: {...}`. Only runs in production, untested by stub suite.

2. **Env var name mismatch**: Code reads `X402_RECIPIENT_WALLET`, `.env.example` documents `X402_PAYMENT_ADDRESS`. Setup instructions lead to silent fallback to zero address.

3. **Zero-address default**: Missing env var silently sets USDC payment recipient to `0x0000...0`. Real payments sent to burn address.

4. **Facilitator URL mismatch**: Default URL didn't match official x402 SDK docs.

5. **Stub path bypass**: Exact string comparison `req.path !== "/premium/sim"` bypassed by trailing slash `/premium/sim/` or case variation.

6. **Deprecated export**: Dead `x402Guard` export with wrong environment behavior.

## Root Cause
Production code path was completely untested because the test suite used stubs. Env var names drifted between code and docs without a single source of truth.

## Solution
- Array format for `accepts`
- Unified env var naming across code + docs
- Production throws on zero-address recipient
- Facilitator URL from SDK defaults
- Path normalization (lowercase + strip trailing slash)
- Removed dead exports

## Prevention (Category-Level)
- **Rule**: Production code paths MUST have at least one integration test, even if using mocked externals.
- **Rule**: Env var names must be defined in ONE place (constants file) and referenced everywhere. Never hardcode env var strings.
- **Rule**: Any default that falls back to a zero/empty value in production MUST throw, not silently proceed.
- **Rule**: Path matching must normalize case and trailing slashes.
- **Rule**: When integrating an SDK, copy the exact config format from official docs/examples, don't reconstruct from memory.
