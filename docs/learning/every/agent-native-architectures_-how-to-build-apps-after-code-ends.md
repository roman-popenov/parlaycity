2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Roman Popenov

Agent-native Architectures
A technical guide for building applications where
agents are first-class citizens

Dan Shipper

Claude

This document is coauthored by Dan Shipper and Claude. It synthesizes principles from apps

we've built (Reader, Anecdote) and ideas that emerged through conversation.

Some patterns here Dan stands behind—they're tested or deeply considered. Others are

Claude's contributions during the building process that need more validation. We've marked

those with callouts.

Read with Claude

Read with ChatGPT

Use in compound engineering

Why now
Software agents work reliably now. Claude Code demonstrated that a large language model
(LLM) with access to bash and file tools, operating in a loop until an objective is achieved, can

https://every.to/guides/agent-native

1/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

accomplish complex multi-step tasks autonomously.

The surprising discovery: A really good coding agent is actually a really good general-purpose
agent. The same architecture that lets Claude Code refactor a codebase can let an agent

organize your files, manage your reading list, or automate your workflows.

The Claude Code software development kit (SDK) makes this accessible. You can build

applications where features aren't code you write—they're outcomes you describe, achieved
by an agent with tools, operating in a loop until the outcome is reached.

This opens up a new field: software that works the way Claude Code works, applied to
categories far beyond coding.

Core principles

1

Parity

Whatever the user can do through the UI, the agent should

be able to achieve through tools.

This is the foundational principle. Without it, nothing else matters. Ensure the agent has tools
that can accomplish anything the UI can do.

The test: Pick any UI action. Can the agent accomplish it?

2

Granularity

https://every.to/guides/agent-native

2/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Tools should be atomic primitives. Features are outcomes

achieved by an agent operating in a loop.

A tool is a primitive capability. A feature is an outcome described in a prompt, achieved by an

agent with tools, operating in a loop until the outcome is reached.

The test: To change behavior, do you edit prompts or refactor code?

3

Composability

With atomic tools and parity, you can create new features

just by writing new prompts.

Want a "weekly review" feature? That's just a prompt:

"Review files modified this week. Summarize key changes.
Based on incomplete items and approaching deadlines,
suggest three priorities for next week."

The agent uses

list_files, read_file, and its judgment. You described an outcome;

the agent loops until it's achieved.

4

Emergent capability

The agent can accomplish things you didn't explicitly

design for.

The flywheel:

1. Build with atomic tools and parity

https://every.to/guides/agent-native

3/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

2. Users ask for things you didn't anticipate

3. Agent composes tools to accomplish them (or fails, revealing a gap)

4. You observe patterns in what's being requested

5. Add domain tools or prompts to make common patterns efficient

6. Repeat

The test: Can it handle open-ended requests in your domain?

5

Improvement over time

Agent-native applications get better through accumulated

context and prompt refinement.

Unlike traditional software, agent-native applications can improve without shipping code.

Accumulated context: State persists across sessions via context files

Developer-level refinement: Ship updated prompts for all users

User-level customization: Users modify prompts for their workflow

Principles in practice
The details that make the five principles operational.

Parity
Imagine a notes app with a beautiful interface for creating, organizing, and tagging notes. A user asks:

"Create a note summarizing my meeting and tag it as urgent." If the UI can do it but the agent can't, the

https://every.to/guides/agent-native

4/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

agent is stuck.

The fix: Ensure the agent has tools (or combinations of tools) that can accomplish anything the UI can

do. This isn't about a one-to-one mapping of UI buttons to tools—it's about achieving the same

outcomes.

The discipline: When adding any UI capability, ask: Can the agent achieve this outcome? If not, add the

necessary tools or primitives.

A capability map helps:

User Action

How Agent Achieves It

Create a note

write_file to notes directory, or create_note tool

Tag a note as urgent

update_file metadata, or tag_note tool

Search notes

search_files or search_notes tool

Delete a note

delete_file or delete_note tool

