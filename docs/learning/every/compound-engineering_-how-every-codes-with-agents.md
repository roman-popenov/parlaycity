2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

Roman Popenov

Midjourney/Every illustration.
Chain of Thought

Compound Engineering: How Every Codes
With Agents
A four-step engineering process for software teams that don’t write
code
DAN SHIPPER

KIERAN KLAASSEN

December 11, 2025 · Updated February 14, 2026

Listen

37

2

Our last coding camp of the year is Codex Camp—a live workshop about building with OpenAI’s
coding agent, open to all Every subscribers on Friday, December 12 at 12 p.m. ET. Learn more and
https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

1/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

reserve your spot.
Was this newsletter forwarded to you? Sign up to get it in your inbox.

What happens to software engineering when 100 percent of your code is written by
agents? This is a question we’ve had to confront head-on at Every as AI coding has become
so powerful. Nobody is writing code manually. It feels weird to be typing code into your
computer or staring at a blinking cursor in a code editor.
So much of engineering until now assumed that coding is hard and engineers are scarce.
Removing those bottlenecks makes traditional engineering practices—like manually
writing tests, or laboriously typing human readable code with lots of documentation—feel
slow and outdated. In order to deal with these new powers and changing constraints, we’ve
created a new style of engineering at Every that we call compound engineering.
In traditional engineering, you expect each feature to make the next feature harder to
build—more code means more edge cases, more interdependencies, and more issues that
are hard to anticipate. By contrast, in compound engineering, you expect each feature to
make the next feature easier to build. This is because compound engineering creates a
learning loop for your agents and members of your team, so that each bug, failed test, or aha problem-solving insight gets documented and used by future agents. The complexity of
your codebase still grows, but now so does the AI’s knowledge of it, which makes future
development work faster.
And it works. We run five software products in-house (and are incubating a few more),
each of which is primarily built and run by a single person. These products are used by
thousands of people every day for important work—they’re not just nice demos.
This shift has huge implications for how software is built at every company, and how
ambitious and productive every developer can be: Today, if your AI is used right, a single
developer can do the work of five developers a few years ago, based on our experience at
Every. They just need a good system to harness its power.
The rest of this piece will give you a high-level sense of how we practice compound
engineering inside of Every. By the time you’re done, you should be able to start doing the
https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

2/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

basics yourself—and you’ll be primed to go much deeper.

Compound engineering loop
A compound engineer orchestrates agents running in parallel, who plan, write, and
evaluate code. This process happens in a loop that looks like this:
1. Plan: Agents read issues, research approaches, and synthesize information into
detailed implementation plans.
2. Work: Agents write code and create tests according to those plans.
3. Review: The engineer reviews the output itself and the lessons learned from the
output.
4. Compound: The engineer feeds the results back into the system, where they make
the next loop better by helping the whole system learn from successes and failures.
This is where the magic happens.
We use Anthropic’s Claude Code primarily for compound engineering, but it is toolagnostic—some members of our team also use startup Factory’s Droid and OpenAI’s
Codex CLI. If you want to get more hands-on with how we do this, we’ve built a
compound engineering plugin for Claude Code that lets you run the exact workflow we use
internally yourself.
Roughly 80 percent of compound engineering is in the plan and review parts, while 20
percent is in the work and compound.
Let’s dive in.

1. Plan
In a world where agents are writing all of your code, planning is where most of a developer’s
time is spent. A good plan starts with research: We ask the agent to look through the
current codebase and its commit history to understand the codebase’s structure, existing
best practices, and how it was built. We also ask it to scour the internet for best practices
relevant to the problem we’re trying to solve. That way when we begin to plan the agent is
primed to do good work.

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

3/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

Once the research is complete, the agent writes a plan. Usually this is a text document that
lives either as a file on your computer or an issue on Github. The plan lays out everything:
the objective of the feature, the proposed architecture, specific ideas for how the code
might be written, a list of sources for its research, and success criteria.

A planning document for a Cora feature. (Image courtesy of Kieran Klaassen.)

Planning helps build a shared mental model between you and the agent for exactly what
you’re building, before you build it. Good planning is not pure delegation—it requires the
developer to think hard and be creative in order to push the agent down the right paths.

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

4/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

As models get better, especially with small projects, you have to plan less and less—the
agent just gets what you want, or maybe does something surprising but good. With
complex production projects, though, a good plan is an essential part of building highquality software that works as you expect.
Once you have a good plan, the hard part is almost over.

2. Work
This is the easiest step because it’s so simple: You just tell the agent to start working. The
agent will take your plan, turn it into a to-do list, and build step-by-step.
One of the most important tricks for this step is using a model context protocol like
Playwright or XcodeBuildMCP. These are tools that allow the agent to use your web app
or simulate use on a phone as it’s being built, as if it were one of your users. So it will write
some code, walk through the app and notice issues, and then modify the code and repeat
until it’s done. This is especially good for design tasks and workflows because it can iterate
on a prototype until it looks like the design.
With the latest generation of agents like Opus 4.5, what comes out of the work phase is
much more likely to be functional and error-free, and is often actually pretty close to what
you envisioned, especially if your plan was well-written.
But even good output needs to be checked, and that’s what we do in the next step.

