---
status: complete
priority: p3
issue_id: "034"
tags: [code-review, security, pr19]
dependencies: []
---

# Shell injection in Python get_addr() via string interpolation

## Problem Statement

demo-seed.sh and demo-resolve.sh interpolated $1 and $BROADCAST directly into Python source code via string interpolation. A malicious broadcast filename or contract name could inject arbitrary Python code.

## Solution

Changed get_addr() in both scripts to pass $BROADCAST and $1 as sys.argv arguments to the Python script instead of shell string interpolation.

## Acceptance Criteria

- [x] get_addr uses sys.argv for arguments instead of shell interpolation
