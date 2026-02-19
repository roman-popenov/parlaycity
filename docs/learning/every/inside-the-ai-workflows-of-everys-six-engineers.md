2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Roman Popenov

Midjourney/Every illustration.
Source Code

Inside the AI Workflows of Every’s Six
Engineers
Each person on the team has tailored their stack to their individual
tastes
RHEA PUROHIT

October 27, 2025 · Updated February 3, 2026

Listen

131

Was this newsletter forwarded to you? Sign up to get it in your inbox.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

1/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Working alongside the engineers at Every, I sometimes wonder: What do they actually do
all day? Building software, just like writing, is a creative act, and by definition, that means
the process is messy. When I write, I go between Google Docs and whichever LLM I’m
leaning on at the moment (currently, GPT-5). But what does that look like for the people
building software?
Sure, I hear about the products they’re shipping in standup, and I get snippets of their
workflows when we run Vibe Checks. But those moments are always in isolation, scattered
whispers of a bigger conversation.
So I asked: What does the workflow of each of our engineers really look like? What stack
have they built that makes it possible for six people to run four AI products, a consulting
business, and a daily newsletter read by more than 100,000 people?

Experimenting at the edge: Yash Poojary, general
manager of Sparkle
Yash Poojary used to be the kind of developer who insisted on doing everything from one
lone laptop. A few weeks ago, he caved and added a Mac Studio—Apple’s highperformance desktop—to his setup. “I wanted to use my laptop for everything,” he
admits, “but I felt bottleneck[ed] for testing things faster.”
The upgrade has paid off. Now he runs Claude Code on one machine and Codex on the
other, feeding them the same prompt and codebase to see how they respond. He’s finding
that the two models have distinct personalities. Claude Code is the “friendly developer,”
great at breaking things down and explaining its reasoning, while Codex is the “technical
developer,” more literal, more precise, and often able to land the right solution on the first
try.
Yash also recently launched a new version of Sparkle, our AI file organizer, complete with
a redesigned interface that he worked on in Figma. Back in the dark ages (aka five months
ago), Yash would take screenshots of the design and paste them into Claude so it could
write the code. Now, with a Figma MCP integration, Claude can plug directly into the
Figma file so it can read the design system itself—the colors, spacing, components—and

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

2/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

translate that into working code. It saves steps and keeps Claude working from the real
source of truth.
Outside of agents, Yash leans on Warp—a modern version of the developer’s command
line, the text-based interface developers use to control their computers. Every time he
pushes code, he jots down two lines about what he learned in a “learnings doc” and stores
them in the cloud. After a few days, he has a rolling memory of recent context to feed back
into his AI tools.
Even with all this experimentation, Yash emphasizes the importance of guardrails. He
structures his day around one big task and a handful of smaller background ones, and he’s
careful not to let AI-generated suggestions derail him. As he puts it: “The problem with
CLIs [command line interfaces] is it’s easy to get derailed and lose focus on what you’re
actually trying to build… so building guardrails into the system is essential.”
One way he’s doing that is with AgentWatch, an app he built that pings him when a Claude
Code session finishes, letting him run multiple sessions simultaneously without losing
track of them. Yash—and a smattering of others—have been using it of late; if you give it a
try, DM him.
He’s also split his day into two modes: Mornings are for focused execution—just Codex
and Claude Code, no new tools allowed—so shipping doesn’t stall. Afternoons are for
exploration, when he experiments with new agents, apps, and features. That separation
between “build” and “discover” has removed the productivity drag he used to feel when
testing new tools.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

3/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Every illustrations.

Orchestrating the loop: Kieran Klaassen, general
manager of Cora
For Kieran, everything with Cora starts with a plan generated in Claude Code with a set of
custom agents and workflows. He scopes programming plans at three levels, depending on
the feature:
Small features: simple enough to one-shot
Medium features: span a few files and go through a review step (usually by Kieran)
Large features: complex builds that require manual typing, deeper research, and
lots of back-and-forth
https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