The test: Pick any action a user can take in your UI. Describe it to the agent. Can it accomplish the

outcome?

Granularity
The key shift: The agent is pursuing an outcome with judgment, not executing a choreographed

sequence. It can encounter unexpected cases, adjust its approach, or ask clarifying questions—the
loop continues until the outcome is achieved.

The more atomic your tools, the more flexibly the agent can use them. If you bundle decision logic into
tools, you've moved judgment back into code.

Composability
This works for developers and users. You can ship new features by adding prompts. Users can
customize behavior by modifying prompts or creating their own.

https://every.to/guides/agent-native

5/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

The constraint: this only works if tools are atomic enough to be composed in ways you didn't anticipate,

and if the agent has parity with users. If tools encode too much logic, composition breaks down.

Emergent Capability
Example: "Cross-reference my meeting notes with my task list and tell me what I've committed to but

haven't scheduled." You didn't build a commitment tracker, but if the agent can read notes and tasks, it
can accomplish this.

This reveals latent demand. Instead of guessing what features users want, you observe what they're
asking the agent to do. When patterns emerge, you can optimize them with domain-specific tools or

dedicated prompts. But you didn't have to anticipate them—you discovered them.

This changes how you build products. You're not trying to imagine every feature upfront. You're creating

a capable foundation and learning from what emerges.

Improvement over time
Accumulated context: The agent maintains state across sessions—what exists, what the user has

done, and what worked.

Prompt refinement at multiple levels: developer-level updates, user-level customization, and

(advanced) agent-level adjustments based on feedback.

Self-modification (advanced): Agents that edit their own prompts or code require safety rails—

approval gates, checkpoints, rollback paths, and health checks.

The mechanisms are still being discovered. Context and prompt refinement are proven; self-

modification is emerging.

Tools should be atomic primitives. Features are outcomes achieved by an agent operating in a loop. The

agent makes the decisions; prompts describe the outcome.

Less granular
https://every.to/guides/agent-native

6/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Tool: classify_and_organize_files(files)
→ You wrote the decision logic
→ Agent executes your code
→ To change behavior, you refactor
Bundles judgment into the tool. Limits flexibility.

More granular
Tools: read_file, write_file, move_file, bash
Prompt: "Organize the downloads folder..."
→ Agent makes the decisions
→ To change behavior, edit the prompt
Agent pursues outcomes with judgment. Empowers flexibility.

From primitives to domain tools
Start with pure primitives: bash, file operations, basic storage. This proves the architecture

works and reveals what the agent actually needs.

As patterns emerge, add domain-specific tools deliberately. Use them to anchor vocabulary,

add guardrails, or improve efficiency.

Vocabulary

Guardrails

Efficiency

create_note tool

Some operations need

Common operations can

teaches the agent what

validation that shouldn't

be bundled for speed

A

and cost.

https://every.to/guides/agent-native

7/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

"note" means in your

be left to agent

system.

judgment.

analyze_and_publish(input)

publish(content)

Bundles judgment into the tool

One action; agent decided what to
publish

The rule for domain tools: They should represent one conceptual action from the user's

perspective. They can include mechanical validation, but judgment about what to do or whether

to do it belongs in the prompt.

Keep primitives available. Domain tools are shortcuts, not gates. Unless there's a specific

reason to restrict access (security, data integrity), the agent should still be able to use
underlying primitives for edge cases. This preserves composability and emergent capability.

The default is open; make gating a conscious decision.

Graduating to code
Some operations will need to move from agent-orchestrated to optimized code for performance

or reliability.

Agent uses primitives in a loop

1

Flexible, proves the concept

Add domain tools for common operations

2

Faster, still agent-orchestrated

For hot paths, implement in optimized code

3

Fast, deterministic

https://every.to/guides/agent-native

8/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

The caveat: Even when an operation graduates to code, the agent should be able to trigger the

optimized operation itself and fall back to primitives for edge cases the optimized path doesn't

handle. Graduation is about efficiency. Parity still holds.

•

•

