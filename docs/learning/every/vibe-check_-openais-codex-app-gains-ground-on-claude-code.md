2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Roman Popenov

Midjourney/Every illustration.
Vibe Check

Vibe Check: OpenAI’s Codex App Gains
Ground on Claude Code
OpenAI nailed the interface. But it's built for hardcore engineering.
DAN SHIPPER

KATIE PARROTT

February 2, 2026 · Updated February 19, 2026

Listen

6

1

TL;DR: You’re getting our full Vibe Check on the new Codex app because you’re a paid subscriber to
Every—thank you for your support. If you want high-level takeaways from our testing, explore our

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

1/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

interactive site or read on for the complete analysis. We’re also hosting a livestream about the release
on YouTube at 1 p.m. ET.—Kate Lee
Was this newsletter forwarded to you? Sign up to get it in your inbox.

Anthropic has been spending more time in the AI spotlight recently, as even “non-nerds”
are psyched about Claude Code.
Two weeks ago, I (Dan) wrote that OpenAI has some catching up to do on the coding
front. Today, they’re announcing a step in the right direction.
The company is shipping a Codex desktop app. The original Codex launched as a web app
last May, three months after Claude Code. At the time, we deemed it best for techies, not
vibe coders.
The new release is a Mac app for programming with Codex, but it’s not an integrated
development environment (IDE)—an all-in-one environment for writing code—like
Cursor. Instead, it’s what OpenAI is calling a “command center for agents,” designed to
replace the terminal user interface most people (like me, Dan) use to interact with Codex
and Claude Code today.
The interface is reminiscent of the popular agent orchestration tool Conductor: It has a
left sidebar that allows you to start and manage multiple parallel threads with agents in
different workspaces. The middle of the screen shows a chat interface for you to manage
each agent as it’s working, and the right sidebar optionally pops up to show you code diffs
(like “Suggesting” mode in Google Docs but for code):

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

2/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

The UI of the new Codex app, with the left sidebar navigation and center chat interface for
interacting with agents. (Image courtesy of Dan Shipper.)

We’ve been testing the app internally for a few weeks, and it’s very good. In fact, it’s the
first app that’s made me switch out of my terminal for coding since Claude Code launched.
We’ve sped through the terminal era over the last six months, and a return to graphical
user interfaces (GUIs) for coding is upon us.
Previously, I was using Claude Code 80 percent of the time and Codex 20 percent of the
time. Over the last few weeks in the app, that percentage has become 50-50. For large
production apps, Codex is slower but smarter and more reliable than Claude Code. Opus
4.5 is still my daily driver for the rest of my work, and for programming tasks that require
taste, empathy, and speed (leaving complex bug fixes, new features in large codebases, and
plan and code review for Codex), but the reversal is significant.
Where does that leave Every’s engineering team? Our lead engineer, Andrey Galko, and
Naveen Naidu, general manager of Monologue, are devoted Codex users already. Then
there’s our die-hard Claude Code advocate, Cora general manager Kieran Klaassen. Will
they make room in their lives for the Codex app the way I have?
Here’s your full day-zero Vibe Check.
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

3/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

A Codex app walkthrough: GUIs are so back!
The Codex app is a Mac application that provides a desktop interface for Codex, replacing
the command line (in which developers build through text-based commands) with a visual
interface.

OpenAI’s vision of the future of coding is just a download away. (Image courtesy of Dan.)

After Claude Code, many developers stopped bothering with visual interfaces. For people
who know their way around a terminal, GUIs felt like a step backward—slower, more
cluttered, and less powerful. A relic from an era of coding before agents.
The Codex app is the first GUI that doesn’t feel that way. It has a few features that make it
powerful:
Local to cloud sync: It’s easy to kick off a task in the Codex app and then move it to
the cloud so you can keep working on the go.
Plan mode: Plan mode has been a key piece of Claude Code’s workflow for months
now, but now it’s becoming available in Codex. You can activate it by pressing Shift
+ Tab.

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

4/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Skills: The Codex app features a library that lets you download pre-built skills and
create or import your own.
Automations: The app allows you to easily schedule prompts to run at specific
times—for example, asking Codex to compound learnings in each of your
workspaces, work through customer service tickets, or update a dashboard with new
data.
Easy access YOLO mode: You can give Codex full access to your computer by
clicking one button.
During testing, the app has been updating multiple times per day, suggesting OpenAI is
iterating fast. Andrey summed up the competitive implications: “RIP 5,000 startups.”
OpenAI is commoditizing an ecosystem of companies building visual interfaces,
synchronous solutions, and workflow wrappers around coding agents.
Anthropic is still ahead overall. The combination of Claude Code, Cowork, and Opus 4.5 is
faster, more versatile, and better for a wider range of use cases. But OpenAI is gaining
ground.

The Reach Test

Reach Test legend