4/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

The point of planning, he says, is to ground the work in truth—best practices, known
solutions online, and reliable context pulled in through Context 7 MCP, a tool that pulls
up-to-date, version-specific documentation and code examples straight from the official
source and places them directly into your prompt.
Once the plan is set, it gets sent to GitHub. From there, he uses a work command—a
prompt that takes the plan and turns it into coding tasks for the AI agent. For most
projects, Claude Code is his go-to, because it gives him more control and autonomy. But
he’ll sometimes turn to Codex or the agentic coding tool Amp for more traditional or
“nerdier” features.
After the work is done, he has a command that reviews the code. Here, too, Claude often
leads, though he also uses a mix of other AI tools, including Cursor and Charlie. The
process loops until Kieran decides that the feature is ready to ship.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

5/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Turning complexity into milestones: Danny Aziz,
general manager of Spiral
Danny Aziz’s current workflow runs almost entirely inside Droid—the command line
interface owned by Factory, a startup building coding agents, that lets him use Anthropic
and OpenAI models side by side. About 70 percent of his work happens here, relying on
GPT-5 Codex for the big feature builds, and then switches to Anthropic models to refine
and nail down the details.
During his planning phase, Danny spends time talking with GPT-5 Codex to make
implementation plans concrete and specific—asking it about second- and third-order
consequences of his choices, and having it turn those insights into milestones for the
project. For example, if the agent implements a feature, but in a way that slows the app
down because of how it pulls data from the database, Danny wants to catch that in
advance.
Droid was instrumental in helping Danny build the brand-new version of Spiral. Other
tools have largely fallen away. “I don’t use Cursor anymore,” he says. “I haven’t opened it in
months.” Instead, his main interface is Warp, where he can split the screen into different
views and switch quickly between tasks. Behind it, he uses Zed—a fast, lightweight code
editor—for reviewing plan files and specific bits of code.
As for his physical work setup, Danny keeps it simple: A majority of the time he’s on a
single monitor or just his laptop. The only time he adds a second desktop is when he’s deep
in the throes of implementing a design, and having the Figma file side-by-side with the
build makes it easier to lock the visuals in.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

6/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Making process the source of truth: Naveen Naidu,
general manager of Monologue
For Naveen, everything begins with the project management tool Linear. Feature requests
come in from everywhere—Discord, email, Featurebase, live user calls—but they all end
up in the same place. “If it’s not in Linear, it doesn’t exist,” he says. Every ticket carries
links back to the original source, so he can always trace who asked and why.
Over the past few weeks, Naveen has migrated from Claude Code to Codex for his day-today work.
From there, Naveen shifts into planning mode, which he runs in two different ways. For
small bugs or quick improvements, he adds context directly to the Linear ticket and then
https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

7/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

copies it into Codex Cloud to kick off an agent task—no fancy MCP integration, just
manual copy-paste. For bigger features, though, he steps outside Linear and into Codex
CLI, where he writes a local plan.md—a simple text file that serves as the blueprint for the
project. It lays out the steps, scope, and decisions, and becomes the authoritative spec he
iterates on with agents as the work unfolds.
Execution also happens on two tracks. In Codex cloud, he brainstorms approaches and
generates draft pull requests, usually not to merge, but to explore ideas, surface edge cases,
and get potential fixes in parallel. He prefers the cloud because it lets him kick off
background tasks asynchronously, whether from the iOS ChatGPT app or on the web.
Once he’s confident in a direction, he moves to Codex CLI for the real build, refining
plan.md and letting the agent drive file edits step by step in Ghostty, his terminal of
choice, all the while keeping a close eye on the agent’s work. Along the way, he uses Xcode
for native macOS development and Cursor for backend work. MCP integrations with
Linear, Figma, and Sentry keep issues, designs, and error tracking wired into the loop.
Review is its own discipline for Naveen. First, he runs Codex’s built-in /review command,
which gives him an automated scan for obvious bugs or issues. Then he double-checks the
changes himself by comparing the “before” and “after” versions of the code side by side.
And when it’s a bug fix, he goes one step further: looking at the error logs in Sentry both
before and after the change, to make sure the problem is happening less often.
One tool woven through Naveen’s stack is Monologue, a speech-to-text app he built
himself, incubated at Every, and launched just last month. He uses it to dictate prompts,
write ticket descriptions, and update his plans—turning his thoughts into context for his
agents. You can give it a try.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