Agent can trigger the optimized operation directly

Agent can fall back to primitives for edge cases

Files as the universal interface
Agents are naturally good at files. Claude Code works because
bash + filesystem is the most battle-tested agent interface.

Already Known

Agents already know

cat, grep, mv, mkdir. File operations are the primitives they're most

fluent with.

Inspectable

Users can see what the agent created, edit it, move it, delete it. No black box.

Portable

Export is trivial. Backup is trivial. Users own their data.

Syncs Across Devices

On mobile with iCloud, all devices share the same file system. Agent's work appears
everywhere—without building a server.

https://every.to/guides/agent-native

9/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Self-Documenting

/projects/acme/notes/ is self-documenting in a way that SELECT * FROM notes
WHERE project_id = 123 isn't.

A general principle of agent-native design: Design for what agents can reason about. The best

proxy for that is what would make sense to a human. If a human can look at your file structure and

understand what's going on, an agent probably can too.

Needs validation

Claude's contribution from building; Dan is still forming his opinion. These conventions are

one approach that's worked so far, not a prescription. Better solutions should be

considered.

Entity-scoped directories
{entity_type}/{entity_id}/
├── primary content
├── metadata
└── related materials
Example:

Research/books/{bookId}/ contains full text, notes, sources, and agent

logs.

Directory naming
•

•

Entity-scoped:

Collections:

https://every.to/guides/agent-native

{entityType}/{entityId}/

{type}/ (e.g., AgentCheckpoints/)
10/36

2/19/26, 1:00 PM
•

Agent-native Architectures: How to Build Apps After Code Ends

Convention: lowercase with underscores, not camelCase

Markdown for human-readable content; JSON for structured data.

One approach to naming:
File

Naming Pattern

Entity data

{entity}.json

Human-readable

{content_type}.md

content

Example

library.json,
status.json
introduction.md,
profile.md

Agent reasoning

agent_log.md

Per-entity agent history

Primary content

full_text.txt

Downloaded/extracted text

Multi-volume

volume{N}.txt

volume1.txt, volume2.txt

External sources

{source_name}.md

Checkpoints

{sessionId}.checkpoint

UUID-based

Configuration

config.json

Feature settings

wikipedia.md,
sparknotes.md

Directory structure
Documents/
├── AgentCheckpoints/
│

# Ephemeral

└── {sessionId}.checkpoint

├── AgentLogs/
https://every.to/guides/agent-native

# Debugging
11/36

2/19/26, 1:00 PM

│

Agent-native Architectures: How to Build Apps After Code Ends

└── {type}/{sessionId}.md

└── Research/

# User's work

└── books/{bookId}/
├── full_text.txt
├── notes.md
└── agent_log.md

The context.md pattern
# Context
## Who I Am
Reading assistant for the Every app.
## What I Know About This User
- Interested in military history and Russian literature
- Prefers concise analysis
- Currently reading *War and Peace*
## What Exists
- 12 notes in /notes
- three active projects
- User preferences at /preferences.md
## Recent Activity
- User created "Project kickoff" (two hours ago)
- Analyzed passage about Austerlitz (yesterday)
## My Guidelines
- Don't spoil books they're reading
- Use their interests to personalize insights
## Current State

https://every.to/guides/agent-native

12/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

- No pending tasks
- Last sync: 10 minutes ago

The agent reads this file at the start of each session and updates it as state changes—
portable working memory without code changes.

Files vs. database
Needs validation

This framing is one way to think about it, and it's specifically informed by mobile

development. For web apps, the tradeoffs are different—Dan doesn't have a strong opinion

there yet.

Use files for...
•

•

•

•

•

Content users should read/edit

Configuration that benefits from version control

Agent-generated content

Anything that benefits from transparency

Large text content

Use database for...
•

•

•

•

•

High-volume structured data

Data that needs complex queries

Ephemeral state (sessions, caches)

Data with relationships

Data that needs indexing

https://every.to/guides/agent-native

13/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

The principle: Files for legibility, databases for structure. When in doubt, files—they're more