3. Assess
In the assessment step, we ask the agent to review its own work, and we review the work
too. This can take many forms: We use traditional developer tools like linters and unit
tests to find basic errors, and we test manually to sanity-check what was built. We also use
automatic code review agents like Claude, Codex, Friday, and Charlie to spot-check the
code for common issues.
The latest AI makes the assess step even more powerful. Our compound engineering
plugin, for example, reviews code in parallel with 12 subagents that each check it from a
different perspective. One looks for common security issues, another checks for common
performance issues, another looks at it to see if anything was overbuilt, so software isn’t
https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

5/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

bloated or too complex. All of these different perspectives are synthesized and presented
so that the developer can decide what needs to be fixed and what can be ignored.
The real power of compound engineering happens in the next step—where we make sure
we never encounter the same problems again.

4. Compound
This is the money step. We take what we learned in any of the previous steps—bugs,
potential performance issues, new ways of solving particular problems—and record them
so that the agent can use them next time. This is what makes compounding happen in
compound engineering.
For example, in the codebase for Every’s AI email assistant Cora, before building anything
new, the agent has to ask itself: Where does this belong in the system? Should it be added
to something that already exists, or does it need its own new thing? Have we solved a
similar problem before that we can reuse? These questions come with specific technical
examples from mistakes we’ve made in the past that prime the agent to find the right
solution at the right place in the codebase.
These rules are built up in a mostly automated fashion. After we do a code review, for
example, we’ll ask the agent to look at the comments, summarize them, and store them for
later. The latest models are smart enough to do all of this with very little extra instruction
—and they’re also smart enough to actually use it the next time.
The beauty of this is that these learnings are also automatically distributed to the team.
Because they get written down as prompts that live inside of your codebase or in plugins
like ours, every developer on your team gets them for free. Everyone becomes more
productive: A new hire who’s never been in the codebase before is as well-armed to avoid
common mistakes as someone who’s been on the team for a long time.

Compound engineering: Looking and learning ahead
This is just a basic overview of compound engineering—each one of these steps can and
often is its own article. We have also not addressed some of the constraints that still exist
with this new way of producing software—namely, how fast a developer can decide what
they want to build, process and improve a plan, and describe what good looks like.
https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

6/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

We are still just scratching the surface of the possibilities of compound engineering and its
broader implications. Manually writing tests or writing human-readable code with lots of
documentation is now unnecessary. So is asking an engineering candidate to code without
access to the internet, or expecting it to take weeks for new hires to commit code. And so is
being locked into a particular platform or technology because the legacy code is too hard
to understand, and replatforming would be too expensive. We’re excited to write more
about what this new way of engineering unlocks.
If you’re interested in this topic, we highly recommend you read some of the other articles
we’ve published about it:
“Stop Coding and Start Planning”
“Teach Your AI to Think Like a Senior Engineer”
“My AI Had Already Fixed the Code Before I Saw It”
“How Every Is Harnessing the World-changing Shift of Opus 4.5”
And make sure you come to our Claude Code Camps and other events and courses. We’ll
have more writing over the coming days and weeks on each step of this process, and how
it’s changed engineering at Every and beyond.

Dan Shipper is the cofounder and CEO of Every, where he writes the Chain of Thought column and
hosts the podcast AI & I. You can follow him on X at @danshipper and on LinkedIn, and Every on
X at @every and on LinkedIn.
Kieran Klaassen is the general manager of Cora, Every’s email product. Follow him on X at
@kieranklaassen or on LinkedIn.
To read more essays like this, subscribe to Every, and follow us on X at @every and on LinkedIn.
We build AI tools for readers like you. Write brilliantly with Spiral. Organize files automatically
with Sparkle. Deliver yourself from email with Cora. Dictate effortlessly with Monologue.
We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

7/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

Get paid for sharing Every with your friends. Join our referral program.
For sponsorship opportunities, reach out to sponsorships@every.to.

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

Playbooks and guides for putting AI to

Cora: The most human way to do email

work

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

8/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

Prompts and use cases for builders
Spiral: Repurpose your content endlessly

Monologue: Effortless voice dictation for your Mac

RELATED ESSAYS

GPT-4.5 Won’t Blow Your Mind.
It Might Befriend It Instead.
We’ve been testing the latest model
for a few days. Here’s what we found.

54 2 Feb 27, 2025
DAN SHIPPER

Microsoft’s AI Vision: An Open
Internet Made for Agents
On the ground at the Microsoft Build
conference with CTO Kevin Scott

70 1 May 20, 2025
DAN SHIPPER

AI Can Fix Social Media’s Original Sin
You are what you say you are—not just what you click

47 4 Apr 25, 2025
DAN SHIPPER

Comments

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

9/11

2/19/26, 12:58 PM

Write a comment

Compound Engineering: How Every Codes With Agents

Post
Write a comment
Post

You need to login before you can comment.
Don't have an account? Sign up!

@mustafa.aydogdu999 about 2 months ago
In the Compound step, you say:
We take what we learned in any of the previous steps—bugs, potential performance
issues, new ways of solving particular problems—and record them so that the agent can
use them next time.
Where do you save your records? In an .md file or models do it theirself when you instruct
them to do so?
♡ 1 · Reply

@everyto_36cd54_1 about 1 month ago
This is essentially the Deming Cycle. Glad that it's come full circle to this.
♡ 0 · Reply

What Comes Next
New ideas to help you build the future—in your inbox, every day.
This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

10/11

2/19/26, 12:58 PM

Compound Engineering: How Every Codes With Agents

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

https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

11/11

