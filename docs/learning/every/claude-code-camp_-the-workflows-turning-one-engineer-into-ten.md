2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Roman Popenov

Midjourney/Every illustration.
Source Code

Claude Code Camp: The Workflows Turning
One Engineer Into Ten
Demos and tips from our second expert workshop, on subagents
KATIE PARROTT

August 28, 2025 · Updated January 4, 2026

Listen

34

Was this newsletter forwarded to you? Sign up to get it in your inbox.

https://every.to/source-code/claude-code-camp

1/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

“What do a jet ski and Claude Code have in common?”
That’s how Sparkle general manager Yash Poojary opened his presentation at the latest
Claude Code Camp, our live event series where Every’s engineers share how they use
Claude Code in production and answer subscriber questions.
The chat filled with answers: They’re both fast, extra fun with friends, and reckless if you
don’t know what you’re doing. It was a joke—but also a sharp metaphor for Claude’s new
subagents.
Anthropic only released subagents a month ago, but Every’s engineers are already weaving
them into their daily workflows for Spiral, Cora, and Sparkle. (The latter is launching a
new feature tomorrow built with techniques we discuss here.)
The lessons are adding up quickly, and not only for the humans. When you’re following
the principles of compounding engineering—building development systems that learn
from your feedback—every workflow improvement makes the next one easier. Subagents
fit perfectly into this philosophy, because each one can learn to apply your standards
consistently and get better with every task.
Here are the biggest takeaways from this session of Claude Code Camp, plus demos from
our engineers and highlights from the live Q&A.

Key takeaways
Create subagents (more about them below) when the work repeats. They shine
once you spot a task you don’t want to do again.
Work in parallel, not sequence. Running up to 10 agents at once turns long, linear
work into something more like a team tackling tasks in unison.
Each subagent keeps its own notes. Subagents hold their own memory, so they can
carry logs, specs, or architecture notes without cluttering your main session.
Treat them like teammates. Codify your standards once and the subagents will
apply them every time, like a junior engineer who’s already onboarded.

What are subagents, and what are they for?
https://every.to/source-code/claude-code-camp

2/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

A subagent is a lightweight AI program you can spin up for a specific role. Think of them
as separate conversation windows with specialized instructions. Each one has its own
system prompt, its own memory, and access to the same tools as Claude Code in general.
They can run in sequence or in parallel—up to 10 at once. “Claude started as an individual
contributor for you,” explained Dan Shipper, CEO of Every. “With subagents, it’s
becoming a team lead. It can now manage a team of its own agents to get work done.”

When to create a subagent
The temptation when you first learn about subagents is to build out a library of 20 or 30 all
at once. Dan cautioned against it: “If you do that, you just won’t use them. A better
approach is to notice when you’re repeating a task, and create an agent in that moment.”
Kieran Klaassen, general manager of our AI email management tool Cora, shared an
example. He needed to add metricsI tracking with Ahoy, something he’d set up before and
knew he’d need again. “Normally I’d have to refresh myself on how I did it last time.
Instead, I created an Ahoy tracking expert agent. Now Claude knows how to do it every
time.” For Kieran, the key is to think of subagents the way a tech lead would think about
onboarding: Codify the steps once, so you don’t have to repeat yourself later.

Why subagents are powerful
The strength of subagents is structure. They break work into roles, encode judgment into
loops, and carry context forward in ways a single coding session cannot.
They compound learning. A subagent set up with your standards will improve with
each run, like a junior teammate who learns quickly.
They create feedback loops. An executor subagent writes code; an evaluator
subagent reviews it. An argument between two agents surfaces better answers.
They unlock context. Each subagent holds its own memory, so your main thread
stays clear.
They enforce taste. By applying feedback to future cases, , subagents maintain
consistency across projects and reflect your preferences over time.

Patterns emerging in real workflows
https://every.to/source-code/claude-code-camp

3/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Once subagents move from idea to daily use, certain patterns show up again and again.
These are the practical shortcuts our engineers have discovered. Each one shows a
different way to turn lightweight agents into reliable teammates.