transparent and users can always inspect them.

The file-first approach works when:

• Scale is small (one user's library, not millions of records)

• Transparency is valued over query speed

• Cloud sync (iCloud, Dropbox) works well with files

Hybrid approach

Even if you need a database for performance, consider maintaining a file-based "source of truth" that the
agent works with, synced to the database for the UI.

Conflict model
If agents and users write to the same files, you need a conflict model.

Atomic writes (current reality)

// Swift - last-write-wins via atomic writes
try data.write(to: url, options: [.atomic])

Simple but can lose changes.

iCloud conflict monitoring

// Watch for sync conflicts
NotificationCenter.default.addObserver(
forName: .NSMetadataQueryDidUpdate,
...
)
// Creates: {filename} (conflict).md
https://every.to/guides/agent-native

14/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Monitor and resolve conflicts explicitly.

Last write wins

Check before writing

Simple, changes can be lost

Skip if modified since read

Separate spaces

Append-only logs

Agent

→ drafts/, user promotes

Additive, never overwrites

File locking

Prevent edits while open

Practical guidance: Logs and status files rarely conflict. For user-edited content, consider

explicit handling or keep agent output separate. iCloud adds complexity by creating conflict
copies.

Agent execution patterns
Completion signals
Agents need an explicit way to say "I'm done." Don't detect completion through heuristics.

struct ToolResult {
let success: Bool
let output: String
let shouldContinue: Bool
}
https://every.to/guides/agent-native

15/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

.success("Result")

// continue

.error("Message")

// continue (retry)

.complete("Done")

// stop loop

Completion is separate from success/failure: A tool can succeed and stop the loop, or fail
and signal continue for recovery.

What's not yet standard: Richer control flow signals like:

•

•

•

pause—agent needs user input before continuing

escalate—agent needs a human decision outside its scope

retry—transient failure, orchestrator should retry

Currently, if the agent needs input, it asks in its text response. There's no formal "blocked waiting for
input" state. This is an area still being figured out.

Model tier selection
Not all agent operations need the same intelligence level.

Task Type

Tier

Reasoning

Research agent

Balanced

Tool loops, good reasoning

Chat

Balanced

Fast enough for conversation

Complex synthesis

Powerful

Multi-source analysis

Quick classification

Fast

High volume, simple task

The discipline: When adding a new agent, explicitly choose its tier based on task

complexity. Don't always default to "most powerful."

Partial completion
https://every.to/guides/agent-native

16/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

struct AgentTask {
var status: TaskStatus

// pending, in_progress, completed,

failed, skipped
var notes: String?

// Why it failed, what was done

}
var isComplete: Bool {
tasks.allSatisfy { $0.status == .completed || $0.status ==
.skipped }
}

For multi-step tasks, track progress at the task level. What the UI shows:

Progress: 3/5 tasks complete (60%)

✓
✓
✓

[1] Find source materials

[2] Download full text

[3] Extract key passages

✗ [4] Generate summary - Error: context limit
○ [5] Create outline

Partial completion scenarios:

Agent hits max iterations

Some tasks completed, some pending. Checkpoint saved. Resume continues from where it
left off.

Agent fails on one task

Task marked failed with error in notes. Other tasks may continue (agent decides).

Network error mid-task

https://every.to/guides/agent-native

17/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Current iteration throws. Session marked failed. Checkpoint preserves messages up to that
point.

Context limits
Agent sessions can extend indefinitely, but context windows don't. Design for bounded

context:

Tools should support

Give agents a way to

Assume context will

iterative refinement

consolidate learnings

eventually fill up—

mid-session

design for it from the

full) rather than all-or-