🥇 : Paradigm shift
🟩 : Psyched about this release
🟨 : It’s okay, but I wouldn’t use it every day
🟥 : Trash release

Dan Shipper, co-founder and CEO
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

🟩
5/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

“This is the first GUI for agentic coding that feels like a step forward for me. I’ve found
myself working mostly in Codex these last few weeks—with the occasional flip back to
Claude Code for tasks that require its empathy, user experience skills, and speed. They’re
actually nice complements, but I went from 80 percent Claude Code, 20 percent Codex to
50-50 with this release.”

Andrey Galko, engineering lead

🟩

“The sync between cloud and local is genuinely cool, and the user interface is clean. This
isn’t OpenAI playing catch-up anymore. They’re competitive.”

Naveen Naidu, general manager of Monologue

🟩

“I’m super-green. The sidebar makes it dead simple to kick off tasks, and the whole user
interface just makes working across my codebases feel effortless. I looked at my
Monologue usage and saw it drop significantly from the Ghostty CLI (my usual way of
using coding agents). Now I’m just living in the Codex app. Big shift in the last week, and
I’m excited for where this is going.”

Kieran Klaassen, general manager of Cora

🟨

“It’s a nice UI, but going back to a graphical interface feels like a step backward in my
workflow. I believe the future is more agentic and less human-controlled—Claude Code
already lets me hand off tasks and trust the agent to figure it out. That said, for developers
who aren’t there yet, this is a solid option. The parallel work feature is especially useful if
you don’t want to understand worktrees and multi-repository setups.”

The good and the bad
Cloud-to-local sync made Andrey lose his mind (in a
good way)
One quality-of-life upgrade that has Andrey excited: cloud-to-local sync. You can push a
local Codex session to the cloud, continue from the web or your phone, and then pull it
back down when you return to your machine. Your conversation history, context, and
progress transfer between environments. “I love it,” Andrey said after more testing. “It is
very cool that we can switch between cloud and local seamlessly.”
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

6/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Andrey was a little excited when he realized he could move his local history to the cloud and
vice versa. (Image courtesy of Katie Parrott/Discord.)

The limitation is that it’s not automatic. You have to manually push and pull between
environments. But the direction is clear—and no other company building AI coding tools
is doing this yet.

Finally, a true YOLO mode
I think Codex in the terminal has had a YOLO mode—which gives it full access to your
computer—for a while, but even though it’s my job, I never found it. I tried a few different
flags to set it free, but it kept asking for permission for basic tasks like writing files or
uploading to GitHub.
That has finally changed. Now, all you have to do is press the lock icon in any open thread,
and you’ll never see a permission dialog again:
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

7/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

The lock icon in the corner of the chat window lets you toggle “YOLO mode” on and off.
(Image courtesy of Dan.)

I don’t want to read a diff review. Ever.
The Codex app includes inline diff review—you can see exactly what the agent changed in
your code, line by line, with the option to comment. In theory, this keeps you informed. In
practice, I found it overwhelming.
If I’m coding in English, I want to do code review in English, too. I don’t want to see
hundreds of lines of code changes that I have to parse through manually. What I actually
want is a high-level summary—what changed, why, and what to watch out for.
This is a philosophical divide. Some senior engineers want to review diffs. They’ve been
burned by bad code, and they don’t trust agents to get it right. OpenAI is building for
them. But for those of us who’ve made peace with not reading every line, the diff review
feels like homework.

Interrupting the model can cause problems
One thing that Claude does that Codex can’t yet: Hold the thread when you interrupt.

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

8/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Mid-conversation with Claude, I can send a follow-up message to add context or redirect
its thinking. Claude incorporates the new information without losing track of what it was
doing. Codex handles this differently. A follow-up message effectively ends the current
thinking process and starts a new one. It often forgets what it was working on.

Codex struggles when a user adds new information to inform an existing thought process.
(Image courtesy of Dan.)

It’s a small thing, but it adds up. When you’re deep in a debugging session and realize you
forgot to mention a constraint, you want to add it without derailing the whole train of
thought. With Codex, you’re often better off waiting until it finishes or starting over.

How it stacks up
Codex app versus Claude Code
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

9/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

If you’re a vibe coding Claude Code fanatic, this release isn’t for you. Codex is going to be
too slow and engineer-coded. But if you’re a senior engineer looking to level up your
agentic coding work, it’s absolutely worth a look and could become a major part of your
workflow.
Codex app versus Cursor
Cursor is a code editor with an agent built in. The Codex app is an agent orchestration app
—with the ability to view diffs if you want to.
There’s a high degree of overlap between the two, but Codex feels less cluttered if you
only want to manage agents. If you’re using Cursor day-to-day, you should give Codex a
shot.

