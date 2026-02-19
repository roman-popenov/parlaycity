# Gap Analysis: ParlayCity vs. Compound Engineering Best Practices
# Feb 2026 -- based on Every articles + current CLAUDE.md state

## Scoring

- STRONG: We do this well
- PARTIAL: We have some of it but not the full pattern
- MISSING: Not doing this at all
- N/A: Not applicable to our context

---

## 1. CLAUDE.md Quality

| Aspect | Status | Notes |
|--------|--------|-------|
| Root CLAUDE.md with invariants | STRONG | 7 invariants, all enforced and tested |
| Per-package CLAUDE.md files | STRONG | contracts, shared, services, web all have them |
| Gap analysis (EXISTS/NEEDS/DISCONNECTED) | STRONG | Unique to us -- very useful decision gate |
| Lean and opinionated (10 rules > 100 generic) | PARTIAL | Root is ~200 lines. Good content but could prune boilerplate. Some sections are reference material that belongs in docs, not CLAUDE.md |
| Living document (updated after every mistake) | PARTIAL | We update it manually. No automated feedback codifier |
| Global ~/.claude/CLAUDE.md | STRONG | Clear permissions, style rules, hackathon workflow |

**Action items:**
- [ ] Move deep specs list and architecture description out of root CLAUDE.md into docs. CLAUDE.md should be rules and opinions, not reference.
- [ ] Add a "Lessons Learned" section that gets appended after every bug fix or review finding.
- [ ] Wire up feedback codifier pattern: after PR review, extract lessons -> append to CLAUDE.md.

---

## 2. Workflow: Plan -> Work -> Review -> Compound

| Phase | Status | Notes |
|-------|--------|-------|
| Plan | PARTIAL | We plan informally. Not using `/plan` command or structured plan documents. PR strategy is defined but per-feature plans aren't written artifacts. |
| Work | STRONG | `make dev` -> implement -> `make gate`. Clear quality gate. |
| Review | PARTIAL | We run `make gate` (tests + typecheck + build). Not using 14-agent parallel review. Not running `/review`. |
| Compound | MISSING | No `/compound` usage. No `docs/solutions/` directory. Lessons stay in conversation context and are lost on session end. |

**Action items:**
- [ ] Start using `/plan` for medium+ features. Write plan to `docs/plans/` before implementing.
- [ ] Run `/review` on PRs before merge (in addition to `make gate`).
- [ ] Create `docs/solutions/` directory. After every non-trivial fix, run `/compound` to document it.
- [ ] Add to CLAUDE.md: "After every bug fix or non-trivial feature, run /compound."

---

## 3. Parallel Execution

| Aspect | Status | Notes |
|--------|--------|-------|
| Agent teams enabled | STRONG | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings |
| 3-lane mission control | MISSING | Not using Left/Middle/Right terminal pattern |
| Git worktrees for parallel work | MISSING | Working on single branch at a time |
| Split-day pattern | MISSING | No structured morning=ship / afternoon=explore cadence |
| Feature queue | PARTIAL | PR strategy serves as implicit queue but not formalized |

**Action items:**
- [ ] Try 3-lane setup on next medium+ feature: Plan in tab 1, Build in tab 2, Review in tab 3.
- [ ] Use git worktrees when working on 2+ independent features simultaneously.
- [ ] Consider formalizing feature queue as GitHub issues with priority labels.

---

## 4. Subagent Patterns

| Pattern | Status | Notes |
|---------|--------|-------|
| Executor/Evaluator loop | MISSING | Not using build+review agent pairs |
| Opponent Processors | MISSING | Not using adversarial validation |
| Feedback Codifier | MISSING | PR review lessons not auto-extracted |
| Research Agent | PARTIAL | We read docs/specs manually. Not spawning research agents before features. |
| Log Investigator | N/A | No production environment yet (hackathon) |

**Action items:**
- [ ] For the next contract feature (SafetyModule or Cashout): spawn a research agent first to scan similar protocols.
- [ ] After next PR review, try the feedback codifier: extract lessons -> CLAUDE.md.
- [ ] For architectural decisions, try opponent processors: one agent argues for approach A, another for B.

