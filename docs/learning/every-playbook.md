# Compound Engineering Playbook
# Actionable patterns extracted from Every articles (Feb 2026)
# Only patterns NOT already encoded in the compound-engineering plugin v2.35.1

## Session Management

- `claude --continue` to resume last session. Avoids context loss between work blocks.
- Start sessions with "catch me up on the last N days" -- Claude reads files by date, summarizes progress.
- Keep a Daily Progress folder: Claude writes a structured summary after each task (what was tried, what failed, what succeeded). Synthesize into CLAUDE.md over time.
- After compaction, always preserve: current goal, modified files, commands run, remaining TODOs, which gap items were addressed.

## CLAUDE.md Philosophy

- 10 specific rules you follow beat 100 generic ones. Prune aggressively.
- "If it doesn't resonate with you personally, it won't guide the AI effectively."
- When Claude makes a mistake once, immediately say "add this to CLAUDE.md." Don't fix silently -- encode it.
- Write lint rules for patterns that get corrected repeatedly.
- Check `settings.json` into the repo so pre-allowed/blocked commands are shared across the team.
- CLAUDE.md is your taste in plain language. It should read like your software philosophy.

## Planning

- Use plan mode for anything that would have taken >2 hours of human time. 2-3x success rate improvement.
- Explicitly tell Claude "ask me questions if there's anything you're unsure about" -- it doesn't do this naturally.
- Prototype first (throwaway), then discard and implement properly. Cost of exploration is near-zero.
- Include user-facing copy in plans (error messages, UI strings) so the agent has them during implementation.
- After each implementation, document what the plan missed so future plans are more complete.

## The 3-Lane Mission Control

```
Left terminal:   PLANNING   -- reads issues, researches, writes implementation plans
Middle terminal: BUILDING   -- takes plans, writes code, creates tests
Right terminal:  REVIEWING  -- reviews output against CLAUDE.md, catches issues
```

Feels awkward for ~1 week. Becomes natural after. Use separate git worktrees for each lane.

## Parallel Execution

- Run up to 10 agents simultaneously. Each gets its own context window, won't interfere.
- For large migrations: main agent builds to-do list, map-reduce over 10+ subagents in parallel.
- Use worktrees for parallel features: 3 features, 3 agents, 3 branches. Review PRs as they finish.
- Build a feature queue. Feed it with ideas, bugs, improvements. Agents pull when they have capacity.

## Subagent Patterns

### Executor/Evaluator Loop
One agent builds, another reviews. They iterate until quality bar is met. The reviewer isn't biased by the builder's memory (separate context windows).

### Opponent Processors
Two agents argue opposing positions to stress-test a decision. E.g., one argues for approach A, another for B. Claude mediates.

### Feedback Codifier
After leaving PR comments, run the codifier. It extracts lessons and stores them in CLAUDE.md. Next time Claude reviews, it already knows your standards.

### Research Agent
Before building a new feature, scan open-source projects for how others solved it. Produces a report with tradeoffs, best practices, pitfalls.

### Log Investigator
Parse error logs in a separate context (not your main thread). Returns only what matters.

### Rule of Thumb
- 90% project agents, 10% personal agents.
- Slash commands start work. Subagents are colleagues you call in mid-stream.
- Create a subagent when you notice you're repeating a task. Don't pre-build a library of 20.

## The Compounding Step (the step most engineers skip)

- After every non-trivial fix: document with YAML frontmatter, tag for searchability.
- Every failure should prevent its ENTIRE CATEGORY, not just the specific instance.
- Treat `docs/solutions/` as institutional knowledge. Every solved problem should land there.
- Replace "ask X, they know how auth works" with a searchable solution doc.
- Run `/compound` after every implementation. Don't rely on tribal knowledge.

## Test-Driven Prompt Engineering

From Kieran's frustration detector example:
1. Write a test case from a sample interaction
2. Have Claude write detection logic
3. Run the test -- it fails (expected)
4. Have Claude iterate on the prompt until test passes
5. Run 10x to check non-deterministic reliability
6. Analyze failures, discover patterns in missed cases
7. Update prompt to handle discovered edge cases
8. Repeat until 9/10 pass rate

## Review: The Three Questions

Before approving any AI output, ask:
1. "What was the hardest decision you made here?"
2. "What alternatives did you reject, and why?"
3. "What are you least confident about?"

These surface judgment calls the agent knows about but won't volunteer.

## Agent-Native Architecture Principles

### 1. Parity
Whatever the user can do through UI, the agent should achieve through tools. When adding any UI capability, ask: Can the agent achieve this outcome?

### 2. Granularity
Tools = atomic primitives. Features = outcomes described in prompts, achieved by agent + tools in a loop. To change behavior, edit prompts, not code.

### 3. Composability
With atomic tools and parity, new features = new prompts. No code changes needed.

### 4. Emergent Capability
The agent can accomplish things you didn't design for. Build a capable foundation, observe what users ask the agent to do, formalize patterns that emerge.

### 5. Improvement Over Time
Unlike traditional software, agent-native apps improve without shipping code. Accumulated context, prompt refinement, user-level customization.

### Files as Universal Interface
- Agents are naturally fluent with files (cat, grep, mv, mkdir)
- Files are inspectable, portable, self-documenting
- `/projects/acme/notes/` is self-documenting; `SELECT * FROM notes WHERE project_id = 123` is not
- Use the `context.md` pattern: agent reads at session start, updates as state changes

### Stakes x Reversibility Matrix
| Stakes | Reversibility | Pattern | Example |
|--------|--------------|---------|---------|
| Low | Easy | Auto-apply | Organizing files |
| Low | Hard | Quick confirm | Publishing to feed |
| High | Easy | Suggest + apply | Code changes |
| High | Hard | Explicit approval | Sending emails |

### Anti-Patterns to Avoid
- **Agent as router**: Agent just picks which function to call. Wastes 90% of capability.
- **Defensive tool design**: Over-constraining inputs prevents emergent behavior.
- **Workflow-shaped tools**: `analyze_and_organize()` bundles judgment into code. Break into primitives.
- **Context starvation**: Agent doesn't know what exists. Inject available resources into system prompt.

## Split-Day Pattern (from Yash)

- **Mornings**: Focused execution. Just Claude Code, no new tools. Ship.
- **Afternoons**: Exploration. Experiment with new agents, apps, features.

## Remote / Mobile Access

- Tailscale + cheap server + private GitHub repo = run Claude Code from phone (Terminus app)
- GitHub `@claude` mention on issues/PRs triggers Claude to investigate from your phone
- Use stop hooks to implement "keep going until tests pass" -- fires at turn completion, re-triggers if condition not met

## Mindset

- First attempts: ~95% garbage. Second: ~50%. Goal is iterate fast enough that third attempt lands in less total time than first.
- The developer who reviews 10 AI implementations understands more patterns than one who hand-typed 2.
- Taste belongs in systems, not in reviews. If it's only in your head, it doesn't scale and cannot compound.
- Companies pay $400/month for what used to cost $400,000/year. Leverage goes to those who teach systems faster than they type.