Codex app versus Claude Cowork
Cowork, which Anthropic released last month, is Claude Code for non-coders. It allows
you to let agents run by themselves while you step away from your computer and save files
on your computer, but is wrapped in a friendly visual interface.
The Codex app is for developers—for now—and the model that powers it, GPT-5.2Codex, isn’t nearly as flexible, fast, or friendly as Opus 4.5 for the non-technical crowd. If
you’re a heavy Cowork user, you should skip the Codex app for now.

Who should try it
If you’re on ChatGPT Plus ($20 per month) and curious about coding agents: This is the
cheapest way to experiment with agentic coding.
If you currently use Codex in the terminal, Cursor, or any traditional IDE: The Codex
app will help you get your coding work done in a purpose-built, powerful, and clean
interface. It doesn’t have the clutter or baggage of being an IDE, and it’s built for
professional programmers.

What you gain if you switch
An easy visual interface for managing multiple parallel agents
Cloud-to-local sync (start anywhere, continue anywhere)
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

10/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Skills and automations that are easy to set up and use
Cheaper entry point at the Plus tier ($20 versus $100)

Which way, modern developer?
The Codex app is a step in the right direction for OpenAI.
It’s the first new product launch from the company in a while that shows they understand
where the discipline of programming is heading in a world with agents. OpenAI made it
easy to give the model full access to your computer and parallelize the work of multiple
agents, and hid code diffs in the sidebar. That’s something to celebrate.
This makes it competitive for any professional programmers who want to orchestrate
agents. However, for vibe coders or non-technical users who want to use the power of
programming agents to get work done—which is increasingly what I believe to be the
future of how we’ll work on our computers—Codex isn’t there yet.
The interface and its marketing is still for professional programmers, and the underlying
model (GPT-5.2 Codex) is still slow and personality-less. Signs like OpenAI’s recent deal
with Cerebrus point to this changing, but until it does, there’s still work to do for them to
catch up to Anthropic overall.

Dan Shipper is the cofounder and CEO of Every, where he writes the Chain of Thought column and
hosts the podcast AI & I. You can follow him on X at @danshipper and on LinkedIn.
Katie Parrott is a staff writer and AI editorial lead at Every. You can read more of her work in her
newsletter.
To read more essays like this, subscribe to Every, and follow us on X at @every and on LinkedIn.
We build AI tools for readers like you. Write brilliantly with Spiral. Organize files automatically
with Sparkle. Deliver yourself from email with Cora. Dictate effortlessly with Monologue.
We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

11/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Get paid for sharing Every with your friends. Join our referral program.
For sponsorship opportunities, reach out to sponsorships@every.to.
Help us scale the only subscription you need to stay at the edge of AI. Explore open roles at Every.

Subscribe
What did you think of this post?

Amazing

Good

Meh

Bad

Get More Out Of Your Subscription
Try our AI tools for ultimate productivity

Front-row access to the future of AI

In-depth reviews of new models on

Bundle of AI software

Sparkle: Organize your Mac with AI

release day

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

12/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Playbooks and guides for putting AI to
Cora: The most human way to do email

work

Prompts and use cases for builders

Spiral: Repurpose your content endlessly

Monologue: Effortless voice dictation for your Mac

RELATED ESSAYS

Vibe Check: Claude Sonnet 4 Now Has
a 1-million Token Context Window
Fast, reliable long-context responses—for a price

64 Aug 12, 2025
DAN SHIPPER

Vibe Check: Claude Skills Need a ‘Share’ Button
The feature is powerful for individuals and tricky
for teams—but it does lighten the cognitive load

20 7 Nov 3, 2025
KATIE PARROTT

Vibe Check: Codex—
OpenAI’s New Coding Agent
Our hands-on day-0 review of the
new autonomous software engineer

42 May 16, 2025
DAN SHIPPER

Comments

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

13/15

2/19/26, 1:02 PM

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code

Write a comment
Post
Write a comment
Post

You need to login before you can comment.
Don't have an account? Sign up!

Lorin Ricker 14 days ago
While I'm always groused by apps and products that are "Mac only" (or worse, "Windows
only"), a bit of exploration of the OpenAI Codex got me to https://openai.com/form/codexapp/, where I was able at least to "Sign up to get notified when Codex app is available for
...Linux users." So, I'll be late to the party (again), but at least my camp is not being totally
excluded. Thanks for the Codex insight, preview and comparisons!
♡ 0 · Reply

What Comes Next
New ideas to help you build the future—in your inbox, every day.
This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.

About

X

Jobs

LinkedIn

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

14/15

2/19/26, 1:02 PM
Help center

Vibe Check: OpenAI's Codex App Gains Ground on Claude Code
YouTube

Privacy Preferences

Advertise with us

The team

FAQ

Terms

Site map

©2026 Every Media, Inc.

https://every.to/vibe-check/vibe-check-openai-s-codex-app-gains-ground-on-claude-code

15/15

