# Compound Engineering: Complete Reference

## Core Philosophy

The foundational principle: "Each unit of engineering work should make subsequent units easier--not harder."

Traditional development accumulates debt; compound engineering inverts this. Every bug fix prevents future bugs, every pattern codified becomes a future tool.

### Beliefs to Abandon
- You must write code yourself -> ensure *good code gets written*
- You must review every line -> build systems that catch what you'd catch
- You must devise solutions -> your job is *taste*, not invention
- Code is the primary artifact -> the system producing good code matters more
- Writing code is the job -> shipping value is the job

### Beliefs to Adopt
- **Extract taste into systems** -- preferences living in your head don't scale; encode them into agents and CLAUDE.md
- **50/50 rule** -- half your time improving systems, half building features
- **$100 Rule** -- when something fails preventably, spend effort on permanent fixes (tests, rules, evals)
- **Agent-native environment** -- if you can run tests, check logs, or create PRs, agents should be able to as well
- **Build for future models** -- favor agentic architectures over rigid workflows that break when models improve
- **Parallelization** -- the old constraint was human attention; the new constraint is compute

---

## The AI Development Ladder

### Stage 0: No AI
Pure manual coding, all human-driven research and debugging.

### Stage 1: Chat-Based AI
Copy-paste snippets from ChatGPT/Claude. No codebase awareness. You review everything.

### Stage 2: Agentic with Line-by-Line Review
Agent reads/writes your files directly. You approve every action, review every diff. *Most developers stop here.*

### Stage 3: Plan and Review PR Only
Thorough upfront planning -> "implement this" -> walk away -> review only the final PR. **This is where compounding begins.**

### Stage 4: Idea to PR
Describe what you want -> agent plans, implements, self-reviews, creates PR -> you review the result only.

### Stage 5: Parallel in the Cloud
Multiple agents in cloud infrastructure working simultaneously. Proactive monitoring; agents propose features from user feedback.

### Self-Assessment Quiz
- Copy-paste snippets -> Stage 1
- Approve each agent action -> Stage 2
- Implement a plan while doing something else -> Stage 3
- Describe and review the PR -> Stage 4
- Parallel implementations in flight -> Stage 5

---

## Leveling Up

| From | To | Key Action |
|------|----|-----------|
| 0->1 | Start with questions, then boilerplate | Install Claude Code or Cursor |
| 1->2 | Let agent modify files directly | Review diffs, not just final code |
| 2->3 | Write explicit plans; walk away during implementation | Review at PR level only |
| 3->4 | Give high-level descriptions; agent plans too | Approve approach, not implementation details |
| 4->5 | Cloud execution; multiple parallel work streams | Build queue and notification infrastructure |

### 30/60/90 Day Timeline
- **Days 1-30**: One lane (building). Set up git worktrees, create CLAUDE.md with 5 strong opinions, apply $100 rule to first breakage.
- **Days 31-60**: Add review lane. Build eval harness, document architectural principles, create anti-pattern review commands.
- **Days 61-90**: All three lanes. Context docs that self-update, eval suite catching regressions, 5x original velocity.

---

## The Main Loop

```
Plan -> Work -> Review -> Compound -> Repeat
```

The 80/20 split: 80% of thinking happens in Plan and Review; only 20% in Work and Compound.

### 1. PLAN

**Fidelity levels:**
- *Small*: Single-file, known bug, minimal research
- *Medium*: New functionality, multi-file, moderate research
- *Large*: Architectural changes, parallel research agents, edge cases and rollback strategy

**Research tactics:**
- **Best Practices** -- internet search for real-world opinions, not generic model knowledge
- **Codebase Grounding** -- find existing similar implementations before building new ones
- **Library Source** -- read installed package source rather than docs; agent sees actual available APIs
- **Git History** -- examine past commits to understand direction and intent
- **Vibe Coding Prototype** -- when uncertain what to build, prototype first, then plan properly and discard prototype