8/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Perfecting what works: Andrey Galko, engineering lead
Andrey Galko keeps his workflow simple. He’s not the kind of developer who chases every
shiny new tool—and in AI, there are a lot. If something works, he sticks with it. For a long
time, that meant using Cursor, which he still calls the best user experience out there. But
when the company changed its pricing, he started hitting the monthly usage limit in just a
week, and was forced to look elsewhere.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

9/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

He found his answer in Codex (and would’ve probably kept paying for Cursor if the former
hadn’t been released). For quite some time, Andrey says, OpenAI’s models generated
suboptimal code. They’d produce snippets that technically worked but weren’t consistent
with the existing codebase, skipped steps, and felt “lazy.” Then came GPT-4.5 and GPT-5,
and things changed: The models started to read code and could complete tasks all the way
to a functional MVP.
Codex was always good at non-visual logic—the behind-the-scenes rules and processes
that make software run, as opposed to the user interface you click on—and when GPT-5Codex arrived, it finally got good at the user interface, too. Claude might still produce
more creative (and sometimes too creative) UIs, but Andrey finds little need to switch
between the two anymore. “I applaud the people at OpenAI for becoming a real menace to
Anthropic’s code generation reign,” he says.

Focusing on one thing: Nityesh Agarwal, engineer at
Cora
https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

10/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Nityesh Agarwal likes to keep things tight, focused, and clean. His entire agentic stack
runs on a MacBook Air M1—no big monitors necessary. “I’m the kind of developer who
doesn’t like changing my tools often,” he says. “I like to focus on one thing at a time.”
That one thing is Claude Code. He runs it on the Max plan and uses it for all of his AIassisted coding. Before he writes a single line, he spends hours researching the codebase
and sketching out a detailed plan for how everything should work—with Claude’s help.
Once he starts coding he stays in a single terminal, laser-focused on the task at hand. “I’ve
realized that what works best for me is to give 100 percent attention to the one thing that
Claude is working on,” he says. If a research question pops up, he might spin up a quick
session in a separate tab, but as a rule, he avoids juggling multiple agents. He prefers to
watch Claude’s work “like a hawk,” finger on the Escape key, ready to step in the moment
something looks off.
Lately, he’s actually shortened Claude’s leash, often interrupting it mid-process to ask for
explanations. It slows things down, but it pays off in two ways: Claude hallucinates less,
and Nityesh feels like he’s sharpening his own developer skills. “I realize that I’ve placed
too much of my trust in Anthropic, which leaves me vulnerable,” he admits. When Claude
glitched for two days, he tried other tools, but none of them matched what he was used to.
“Claude Code has spoiled me,” he says. “So now I just pray it never goes rogue again.”
Another key part of Nityesh’s workflow is GitHub, which has become an interface for how
he works with Claude Code. For Cora, the AI email assistant that Nityesh works on, the
engineering team reviews pull requests that Claude Code creates. They leave line-by-line
comments in GitHub, then have Claude Code fetch and read those comments into the
terminal so the team (which includes both the human engineers and Claude Code) can
make the required fixes together.
In terms of other tools, Nityesh calls Cursor and Warp “solid nice-to-haves,” though he
wouldn’t mind if he couldn’t access them anymore tomorrow.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