("summarize what I've

start

nothing

learned and continue")

(summary

→ detail →

Implementation patterns
Shared workspace
Agents and users should work in the same data space, not separate sandboxes.

UserData/
├── notes/

← Both agent and user read/write here

├── projects/

← Agent can organize, user can override

└── preferences.md

← Agent reads, user can edit

Benefits:
https://every.to/guides/agent-native

18/36

2/19/26, 1:00 PM
•

•

•

•

Agent-native Architectures: How to Build Apps After Code Ends

Users can inspect and modify agent work

Agents can build on what users create

No synchronization layer needed

Complete transparency

This should be the default. Sandbox only when there's a specific need (security, preventing
corruption of critical data).

Context injection
The agent needs to know what it's working with. System prompts should include:

Available resources
## Available Data
- 12 notes in /notes
- Most recent: "Project kickoff"
- three projects in /projects
- Preferences at /preferences.md

Capabilities
## What You Can Do
- Create, edit, tag, delete notes
- Organize files into projects
- Search across all content
- Set reminders (write_file)

Recent activity
## Recent Context
- User created "Project kickoff"
note (two hours ago)

https://every.to/guides/agent-native

19/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

- User asked about Q3 deadlines
yesterday

For long sessions, provide a way to refresh context so the agent stays current.

Agent-to-UI communication
When agents act, the UI should reflect it immediately. Event types for chat integration:

enum AgentEvent {
case thinking(String)

// → Show as thinking indicator

case toolCall(String, String) // → Show tool being used
case toolResult(String)

// → Show result (optional)

case textResponse(String)

// → Stream to chat

case statusChange(Status)

// → Update status bar

}

The key: no silent actions. Agent changes should be visible immediately.

Real-time progress:
•

•

•

•

Show thinking progress (what the agent is considering)

Show current tool being executed

Stream text incrementally as it's generated

Update task list progress in real-time

Communication patterns:
•

•

•

Shared data store (recommended)

File system observation

Event system (more decoupled, more complexity)

Some tools are noisy; consider an

ephemeralToolCalls flag to hide internal checks while still

showing meaningful actions.

https://every.to/guides/agent-native

20/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Silent agents feel broken. Visible progress builds trust.

Product implications
Agent-native architecture has consequences for how products feel, not just how they're built.

Progressive disclosure

Latent demand discovery

Simple to start but endlessly powerful. Basic

Build a capable foundation. Observe what users

requests work immediately. Power users can

ask the agent to do. Formalize the patterns that

push in unexpected directions.

emerge. You're discovering, not guessing.

Excel is the canonical example: grocery list or

Traditional product development: Imagine

financial model, same tool. Claude Code has

what users want, build it, see if you're right.

this quality too. The interface stays simple;
capability scales with the ask.

•

Simple entry: basic requests work with no
learning curve

•

•

Agent-native product development: Build a
capable foundation, observe what users ask
the agent to do, formalize the patterns that
emerge.

Discoverable depth: users find new power

When users ask the agent for something and it

as they explore

succeeds, that's signal. When they ask and it

No ceiling: power users push beyond what
you anticipated

The agent meets users where they are.

fails, that's also signal—it reveals a gap in your
tools or parity.

Over time, you can:

•

Add domain tools for common patterns
(makes them faster and more reliable)

•

Create dedicated prompts for frequent
requests (makes them more discoverable)

https://every.to/guides/agent-native

21/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends
•

Remove tools that aren't being used
(simplifies the system)

The agent becomes a research instrument for
understanding what your users actually need.

Approval and user agency
Needs validation

This framework is a contribution from Claude that emerged from the process of building a few of the apps

at Every. But it hasn't been battle-tested and Dan is still forming his opinion here.

When agents take unsolicited actions—doing things on their own rather than responding to explicit
requests—you need to decide how much autonomy to grant. Consider stakes and reversibility:

Stakes

Reversibility

Pattern

Example

Low

Easy

Auto-apply

Organizing files

Low

Hard

Quick confirm

Publishing to feed

High

Easy

Suggest + apply

Code changes

High

Hard

Explicit approval

Sending emails

Note: This applies to unsolicited agent actions. If the user explicitly asks the agent to do
something ("send that email"), that's already approval—the agent just does it.

Self-modification should be legible

When agents can modify their own behavior—changing prompts, updating preferences, adjusting
workflows—the goals are:

• Visibility into what changed

• Understanding the effects

• Ability to roll back

https://every.to/guides/agent-native

22/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Approval flows are one way to achieve this. Audit logs with easy rollback could be another. The principle
is: Make it legible.

Mobile
Mobile is a first-class platform for agent-native apps. It has
unique constraints and opportunities.

A File System

Agents can work with files naturally, using the same primitives that work everywhere else.

Rich Context

A walled garden you get access to. Health data, location, photos, calendars—context that
doesn't exist on desktop or web.

Local Apps

Everyone has their own copy of the app. Apps that modify themselves, fork themselves,
evolve per-user.

App State Syncs

With iCloud, all devices share the same file system. Agent's work appears on all devices—
without a server.

The challenge
https://every.to/guides/agent-native

23/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Agents are long-running. Mobile apps are not.

An agent might need 30 seconds, five minutes, or an hour to complete a task. But iOS will
background your app after seconds of inactivity, and may kill it entirely to reclaim memory. The user

might switch apps, take a call, or lock their phone mid-task.

This means mobile agent apps need a well-thought-out approach to:

Checkpointing

Resuming

Saving state so work isn't lost

Picking up where you left off after interruption

Background execution

On-device vs. cloud

Using the limited time iOS gives you wisely

Deciding what runs locally vs. what needs a
server

iOS storage architecture
Needs validation

This is an approach we're playing with that we think is exciting, but it's one way to do it. Claude

built this; better solutions may exist.

What this gives you:

• Automatic sync across devices without building infrastructure

• Backup without user action

• Graceful degradation when iCloud is unavailable

• Users can access their data outside the app if needed

One approach—iCloud-first with local fallback:

1. iCloud Container (preferred)
iCloud.com.{bundleId}/Documents/
├── Library/
├── Research/books/
├── Chats/
└── Profile/
https://every.to/guides/agent-native

24/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

2. Local Documents (fallback)
~/Documents/
3. Migration layer
Auto-migrate local → iCloud

// iCloud-first with local fallback
if let url = fileManager
.url(forUbiquityContainerIdentifier: nil) {
return url.appendingPathComponent("Documents")
}
return fileManager.urls(
for: .documentDirectory,
in: .userDomainMask)[0]

Checkpoint and resume
Needs validation

Claude's contribution from building; Dan is still forming his opinion. This approach seems to work,

but better solutions may exist.

Mobile apps get interrupted. Agents need to survive this.

What to checkpoint:

Agent type, messages, iteration count, task list, custom state, timestamp

When to checkpoint:

On app backgrounding, after each tool result, periodically during long operations

Resume flow:

Load interrupted sessions

→ Filter by validity (one-hour default) → Show resume prompt → Restore

messages and continue

https://every.to/guides/agent-native

25/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Resume steps:

1. loadInterruptedSessions() scans checkpoint directory
2. filter by isValid(maxAge:)
3. show resume prompt
4. restore messages and continue agent loop
5. on dismiss, delete checkpoint

struct AgentCheckpoint: Codable {
let agentType: String
let messages: [[String: Any]]
let iterationCount: Int
let taskListJSON: String?
let customState: [String: String]
let timestamp: Date
}
func isValid(maxAge: TimeInterval = 3600)
-> Bool {
Date().timeIntervalSince(timestamp)
< maxAge
}

Architecture decision: Store full agent configuration, or store only

agentType and recreate from a

registry. The latter is simpler but means configs can break old checkpoints.

The gap: If the system kills the app, recovery depends on checkpoint frequency. Checkpoint after each
tool result for maximum robustness.

Cloud file states
Files may exist in iCloud but not be downloaded locally. Ensure availability before reading.

await StorageService.shared
.ensureDownloaded(folder: .research,
filename: "full_text.txt")

https://every.to/guides/agent-native

26/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Storage abstraction
Use a storage abstraction layer. Don't use raw FileManager. Abstract over iCloud vs. local
so the rest of your code doesn't care.

let url = StorageService.shared
.url(for: .researchBook(bookId: id))

Background execution
Needs validation

Claude's contribution from building; Dan is still forming his opinion.

iOS gives you limited background time:

func prepareForBackground() {
backgroundTaskId = UIApplication.shared
.beginBackgroundTask(withName: "AgentProcessing") {
handleBackgroundTimeExpired()
}
}
func handleBackgroundTimeExpired() {
for session in sessions where session.status == .running {
session.status = .backgrounded
Task { await saveSession(session) }
}
}
func handleForeground() {
for session in sessions where session.status == .backgrounded {
Task { await resumeSession(session) }
}
}
https://every.to/guides/agent-native

27/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

You get roughly 30 seconds. Use it to:

• Complete the current tool call if possible

• Checkpoint the session state

• Transition gracefully to backgrounded state

For truly long-running agents: Consider a server-side orchestrator that can run for hours,

with the mobile app as a viewer and input mechanism.

On-device vs. cloud
Component

Orchestration

Tool execution (files, photos, HealthKit)

On-device

✓
✓
✓

LLM calls

Checkpoints

Long-running agents

Cloud

✓

(local files)

Limited by iOS

(Anthropic API)

Optional via iCloud

Possible with server

The app needs network for reasoning but can access data offline. Design tools to degrade
gracefully when network is unavailable.

Advanced patterns

https://every.to/guides/agent-native

28/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Dynamic capability discovery
Needs validation

Claude's contribution from building; Dan is still forming his opinion. This is one approach we're

excited about, but others may be better depending on your use case.

One alternative to building a tool for each endpoint in an external API: Build tools that let the
agent discover what's available at runtime.

The problem with static mapping:

// You built 50 tools for 50 data types
read_steps()
read_heart_rate()
read_sleep()
// When a new metric is added... code change required
// Agent can only access what you anticipated

Dynamic capability discovery:

// Two tools handle everything
list_available_types() → returns ["steps", "heart_rate", "sleep", ...]
read_data(type) → reads any discovered type
// When a new metric is added... agent discovers it automatically
// Agent can access things you didn't anticipate

This is granularity taken to its logical conclusion. Your tools become so atomic that they
work with types you didn't know existed when you built them.

When to use this:
•

External APIs where you want the

When static mapping is fine:
•

agent to have full user-level access

limited scope

(HealthKit, HomeKit, GraphQL
•
endpoints)

https://every.to/guides/agent-native

Intentionally constrained agents with

When you need tight control over
exactly what the agent can access

29/36

2/19/26, 1:00 PM
•

Agent-native Architectures: How to Build Apps After Code Ends
Systems that add new capabilities
over time

•

•

Simple APIs with stable, well-known
endpoints

When you want the agent to be able
to do anything the API supports

The pattern: one tool to discover what's available, one tool to interact with any discovered
capability. Let the API validate inputs rather than duplicating validation in your enum
definitions.

CRUD completeness
For every entity in your system, verify the agent has full create, read, update, delete (CRUD)

capability:

Create

Read

Can the agent make new instances?

Can the agent see what exists?

Update

Delete

Can the agent modify instances?

Can the agent remove instances?

The audit: List every entity in your system and verify all four operations are available to the
agent.

Common failure: You build

create_note and read_notes but forget

update_note and delete_note. User asks the agent to "fix that typo in my meeting
notes" and the agent can't help.

Anti-patterns
https://every.to/guides/agent-native

30/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

Common approaches that aren't fully agent-native
These aren't necessarily wrong—they may be appropriate for your use case. But they're worth

recognizing as different from the architecture this document describes.

Agent as router

Build the app, then add agent

The agent figures out what the user

You build features the traditional way (as

wants, then calls the right function. The

code), then expose them to an agent. The

agent's intelligence is used to route, not

agent can only do what your features

to act. This can work, but you're using a

already do. You won't get emergent

fraction of what agents can do.

capability.

Request/response thinking

Defensive tool design

Agent gets input, does one thing, returns

You over-constrain tool inputs because

output. This misses the loop: Agent gets

you're used to defensive programming.

an outcome to achieve, operates until it's

Strict enums, validation at every layer.

done, handles unexpected situations

This is safe, but it prevents the agent from

along the way.

doing things you didn't anticipate.

Happy path in code, agent just executes
Traditional software handles edge cases
in code—you write the logic for what
happens when X goes wrong. Agentnative lets the agent handle edge cases
with judgment. If your code handles all
the edge cases, the agent is just a caller.

Specific anti-patterns
Agent executes your workflow instead of pursuing outcomes
You wrote the logic, agent just calls it. Decisions live in code, not agent judgment.

https://every.to/guides/agent-native

31/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

# Wrong - you wrote the workflow
def process_request(input):
category = categorize(input)

# your code decides

priority = score_priority(input)

# your code decides

store(input, category, priority)
if priority > 3: notify()

# your code decides

# Right - agent pursues outcome in a loop
tools: store_item, send_notification
prompt: "Evaluate urgency 1-5, store with your assessment,
notify if >= 4"

Workflow-shaped tools

Orphan UI actions

analyze_and_organize bundles

User can do something through the UI

judgment into the tool. Break it into

that the agent can't achieve. Fix: Maintain

primitives and let the agent compose

parity.

them.

Context starvation

Gates without reason

Agent doesn't know what exists. User

Domain tool is the only way to do

says "organize my notes" and agent

something, and you didn't intend to

doesn't know there are notes.

restrict access.

Fix: Inject available resources and capabilities

Fix: Default to open. Keep primitives available

into system prompt.

unless there's a specific reason to gate.

Artificial capability limits

Static mapping when dynamic would serve

Restricting what the agent can do out of

better

vague safety concerns rather than

Building 50 tools for 50 API endpoints

specific risks.

when a discover + access pattern would

The agent should generally be able to do what
users can do. Use approval flows for

https://every.to/guides/agent-native

give more flexibility and future-proof the
system.

32/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

destructive actions rather than removing
capabilities entirely.

Heuristic completion detection
Detecting agent completion through
heuristics (consecutive iterations without
tool calls, checking for expected output
files) is fragile.

Fix: Require agents to explicitly signal
completion through a completion tool.

Success criteria
Architecture
The agent can achieve anything users can achieve through the UI (parity)

Tools are atomic primitives; domain tools are shortcuts, not gates (granularity)

New features can be added by writing new prompts (composability)

The agent can accomplish tasks you didn't explicitly design for (emergent capability)

Changing behavior means editing prompts, not refactoring code

Implementation
System prompt includes available resources and capabilities

Agent and user work in the same data space

Agent actions reflect immediately in the UI

https://every.to/guides/agent-native

33/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends
Every entity has full CRUD capability

External APIs use dynamic capability discovery where appropriate

Agents explicitly signal completion (no heuristic detection)

Product
Simple requests work immediately with no learning curve

Power users can push the system in unexpected directions

You're learning what users want by observing what they ask the agent to do

Approval requirements match stakes and reversibility

Mobile
Checkpoint/resume handles app interruption

iCloud-first storage with local fallback

Background execution uses available time wisely

The ultimate test
Describe an outcome to the agent that's within your application's domain but

that you didn't build a specific feature for.

Can it figure out how to accomplish it, operating in a loop until it succeeds?

https://every.to/guides/agent-native

34/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends
If yes—you've built something

If no—your architecture is too

agent-native.

constrained.

What Comes Next
New ideas to help you build the future—in your inbox, every day.
This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.

About

X

Jobs

LinkedIn

Help center

YouTube

Privacy Preferences

Advertise with us

The team

FAQ

Terms

Site map

https://every.to/guides/agent-native

35/36

2/19/26, 1:00 PM

Agent-native Architectures: How to Build Apps After Code Ends

©2026 Every Media, Inc.

https://every.to/guides/agent-native

36/36