**Planning agents:**
| Agent | Role |
|-------|------|
| framework-docs-researcher | Official documentation and patterns |
| best-practices-researcher | Industry standards, community examples |
| repo-research-analyst | Codebase structure and conventions |
| git-history-analyzer | Code evolution and rationale |

**A complete plan includes:** context/why, approach/strategy, files affected, edge cases, test strategy, rollback plan.

---

### 2. WORK

Agent creates isolated worktree -> implements step by step -> runs validations -> handles issues -> opens PR.

Your role: monitor, not supervise. Intervene only when tests fail repeatedly, agent is stuck, or plan had a fundamental flaw. When intervening, *update the plan* -- let the agent fix the code from there.

---

### 3. REVIEW (Assess)

Run `/review` to launch 12+ specialized agents in parallel. Output is prioritized:

```
P1 - CRITICAL: Must fix before merge
P2 - IMPORTANT: Should fix
P3 - MINOR: Nice to fix
```

**Full agent roster:**

| Agent | Specialty |
|-------|-----------|
| security-sentinel | OWASP top 10, injection, auth vulnerabilities |
| performance-oracle | N+1 queries, caching, bottlenecks |
| architecture-strategist | System design, component boundaries |
| data-integrity-guardian | Migrations, transactions, referential integrity |
| data-migration-expert | ID mappings, rollback safety, production validation |
| code-simplicity-reviewer | YAGNI, unnecessary complexity, readability |
| kieran-rails-reviewer | Rails conventions, Turbo Streams, fat models |
| dhh-rails-reviewer | 37signals style, simplicity over abstraction |
| kieran-python-reviewer | PEP 8, type hints, Pythonic patterns |
| kieran-typescript-reviewer | Type safety, modern patterns, clean architecture |
| pattern-recognition-specialist | Design patterns, anti-patterns, code smells |
| deployment-verification-agent | Pre/post-deploy checklists, rollback plans |
| agent-native-reviewer | Ensures features accessible to agents, not just humans |
| julik-frontend-races-reviewer | JS race conditions, DOM event handling |

**Three questions when you lack tooling** (before approving any AI output):
1. "What was the hardest decision you made here?"
2. "What alternatives did you reject, and why?"
3. "What are you least confident about?"

---

### 4. COMPOUND

Immediately after solving non-trivial problems: document the solution with YAML frontmatter, tag for searchability, add to compound docs.

**Compound doc structure:**
```yaml
---
title: [descriptive title]
category: [debugging/architecture/etc]
tags: [relevant, searchable, terms]
created: [date]
---
## Problem
## Root Cause
## Solution
## Prevention
```

What to compound: bug fixes, reusable patterns, mistakes to avoid, deliberate approach choices.

---

## Slash Commands Reference (23 total)

### Core Workflow
| Command | Purpose |
|---------|---------|
| `/plan` | Transform idea -> detailed implementation plan (small/medium/large fidelity) |
| `/work` | Execute plan with worktrees and progress tracking |
| `/review` | Run all review agents in parallel, output prioritized findings |
| `/compound` | Document solved problems as searchable knowledge |
| `/lfg` | Full autonomous loop: idea -> plan approval -> implementation -> review -> PR |

### Resolution
| Command | Purpose |
|---------|---------|
| `/resolve_parallel` | Fix all TODO comments in codebase simultaneously |
| `/resolve_pr_parallel` | Address all PR review findings in parallel (P1 first) |
| `/resolve_todo_parallel` | Resolve file-based todos from the todo tracking system |