Executor/evaluator loop: ​One subagent does the work,
another reviews it
When you generate code or text with an AI, it tends to be overconfident about its own
output. A good trick is to split the workflow into two roles: one “executor” that does the
work, and one “evaluator” that reviews it. This creates a natural feedback loop that
improves quality.
Danny Aziz, general manager of our writing tool Spiral, showed how he uses this pattern
for Spiral’s onboarding screens. His UI engineer subagent takes mockups from Figma and
translates them into working React components (a programming framework for building
web apps). A second subagent, the implementation reviewer, compares the code against
the design and requests revisions. Because each has its own context window, the reviewer
isn’t biased by the executor’s memory, and they iterate back and forth until the
implementation matches the design.

Opponent processors: Two subagents argue to reach
better decisions
Sometimes the best way to reach a good decision is to generate two opposing perspectives
and let them argue it out. Subagents are perfect for this because they can each hold a
different role or agenda.
Dan showed how he used two subagents to audit his expenses. One agent played “Dan,”
trying to justify as many expenses as possible. The other played “the company,” pushing to
minimize costs. Claude mediated between them and delivered a balanced report.

Feedback codifier: Learns from your code review
comments
AI agents work best when they have access to your past decisions and preferences. By
codifying your feedback into a reusable format, you ensure future agents don’t repeat the
https://every.to/source-code/claude-code-camp

4/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

same mistakes.
Danny demonstrated his feedback codifier agent. After leaving comments on a pull
request (a draft of code changes submitted for review), he ran the codifier. It extracted the
lessons and stored them in his Claude.md file—a project-specific document that functions
like an instruction manual. The next time Claude reviews code, it already knows Danny’s
standards.

