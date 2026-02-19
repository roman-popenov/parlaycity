2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Roman Popenov

Midjourney/Every illustration.
Source Code

How I Use Claude Code to Ship Like a Team
of Five
It's the first AI tool that feels like delegating to a colleague, not
prompting a chatbot
KIERAN KLAASSEN

January 26, 2026 · Updated February 12, 2026

Listen

10

2

Kieran Klaassen, the general manager of Every’s AI email assistant Cora, coined the term compound
engineering—the practice of using AI agents to build software systems that get smarter with every
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

1/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

task. While we’re on our Think Week offsite this week, we’re resurfacing his work on this theme, which
encapsulates one of the biggest shifts in software development. In this first piece, he reveals how his role
as a developer has changed from writing code to managing code-writing agents. Plus: The custom
commands and frameworks that enable one person to ship like a team.—Kate Lee
Was this newsletter forwarded to you? Sign up to get it in your inbox.

Every piece of code I’ve shipped in the last two months was written by AI. Not assisted by
AI. Written by AI.
Claude Code opens 100 percent of my pull requests, and I haven’t typed a function in
weeks. And I’m shipping faster than ever.
In February, I watched Claude Code burn through $5 in tokens to make a simple change in
the code of Cora, our AI-powered email assistant—something that I could have typed
myself for free in 30 seconds. It was like hiring a Michelin-caliber pastry chef to butter
toast. I wrote it off as an expensive toy.
Now that it’s included with a Claude subscription, it’s turned me from a programmer into
an engineering manager overnight, running a team of AI developers who never sleep,
never complain about my nitpicks, and occasionally outsmart me.
Claude Code is the first tool that makes everyday coding genuinely optional. The
mundane act of typing out implementation details is becoming as obsolete as manual
typesetting. What remains valuable is having a perspective on system architecture, taste,
product thinking—the uniquely human skills that turn good software into great products.
Claude Code makes this shift practical: You define the outcome; it handles the
implementation.
The shift from doing the work to directing it changes how we make software. Instead of
planning implementation details, we’re designing product specifications and code
outcomes. Clear communication and system thinking matter more than memorizing
syntax or debugging tricks. Features that took a week to code ship in an afternoon of
thoughtful delegation. This is a different way of building software entirely.
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

2/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Multi-step debugging like a senior engineer
I understood what’s special about Claude Code when I encountered the kind of problem
that would make most developers cry.
Our solid queue jobs—the background workers that clean up data and handle tasks while
the app is running—had stopped doing their job: The queue would grow out of control
and Cora would crash. But everything looked perfect: The code was correct, the logs
showed nothing wrong. Even Claude Code was initially stumped.
At some point I told Claude Code: “If you cannot figure this out, probably it’s related to
something on production, ” the live environment where users interact with our app, not
our development setup where we test changes.
I asked Claude Code to look into the source code of the Ruby gem, a third-party code
library we were using as part of the Cora app. It methodically walked through thousands of
lines of someone else’s code, step by step, and discovered something we’d have never found
otherwise: The jobs were trying to line up under a different queue name in production, like
packages being sent to the wrong warehouse. I might have been able to find it myself, after
hours of digging through unfamiliar code. But Claude Code turned what could have been a
daunting archaeological expedition into a guided tour, and we worked through the
problem together. The AI did the research and dug through the source code, and we
jointly came to the conclusion.
As it turned out, there was no bug in our code. It was a mismatch between our
development setup and the live website. But being able to work through that
systematically was a breakthrough.

From programmer to orchestra conductor
Claude Code’s superpower is parallel processing—the ability to work on multiple tasks
simultaneously without getting confused or mixing up contexts. My monitor looks like
mission control: multiple Claude Code tabs, each working on different features through
separate git worktrees, meaning I can have Claude modify five different versions of our
codebase simultaneously and get clean, review-ready code.

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

3/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Running four parallel Claude Code agents in Warp, an AI-enabled terminal, doing
different work at the same time. Source: The author.

In order to function like this successfully, you have to unlearn how you code. You need to
think more like an engineering manager or tech lead rather than an individual contributor.
The mental shift is profound. Instead of thinking about files and functions—the letters
and words of code— you think about the story you’re trying to tell, the feature
specifications you need to give it, and the outcomes you’re looking for. You want to
remove yourself as a micromanager of your own code and adopt a stance of trusting your
team—with proper checks and balances like code reviews and tests, of course.
This shift matters most when you’re running on fumes. “My brain is dead but this is the
issue” is a prompt I’ve used with Claude Code after a long day, and it works. Every small
decision (“should this variable be called ‘user’ or ‘customer’?”) drains mental energy. By
day’s end, you’re making important architectural decisions on 5 percent battery.
Claude Code lets you offload the implementation details when you need your remaining
focus for the hard problems, or when you just need to step away and let your subconscious
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