11/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Rhea Purohit is a contributing writer for Every focused on research-driven storytelling in tech. You
can follow her on X at @RheaPurohit1 and on LinkedIn, and Every on X at @every and on
LinkedIn.
We build AI tools for readers like you. Write brilliantly with Spiral. Organize files automatically
with Sparkle. Deliver yourself from email with Cora. Dictate effortlessly with Monologue.
We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
Get paid for sharing Every with your friends. Join our referral program.
For sponsorship opportunities, reach out to sponsorships@every.to.

Subscribe
https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

12/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

If you are eligible for the overall boosted rate of 4.40% offered in connection with this
promo, your boosted rate is also subject to change if the base rate decreases during the
three-month promotional period.
The Cash Account, which is not a deposit account, is offered by Wealthfront Brokerage LLC
("Wealthfront Brokerage"), Member FINRA/SIPC. Wealthfront Brokerage is not a bank. The
Annual Percentage Yield ("APY") on cash deposits as of September 26, 2025, is representative,
requires no minimum, and may change at any time. The APY reflects the weighted average of
deposit balances at participating Program Banks, which are not allocated equally. Funds in the Cash
Account are swept to Program Banks where they earn a variable APY and are eligible for FDIC
insurance. Conditions apply. For a list of Program Banks, see: www.wealthfront.com/programbanks.
FDIC pass-through insurance, which protects against the failure of Program Banks, not Wealthfront,
is not provided until the funds arrive at the Program Banks. While funds are at Wealthfront
Brokerage, and while they are transitioning to and/or from Wealthfront Brokerage to the Program
Banks, the funds are eligible for SIPC protection up to the $250,000 limit for cash. FDIC insurance is
limited to $250,000 per customer, per bank, regardless of whether those deposits are placed through
Wealthfront Brokerage. You are responsible for monitoring your total deposits at each Program Bank
to stay within FDIC limits. Wealthfront works with multiple Program Banks to make available up to
$8 million ($16 million for joint accounts) of pass-through FDIC coverage for your cash deposits. For
more info on FDIC insurance coverage, visit www.FDIC.gov.
Instant and same-day withdrawals use the Real-Time Payments (RTP) network or
FedNow service. Transfers may be limited by your receiving institution, daily caps, or
participating entities. New Cash Account deposits have a 2–4 day hold before transfer.
Wealthfront does not charge fees for these services, but receiving institutions may impose
an RTP or FedNow Fee. Processing times may vary.

What did you think of this post?

Amazing

Good

Meh

Bad

Get More Out Of Your Subscription
Try our AI tools for ultimate productivity

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

13/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

Front-row access to the future of AI

In-depth reviews of new models on

Bundle of AI software

Sparkle: Organize your Mac with AI

release day

Playbooks and guides for putting AI to

Cora: The most human way to do email

work

Prompts and use cases for builders

Spiral: Repurpose your content endlessly

Monologue: Effortless voice dictation for your Mac

RELATED ESSAYS

A Dynamic Framework for
Making Product Decisions
Frustrated with product frameworks that
feel static and forced, I built one that can
evolve along with my thought process

58 6 Mar 4, 2025
EDMAR FERREIRA

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

14/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

My AI Had Already Fixed
the Code Before I Saw It
Compounding engineering turns every pull request,
bug fix, and code review into permanent lessons
your development tools apply automatically

73 10 Aug 18, 2025
KIERAN KLAASSEN

I Rebuilt an App Thousands of
People Use in 14 Days With AI
Where I went wrong, and then right, with
vibe coding our file organizer Sparkle

31 6 Apr 24, 2025
YASH POOJARY

Comments

Write a comment
Post
Write a comment
Post

You need to login before you can comment.
Don't have an account? Sign up!

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

15/16

2/19/26, 1:00 PM

Inside the AI Workflows of Every’s Six Engineers

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

©2026 Every Media, Inc.

https://every.to/source-code/inside-the-ai-workflows-of-every-s-six-engineers

16/16