Research agent: Finds solutions and tradeoffs from
similar projects
Before building a new feature, developers often scan open-source projects to see how
others solved similar problems. This saves time and avoids pitfalls, but it can be tedious. A
research subagent can automate the search and summarize what matters.
That’s how Yash built the new search feature for Sparkle, the AI-powered file organizer for
Mac. Sparkle users kept asking, “How do I find my files once they’re organized?” The
research agent produced a report that mapped how other apps approached indexing and
performance indicators like search speed, flagged trade-offs, and highlighted best
practices. Work that would have taken Yash days of exploration took hours instead.
The result is Sparkle Search: a faster, more reliable way to find files in Sparkle, born from
the same workflow we use to ship code every day. Try it out and update Sparkle to 1.5.7
when it launches tomorrow. We're using this ourselves daily and would love feedback on
what works (or doesn't) for your workflow.

https://every.to/source-code/claude-code-camp

5/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Left: Spotlight shows irrelevant results if the keyword isn’t in the filename. Right: Sparkle
Search finds the document instantly by searching inside file contents. (Source:
Spotlight/Sparkle.)

Log investigator: Digs through error logs and returns
only what matters
Error logs can be long and messy, but they usually contain the key to solving a bug.
Subagents can analyze the full log in their own memory (as opposed to a shared memory)
and return only the relevant details.
Kieran showed his log investigator agent. When something breaks, he asks the agent to
parse the logs, identify what’s going wrong, and report back with the key details.
“Sometimes you just want a clean slate in your terminal,” he said. “The log investigator can
do the digging and bring back what matters.”

The Q&A
We wrapped the session with a live Q&A. Here’s a selection of the most useful ones,
including a few we didn’t have time for during the event.
https://every.to/source-code/claude-code-camp

6/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Slash commands versus subagents
In Claude Code, a slash command is like a shortcut prompt—you trigger a pre-defined
instruction with /plan or /review. A subagent is a more dedicated teammate. Commands
kick off a workflow; subagents carry their own memory and can be reused across sessions.

Q: When should I use a slash command and when should I make a subagent?
“They are similar, but should be used together. Slash commands are really good for
starting work—things like planning a big feature or doing a first pass review. Subagents
are more like colleagues you call in mid-stream. If you’re halfway through a build and need
a second opinion, or you want someone to go pull logs without messing up your main
context, that’s a good time for a subagent.”—Kieran

Workflows versus subagents
Q: How do workflows compare to subagents?
“Workflows are broader sequences of steps that might involve multiple tools and agents,
while subagents are specialized AI workers with their own context windows. Think of
workflows as the recipe and subagents as the specialized chefs—you might have a workflow
for ‘ship a feature’ that calls different subagents for research, implementation, and
review.”—Yash
“Workflows are more structured, like [the workflow automation platform] Zapier. Agents
are more fluid, because they can decide for themselves how to work without a structure
around them.”—Kieran

Project agents versus personal agents
Some agents are written to live inside a single project, while others follow an engineer
across everything they do.

Q: Do you create agents as project agents or personal agents?
“I use project agents 90 percent of the time because I like to write them in ways that are
specific to the project—what’s our [tech] stack, [or] some weird hacks we have in the
codebase the agent should know.”—Danny

https://every.to/source-code/claude-code-camp

7/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Parallel execution
Q: Can Claude run the same agent multiple times in parallel?
“Yes, Claude can run multiple instances of the same agent in parallel. Just tell Claude
explicitly. ‘Run 10 parallel research agents on these different topics.’ Each gets its own
context window, so they won’t step on each other. Super useful for analyzing large
codebases or documents.”—Yash

Token usage and cost
Multi-agent setups can look expensive on paper, but most developers don’t think in terms
of token math.

Q: What token usage do you see in multi-agent tasks?
“I literally never look at this.”—Danny
“Same. I don't think this is a problem in coding. $200 per month gives me enough all the
time.”—Kieran

Feedback and code reviews
Even with subagents, there are moments when the fastest move is still writing the code
yourself.

Q: Do you still have to write code manually? How do agents learn from PR
reviews?
“Yes, but only for the 5 percent of things that are either a little too complicated for me to
accurately prompt for or the things that are just quicker for me to do (copy-paste, massedit jobs).”—Danny

When to call agents
Claude can be told when to invoke subagents automatically, or you can call them in
manually.

Q: Can you tell Claude when to invoke agents—for example, via Claude.md?
"I actually prefer calling the agents myself via the @ syntax.”—Danny
https://every.to/source-code/claude-code-camp

8/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

“I’m with Danny—I prefer explicit @ mentions about 80 percent of the time. I do put
hints in Claude.md for when agents might be useful, but I rarely rely on automatic
invocation.”—Yash

Safety and guardrails
Q: Do subagents respect the same safety hooks for sensitive files and tool use?
“Subagents inherit the same safety restrictions as the main Claude instance. They can’t
access files you’ve marked as sensitive and respect the same tool permissions. Think of
them as having the same security clearance as their parent.”—Yash

Observability
“Observability” refers to being able to see what your system is doing through logs and
metrics. For subagents, there aren’t polished dashboards yet. Our team pieces together
what they need.

Q: Are you using any observability tools with Claude Code?
“Not using any formal observability tools—just git history and Claude’s conversation
logs.”—Yash

Katie Parrott is a staff writer and AI editorial lead at Every. You can read more of her work in her
newsletter.
To read more essays like this, subscribe to Every, and follow us on X at @every and on LinkedIn.
We build AI tools for readers like you. Write brilliantly with Spiral. Organize files automatically
with Sparkle. Deliver yourself from email with Cora.
We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
Get paid for sharing Every with your friends. Join our referral program.

https://every.to/source-code/claude-code-camp

9/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Subscribe
What did you think of this post?

Amazing

Good

Meh

Bad

Get More Out Of Your Subscription
Try our AI tools for ultimate productivity

https://every.to/source-code/claude-code-camp

10/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Front-row access to the future of AI

Bundle of AI software

In-depth reviews of new models on

Sparkle: Organize your Mac with AI

release day

Playbooks and guides for putting AI to

Cora: The most human way to do email

work

Prompts and use cases for builders

Spiral: Repurpose your content endlessly

Monologue: Effortless voice dictation for your Mac

RELATED ESSAYS

How I Use Claude Code to
Ship Like a Team of Five
It's the first AI tool that feels like delegating
to a colleague, not prompting a chatbot

44 7 Jul 16, 2025
KIERAN KLAASSEN

Stop Coding and Start Planning
Spend an hour teaching AI how you think, and
it gets smarter with every feature you build

57 4 Nov 6, 2025
KIERAN KLAASSEN

Inside the AI Workflows of Every’s Six Engineers
Each person on the team has tailored
their stack to their individual tastes

131 Oct 27, 2025
RHEA PUROHIT

https://every.to/source-code/claude-code-camp

11/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Comments

Write a comment
Post

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

https://every.to/source-code/claude-code-camp

12/13

2/19/26, 12:59 PM

Claude Code Camp: The Workflows Turning One Engineer Into Ten

Site map

©2026 Every Media, Inc.

https://every.to/source-code/claude-code-camp

13/13

