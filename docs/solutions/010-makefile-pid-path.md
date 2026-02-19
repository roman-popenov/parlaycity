---
title: PID files written to wrong directory in Makefile
category: devtools/makefile
severity: low
prs: [2]
tags: [makefile, pid, background-process, dev-environment]
date: 2026-02-17
---

# PID Files Written to Wrong Directory in Makefile

## Problem
`make dev` starts services and web in background subshells after `cd packages/services` and `cd apps/web`. Log redirects used `../../$(PID_DIR)/` (correct, since they run inside the subshell after `cd`). PID file echoes also used `../../$(PID_DIR)/` but `echo $$!` runs in the PARENT shell at repo root (after `&`). Result: PID files written to wrong path, `make dev-stop` couldn't find processes.

## Root Cause
Misunderstanding of which shell context `echo $$!` runs in after `&`. The `&` backgrounds the `(cd && nohup ...)` subshell, but `echo $$!` runs in the original Makefile shell.

## Solution
PID echo targets use `$(PID_DIR)/` (no prefix, runs at repo root). Log redirects keep `../../$(PID_DIR)/` (runs inside subshell after `cd`).

## Prevention (Category-Level)
- **Rule**: When backgrounding a subshell, trace which commands run in which working directory. `&` returns control to the parent immediately.
- **Rule**: Test `make dev` + `make dev-stop` + `make dev-status` as a trio -- if stop can't find PIDs, the write path is wrong.
- **Rule**: Prefer absolute paths in Makefile process management to avoid `cd` confusion.