---

## 5. Compounding Mechanics

| Aspect | Status | Notes |
|--------|--------|-------|
| docs/solutions/ knowledge base | MISSING | No structured solution documentation |
| YAML-frontmatter tagged learnings | MISSING | No searchable categorized learnings |
| Test-driven prompt engineering | N/A | No LLM prompts in our product (pure smart contracts) |
| Automated visual documentation | MISSING | No before/after screenshots on UI PRs |
| Every failure prevents its category | PARTIAL | We add tests for specific bugs but don't always generalize to the category |

**Action items:**
- [ ] Create `docs/solutions/` with first entry from recent bug fixes (e.g., the parseDecimal fix, the zero-guard vault fix).
- [ ] Template for solutions: Problem, Root Cause, Solution, Prevention, Tags.
- [ ] After UI changes, consider screenshot comparison (low priority for hackathon).

---

## 6. Agent-Native Architecture

| Principle | Status | Notes |
|-----------|--------|-------|
| Parity (agent can do what user does) | PARTIAL | Agent can run all make commands, deploy, test. But no MCP for contract interaction or frontend testing. |
| Granularity (atomic tools) | STRONG | Makefile commands are atomic and composable |
| Composability | STRONG | `make gate` = `test-all` + `typecheck` + `build-web` |
| Emergent capability | PARTIAL | Agent can explore codebase freely. But no Playwright MCP for UI testing. |
| Improvement over time | PARTIAL | CLAUDE.md exists but isn't being actively compounded. |

**Action items:**
- [ ] Consider adding Playwright MCP for UI verification (would let agents test the frontend visually).
- [ ] Ensure Context7 MCP is configured for Solidity/OpenZeppelin docs lookup.

---

## 7. Security and Safety

| Aspect | Status | Notes |
|--------|--------|-------|
| Contract security checklist | PARTIAL | Invariants are tested. But no explicit checklist (reentrancy, overflow, access control) in CLAUDE.md. |
| "Security note" on contract PRs | STRONG | Required by root CLAUDE.md |
| Stakes x Reversibility for approvals | PARTIAL | Global CLAUDE.md has permission rules but no explicit matrix |
| No discretionary drain paths | STRONG | Invariant #5, tested |

**Action items:**
- [ ] Add a contract security checklist to `packages/contracts/CLAUDE.md`: reentrancy guards, SafeERC20, access control on state-changing functions, event emissions, input validation.
- [ ] Document rollback strategy for each PR (what to do if a deployed contract has a bug).

---

## 8. Missing Infrastructure

| Item | Priority | Notes |
|------|----------|-------|
| Error handling conventions (services) | Medium | No standard error response shape or status code convention |
| ABI sync protocol | High | Changed contract ABI -> manual update in `lib/contracts.ts`. Silent breakage risk. |
| Branch naming convention | Low | "Small PRs against main" is sufficient for hackathon |
| DISCONNECTED items unblocking plan | Medium | 3 items (sweepPenaltyShares, MultiplierClimb, AaveYieldAdapter) need owners/PRs |
| Cashout acceptance criteria | High | Core product differentiator has no test matrix |

---

## Priority Ranking for Hackathon

### Do Now (highest leverage, lowest effort)
1. Create `docs/solutions/` and document the last 2-3 bug fixes
2. Start running `/review` on PRs before merge
3. Add contract security checklist to contracts CLAUDE.md
4. Define cashout acceptance criteria

### Do This Week
5. Run `/plan` on next feature (SafetyModule or Cashout)
6. Try 3-lane terminal setup on one feature
7. Wire up feedback codifier after next PR review
8. Trim root CLAUDE.md (move reference material to docs)

### Do When Time Allows
9. Set up git worktrees for parallel features
10. Add Playwright MCP for UI testing
11. Formalize ABI sync protocol
12. Create solution docs for all DISCONNECTED items