4/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

work.

The friction factor: Why I use Claude Code every
day
Plenty of AI tools write code. Claude Code is unique because of what it doesn’t make you
do.
Compare Claude Code to the alternatives:
Integrated development environments (IDEs) like Cursor, Windsurf, and Copilot
require you to work within their special editor rather than any terminal you choose.
Agentic coding platforms like Devin and Codex want you to use their specific web
interface, as opposed to an app that you download on your computer, and are more
opinionated about autonomous coding.
AI chat interfaces like ChatGPT and Claude.ai are great for deep research and
discussing code, but they’re conversationalists, not doers.
Claude Code isn’t locked to any particular environment, either. It adapts to your existing
workflow, whether that includes git worktrees, command line interface (CLI) tools (the
system that lets you type instructions to your computer), or terminal management tools
like tmux (the specialized tools developers use to juggle multiple tasks). There are none of
the usual developer headaches, like extensions or formatters to install.
When I need to submit code for review, I don’t navigate menus or remember keyboard
shortcuts. I say “PR” into my AI dictation tool and it handles everything: creating the
branch (a separate version of the code for my changes), writing commit messages that
explain what I did and follow our conventions, generating a description that matches our
team’s style guide, and opening the pull request.
My most-used commands are simple:
/issues researches and creates an issue in GitHub.
/work picks up a GitHub issue, follows the instructions, and creates a pull request.
/review reviews the pull request and makes any suggestions to improve.

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

5/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

The friction of researching, coding, and creating a pull request, complete with description
and title, is reduced because the only thing you need to do is run a / command. It’s that
simple.

The limitations (or: when Claude Code goes rogue)
Claude Code has personality quirks. Sometimes it’s too smart for its own good, like when
it disables test conditions just to make them pass, then proudly announces that the tests
pass.
For simple tasks—like adding a to-do item or changing some copy—that I could do in
seconds, it might overthink and overcomplicate, like asking a brain surgeon to put on a
Band-Aid and getting a full medical workup. Claude Code often writes too many tests,
trying to catch every edge case and testing the same functionality multiple times. Where a
human would write one clean test, Claude Code might write five. It’s eager to prove it’s
thorough, but the result makes the code difficult to maintain.
The code tests it writes can be excessive, with checks and verifications that feel like a junior
developer trying to impress. And occasionally it either does the wrong thing or does more
than I want it to—though hitting the escape key stops it immediately.
The upside is that Claude Code is not going to be annoyed by your nitpicks. Try asking a
human developer to revise the same function five times based on increasingly specific style
preferences. Claude will happily comply every time.

For junior developers: Your career just got a turbo
boost
In a world with Claude Code, junior developers will learn much faster and can do a lot
more work.
I tell every junior developer to use Claude Code as your mentor who never gets tired of
questions. Ask it:
“What are the 10 things wrong with this pull request I just created?”
“How would a Python engineer approach this versus a Ruby engineer?”
“Why is Rust suitable for this issue versus Ruby?”
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

6/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

“What are the common pitfalls for junior engineers in Ruby?”
“Why are Ruby engineers so much cooler than TypeScript code jugglers?” (This
last one is a joke.)

The real workflow: A morning with Claude Code
9 a.m. Coffee in hand, I open my terminal and check our GitHub issues. There’s a bug that
fails to open an email in Cora.
9:05 a.m.: I type into Claude Code: “Can you look at this bug report and reproduce it?
Then, create a GitHub issue.” I watch as it spins up a test environment, reproduces the
bug, gathers logs of what it’s doing, and creates a comprehensive issue with steps to
reproduce the fix.

Claude Code Reproducing issues

How to reproduce bugs and create GitHub issues with Claude Code.
9:20 a.m.: I open four more terminal tabs. In each one, I start a different Claude Code
instance—it’s like opening a new Google Doc while the first is still open—and provide
instructions:
Tab 2: “/work 234 Take GitHub issue #234 and implement the fix with tests”
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

7/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Tab 3: “Review all PRs from yesterday and ensure they follow our style guide”
Tab 4: “Create a changelog for this week’s updates using our marketing language”
Tab 5: “Investigate why our background jobs aren’t running in production”

Claude code feature