### Utilities
| Command | Purpose |
|---------|---------|
| `/changelog` | Generate changelogs from recent merges |
| `/triage` | Interactive prioritization of review findings |
| `/reproduce-bug` | Investigate bugs via logs, console, browser screenshots |
| `/test-browser` | Run Playwright tests on pages affected by current changes |
| `/plan_review` | Multi-agent review of a plan before implementation begins |
| `/deepen-plan` | Enhance existing plan with additional research and detail |
| `/create-agent-skill` | Create or edit skills with expert guidance |
| `/generate_command` | Create new slash commands following conventions |
| `/heal-skill` | Fix skill docs with incorrect instructions or outdated API references |
| `/report-bug` | Submit structured bug reports for the plugin |
| `/release-docs` | Update documentation site with current plugin components |
| `/deploy-docs` | Validate and prepare docs for GitHub Pages |
| `/agent-native-audit` | Scored review of codebase accessibility to AI agents |
| `/feature-video` | Record feature walkthrough video for PR description |
| `/xcode-test` | Build and test iOS apps on simulator via XcodeBuildMCP |

### Common Command Combinations

**Standard feature:**
```
/plan -> review plan -> /work -> /review -> /resolve_pr_parallel -> merge -> /compound
```

**Quick bug fix:**
```
/reproduce-bug -> /plan [fast] -> /work -> /review -> merge -> /compound
```

**High-stakes feature:**
```
/plan [ultra-think] -> /deepen-plan -> /plan_review -> /work -> /review -> /test-browser -> merge -> /compound
```

**Full autonomous:**
```
/lfg -> approve plan -> review final PR -> merge
```

---

## The Plugin

Open source. Installation:
```bash
claude /plugin marketplace add https://github.com/EveryInc/every-marketplace
claude /plugin install compound-engineering
```

Works in Claude Code (primary), Cursor, Droid from Factory, and any IDE with Claude integration. Agents and commands are markdown files.

### Skills (14 total)

**Development:**
| Skill | Purpose |
|-------|---------|
| andrew-kane-gem-writer | Ruby gems with clean APIs and smart defaults |
| dhh-rails-style | Rails code in 37signals style, REST purity, Hotwire |
| dspy-ruby | Type-safe LLM applications with DSPy.rb |
| frontend-design | Production-grade frontend interfaces |
| create-agent-skills | Build new skills following best practices |
| skill-creator | Guide for creating effective skills with proper structure |
| agent-native-architecture | Applications where agents are first-class citizens |

**Workflow:**
| Skill | Purpose |
|-------|---------|
| compound-docs | Capture solutions as searchable documentation |
| file-todos | File-based todo tracking with priorities |
| git-worktree | Manage worktrees for parallel development |
| every-style-editor | Content editing for Every's style guide |
| agent-browser | Browser automation via CLI |
| rclone | Upload and sync files to cloud storage |

**Image Generation:**
| Skill | Purpose |
|-------|---------|
| gemini-imagegen | Generate/edit images via Gemini API (requires `GEMINI_API_KEY`) |

### MCP Servers (2)
- **Playwright** -- browser navigation, screenshots, clicking, form filling, JS execution
- **Context7** -- real-time framework documentation lookup (vs. relying on training data)

Both require manual setup in `.claude/settings.json`.

---

## Customization

**Add an agent** -- markdown file in `agents/` with role description, usage criteria, and review instructions.

**Add a command** -- markdown file in `commands/` with description and agent instructions.

**Add a skill** -- directory in `skills/` with `SKILL.md` containing YAML frontmatter (name, description) and instructions.

**Update CLAUDE.md** -- add project-specific conventions, review checklists, naming patterns, error-handling preferences.

---

## Mission Control Setup

Three-lane parallel operation:
- **Left**: Planning Claude -- reads issues, researches, writes implementation plans
- **Middle**: Building Claude -- takes plans, writes code, creates tests
- **Right**: Reviewing Claude -- checks output against CLAUDE.md, flags issues

Feels awkward for roughly a week; becomes natural thereafter.

---

## The Compound Flywheel

- Review 1: slow -- teaching the agent what to look for
- Review 2: faster -- agent remembers prior feedback
- Review 10: catches things you used to miss -- agent learned implicit patterns
- Review 100: runs in parallel with five others -- you review findings, not code

"The question isn't 'did I catch every error?' It's 'did I teach the system what good looks like?'"
