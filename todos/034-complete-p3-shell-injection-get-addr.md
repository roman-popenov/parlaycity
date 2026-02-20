---
status: complete
priority: p3
issue_id: "034"
tags: [code-review, security, pr19]
dependencies: []
---

# Shell injection in Python get_addr() via string interpolation

## Problem Statement

demo-seed.sh and demo-resolve.sh interpolate $1 and $BROADCAST directly into Python string. Pass as sys.argv instead.

## Acceptance Criteria

- [ ] get_addr uses sys.argv for arguments instead of shell interpolation