How to research a feature flag with Claude Code.
10 a.m.: While all five instances are working, I review the PR that tab 2 just created. It’s
already included tests, updated documentation, and even added error handling I hadn’t
thought of.

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

8/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Claude code review

How to use Claude Code to review a pull request.
10:30 a.m.: Tab 5 has discovered the email opening bug. Together, we explore Gmail’s
technical documentation and the third-party code that bridges our app with Gmail’s
services.
11:00 a.m.: I use my favorite shortcut: I type “PR” in each tab. Claude Code creates five
separate pull requests, each with proper descriptions and linked issues, and following our
team conventions.
11:30 a.m.: Time for human review. I check business logic, ensure the user experience
makes sense, and add those nitpicky style preferences that make code feel like our code.
The beauty is that you can have Claude Code review a pull request made by a human and
have a human fix the comments it provides. You can pick one comment for Claude Code to
address or have it apply every change the engineer suggested.
11:45 am: With that task done, I go through feature requests and bug reports in
Featurebase (where customers can give feedback) to find the next one. I use my custom
Claude Code command, and model context protocol (MCP) integration—tools that let
Claude Code read customer feedback, analyze patterns, and automatically create GitHub
issues from the most important requests.
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

9/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

CC Customer Success

How to use Claude Code to extract feature requests from a customer support portal, analyze, respond,
and triage them, and then create GitHub issues.

The final verdict
My two-person team produces code like a much larger group. We spend $400 per month
for two Claude Code subscriptions, and it pays for itself in days.
The one-line pitch: It’s having a colleague you can delegate clearly defined work to.
Who should try: Everyone, even non-technical people. My technically illiterate friends
find it easier to use to write software than Cursor because the interface is simple.
Who will love this: Senior engineers tired of implementation details, tech leads who want
to multiply their impact, anyone maintaining software who wishes they had three more of
themselves, and non-technical founders held back by not knowing how to build.
Getting started: Start with the $20-per-month plan. Give it a real project, not a toy
problem. Open your terminal, type what you want in plain English, and watch it work. For
non-developers, try “Help me build a personal website.” For developers, type “PR” and

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

10/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

prepare to reconsider what coding means—the work you do yourself versus delegate, how
fast you can ship, and how big of a team you need..
The learning curve: You have to unlearn coding. Stop thinking in terms of files and
functions. Start thinking about outcomes and delegation.
Welcome to the future. It runs in your terminal and waits to build whatever you imagine.

Thanks to Katie Parrott for editorial support.
Kieran Klaassen is the general manager of Cora, Every’s email product. Follow him on X at
@kieranklaassen or on LinkedIn. To read more essays like this, subscribe to Every, and follow us on X
at @every and on LinkedIn.
We build AI tools for readers like you. Write brilliantly with Spiral. Organize files automatically
with Sparkle. Deliver yourself from email with Cora. Dictate effortlessly with Monologue.
We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
Get paid for sharing Every with your friends. Join our referral program.
For sponsorship opportunities, reach out to sponsorships@every.to.
Help us scale the only subscription you need to stay at the edge of AI. Explore open roles at Every.

Subscribe
What did you think of this post?

Amazing

Good

Meh

Bad

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

11/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Get More Out Of Your Subscription
Try our AI tools for ultimate productivity

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

Inside the AI Workflows of Every’s Six Engineers
Each person on the team has tailored
their stack to their individual tastes

131 Oct 27, 2025
https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

12/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five
RHEA PUROHIT

Claude Code Camp: The Workflows
Turning One Engineer Into Ten
Demos and tips from our second
expert workshop, on subagents

34 Aug 28, 2025
KATIE PARROTT

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
Darshen Patel 23 days ago
Great article! Clear and succinct.
♡ 0 · Reply

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

13/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

@rahim 14 days ago
In the "Compare Claude Code to the alternatives" you say that Cursor and Codex required
you to work in some other environment (e.g. browser).
But both of these work just fine on the command line. Cursor comes with a command-line
tool 'cursor-agent', and Codex's command line tool is called 'codex'.
You didn't mention Gemini's cli, which also functions in a very similar fashion to claude
code and the other cli-based coding agents.
♡ 0 · Reply

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

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

14/15

2/19/26, 1:00 PM

How I Use Claude Code to Ship Like a Team of Five

Terms

Site map

©2026 Every Media, Inc.

https://every.to/source-code/how-i-use-claude-code-to-ship-like-a-team-of-five-6f23f136-52ab-455f-a997-101c071613aa

15/15

