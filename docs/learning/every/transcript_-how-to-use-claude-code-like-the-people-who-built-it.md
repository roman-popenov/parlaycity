2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Roman Popenov

AI & I

Transcript: ‘How to Use Claude Code Like
the People Who Built It’
'AI & I' with Anthropic's Cat Wu and Boris Cherny
DAN SHIPPER

October 29, 2025 · Updated January 28, 2026

Listen

4

The transcript of AI & I with Claude Code engineers Cat Wu and Boris Cherny is below.
Watch on X or YouTube, or listen on Spotify or Apple Podcasts.

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

1/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Timestamps
1. Introduction: 00:01:26
2. Claude Code’s origin story: 00:02:25
3. How Anthropic dogfoods Claude Code: 00:07:03
4. Boris and Cat’s favorite slash commands: 00:14:06
5. How Boris uses Claude Code to plan feature development: 00:15:49
6. Everything Anthropic has learned about using sub-agents well: 00:21:53
7. Use Claude Code to turn past code into leverage: 00:26:16
8. The product decisions for building an agent that’s simple and powerful: 00:33:14
9. Making Claude Code accessible to the non-technical user: 00:36:38
10. The next form factor for coding with AI: 00:45:12

Transcript
(00:00:00)
Dan Shipper
Cat, Boris, thank you so much for being here.
Cat Wu
Thanks for having us on.
Dan Shipper
Yeah. So for people who don’t know you, you are the creators of Claude Code. Thank you
very much. From the bottom of my heart, I love Claude Code. That’s amazing to hear.
I think the place I want to start is when I first used it, there was this moment—I think it
was around when Sonnet 3.7 came out—where I used it and I was like, holy shit, this is a
completely new paradigm. It’s a completely new way of thinking about code. And the big
difference was you went all the way and just eliminated the text editor. All you do is talk to
the terminal and that’s it.

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

2/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Previous paradigms of AI programming—previous harnesses—have been like, you have a
text editor and you have the AI on the side, or it’s the tab complete. So take me through
that decision process of architecting this new paradigm. How’d you think about that?
Boris Cherny
Yeah, I think the most important thing is it was not intentional at all. We sort of ended up
with it. So at the time when I joined Anthropic, we were still on different teams at the
time. There was this previous predecessor to Claude Code. It was called Clide, like C-L-ID-E, at Anthro. And it was this research project, you know, it took like a minute to start
up. It was this kind of really heavy Python thing. It had to run a bunch of indexing and
stuff. And when I joined, I wanted to ship my first PR and I hand wrote it like a noob at a
time. I didn’t know about any of these tools.
Thank you for admitting that on the podcast.
I didn’t know any better. And then I put up this PR and Adam Wolf, who was the eng
manager for our team for a while—he was my ramp up buddy—and he just rejected the PR
and he was like, you wrote this by hand. What are you doing? He was quiet. He was also
hacking a lot on Clide at the time. And so I tried Clide. I gave it the description of the task
and it just like one shot this thing. And this was, you know, Sonnet 3.5. So I still had to fix a
thing even for this kind of basic task. And the harness was super old, so it took like five
minutes to turn this thing out and just took forever. But it worked. And I was just mind
blown that this was even possible. And they just kind of got the gears turning. Maybe you
don’t actually need an IDE.
And then later on I was prototyping using the Anthropic API and the easiest way to do
that was just building a little app in the terminal, because that way I didn’t have to build a
UI or anything. And I started just making a little chat app and then I just started thinking
maybe we could do something a little bit like Clide. So I let it build like a little Clide. And it
actually ended up being a lot more useful than that without a lot of work. And I think the
biggest revolution for me was when we started to give the model tools, they just started
using tools and it was just—it was this insane moment. Like the model just wants to use
tools. We give it bash and they just started using bash, writing AppleScript to automate
stuff in response to questions. And I was like, this is just the craziest thing. I’ve never seen
anything like this. Because at the time I had only used IDEs, so like, you know, text editing
a little, like one line auto complete, multi-line auto complete, whatever.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

3/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

So that’s where this came from. It was this kind of convergence of prototyping, but also
kind of seeing what’s possible in a very rough way. And this thing ended up being
surprisingly useful. And I think it was the same for us. I think for me it was like a Sonnet 4
Opus forward. That’s where that magic moment was, where it was like, oh my god, this
thing works.
Dan Shipper
That’s interesting. So tell me about that tool moment, because I think that is one of the
special things about Claude Code—it just writes bash and is really good at it. And I think a
lot of previous agent architectures or even anyone building an agent today, your first
instinct might be, okay, we’re going to give it a find file tool and then we’re going to give it
an open file tool. And you build all these custom wrappers for all the different actions you
might want the agent to take, but Claude Code just uses bash and it’s really good at it. So
what do you think about what you learned from that?
Boris Cherny
Yeah, I think we’re at this point right now where Claude Code actually has a bunch of
tools. I think it’s like a dozen or something like this. We actually add and remove tools
most weeks, so this changes pretty often. But today there actually is a search—there’s a
tool for searching. And we do this for two reasons. One is the UX, so we can show the
result a little bit nicer to the user because there’s still a human in the loop right now for
most tasks. And the second one is for permissions. So if you say in your Claude Code
settings, “do not touch this file, you cannot read,” we have to kind of enforce this. We
enforce it for bash, but we can do it a little bit more efficiently if we have a specific search
tool.
But definitely we want to unship tools and kind of keep it simple for the model. Like last
week or two weeks ago, we unshipped the LS tool. In the past we needed it, but then we
actually built a way to enforce this kind of permission system for bash. So in bash, if we
know that you’re not allowed to read a particular directory, Claude’s not allowed to access
that directory. And because we can enforce that consistently, we don’t need this tool
anymore. And this is nice because it’s a little less choice for Claude, a little less stuff in
context.
Dan Shipper
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

4/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Got it. And how do you guys split responsibility on the team?
Cat Wu
I would say Boris sets the technical direction and has been the product visionary for a lot of
the features that we’ve come out with. I see myself as more of a supporting role to make
sure that, one, our pricing and packaging resonates with our users. Two, making sure that
we’re shepherding our features across the launch process. So from deciding, all right, these
are the prototypes that we should definitely dogfood, to setting the quality threshold for
dogfooding through to communicating that to our end users.
And there’s definitely some new initiatives that we’re working on that I would say
historically a lot of Claude Code has been built bottom-up. Boris and a lot of the core team
members have just had these great ideas for to-do list, sub-agents, hooks—all these are
bottom-up. As we think about expanding to more services and bringing Claude Code to
more places, I think a lot of those are more like, all right, let’s talk to customers. Let’s bring
engineers into those conversations and prioritize those services and knock them out.
Dan Shipper
Got it. What is ant fooding?
Cat Wu
Oh, ant fooding. It means dogfooding. So Anthropic Ant—our nickname for internal
employees is Ant and so ant fooding is our version of dogfooding. Internally over I think
70 or 80 percent of ants—technical Anthropic employees—use Claude Code every day.
And so every time we are thinking about a new feature, we push it out to people internally
and we get so much feedback. We have a feedback channel. I think we get a post every five
minutes. And so you get a really quick signal on whether people like it, whether it’s buggy,
or whether it’s not good and we should unship it.
Dan Shipper
You can tell that someone that is building stuff is using it all the time to build it, because
the ergonomics just make sense if you’re trying to build stuff. And that only happens if
you’re ant fooding. And I think that’s a really interesting paradigm for building new stuff,
that sort of bottom-up. I make something for myself. Tell me about that.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

5/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Boris Cherny
Yeah. And Cat, Cat is also so humble. I think Cat has a really big role in the product
direction also. It comes from everyone on the team and these specific examples actually
came from everyone on the team. To-do lists and sub-agents—that was Sid. Hooks—
Dixon shipped that. Plugins—Daisy shipped that. So everyone on the team, these ideas
come from everyone.
And so I think for us, we build this core agent loop and this kind of core experience, and
then everyone on the team uses the product all the time. And so everyone outside the team
uses the product all the time. And so there’s just all these chances to build things that serve
these niches. Like for example, bash mode, you know, the exclamation mark. You can type
in bash commands. This was just like many months ago. I was using Claude Code and I was
going back and forth between two terminals and just thought it was kind of annoying. And
just on a whim, I asked Claude to kind of think of ideas. I thought of this exclamation mark
bash mode. And then I was like, great, make it pink and then ship it. It just did it. And
that’s the thing that’s still kind of persisted and you know, now you see kind of others also
kind of catching onto that.
Dan Shipper
That’s funny. I actually didn’t know that. And that’s extremely useful because I always have
to open up a new tab to run any bash command. So you just do an exclamation point and
then it just runs it directly instead of filtering it through all the Claude stuff ?
Cat Wu
Yeah. And Claude Code sees the full output too.
Dan Shipper
Interesting. That’s perfect.
Cat Wu
So anything you see in the Claude Code view, Claude Code also sees.
Dan Shipper
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

6/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Okay. That’s really interesting. Yeah.
Boris Cherny
And this is kind of a UX thing that we’re thinking about. In the past, tools were built for
engineers, but now it’s equal parts engineers and models. And so as an engineer you can see
the output, but it’s actually quite useful for the model also. And this is part of the
philosophy also—everything is dual use.
So for example, the model can also call slash commands. So like, you know, I have a slash
command for slash commit where I run through kind of a few different steps, like linting
and generating a reasonable commit message and this kind of stuff. I run it manually, but
also Claude can run this for me. And this is pretty useful because we get to share this logic.
We get to kind of define this tool and then we both get to use it.
Dan Shipper
Yeah. What are the differences in designing tools that are dual use from designing tools
that are, you know, used by one or the other?
Boris Cherny
Surprisingly, it’s the same. So far. Yeah, I sort of feel like this kind of elegant design for
humans translates really well to the models.
Dan Shipper
So you’re just thinking about what would make sense to you and the model. Generally it
makes sense to the model too, if it makes sense to you.
(00:10:00)
Cat Wu
I think one of the really cool things about Claude Code being a terminal UI and what made
it work really well is that Claude Code has access to everything that an engineer does at the
terminal. And I think when it comes to whether the tool should be dual use or not, I think
making them dual use actually makes the tools a lot easier to understand. It just means
that, okay, everything you can do, Claude can do. There’s nothing in between.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

7/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Dan Shipper
That’s interesting. Yeah. There are a couple of those decisions. So no code editor, it’s in the
terminal, so it has access to your files, and it’s on your computer vs. in Claude in a virtual
machine. So you get repeated—you get to use it in a repeated way where you can build up
your Claude MD file or, you know, build slash commands and all that kind of stuff where it
becomes very composable and extensible from a very simple starting point. And I’m
curious about how you think about, you know, for people who are thinking about, okay, I
want to build an agent, I want to build, probably not Claude Code, but something else—
how you get that simple package that then can extend and be really powerful over time.
Boris Cherny
For me, I’d start by just thinking about it like developing any kind of product where you
have to solve the problem for yourself before you can solve it for others. And this is
something that they teach in YC, if you have to start with yourself. So if you can solve your
own problem, it’s much more likely you’re solving the problem for others.
And I think for coding, starting locally is the reasonable thing. And you know, now we
have Claude Code on the web, so you can also use it with a virtual machine and you can use
it in a remote setting. And this is super useful when you’re on the go. You want to—
Dan Shipper
I didn’t know that. Is that out?
Boris Cherny
Yeah. Yeah. I think by the time this podcast is released, And this is sort of—we started
proving this out kind of a step at a time. Where you can do at Claude on GitHub. And I use
this every day, like on the way to work. I’m at a red light. I probably shouldn’t be doing
this, but I’m like, yeah, you know, on GitHub at a red light, and then I’m like, at Claude,
you know, fix this issue or whatever. And so it’s just really useful to be able to control it
from your phone. And this kind of proves this experience. I don’t know if this necessarily
makes sense for every kind of use case for coding. I think starting local is right. I don’t
know if this is true for everything though.
Got it. What are the slash commands you guys use?
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

8/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Cat Wu
Slash PR commit.
Dan Shipper
Yeah.
Cat Wu
Yeah, it’s—I think the PR commit slash command makes it a lot faster for Claude to know
exactly what bash commands to run in order to make a commit.
Dan Shipper
And what does the PR commit slash command do for people who aren’t familiar?
Cat Wu
Oh, it just tells it exactly how to make a commit. And you can, like dynamically, you can
say like, okay, these are the three bash commands that need to be run.
Boris Cherny
Got it. And what’s pretty cool is also we have this kind of templating system built into
slash commands. So we actually run the bash commands ahead of time. They’re embedded
into the slash command. And you can also pre-allow certain tool invocations. So for that
slash command, we say allow, you know, git commit, git push, gh pr, and so you don’t get
asked for permission after you run the slash command, because we have a permissionbased security system.
And then also it uses Haiku, which is pretty cool. So it’s kind of a cheaper model and faster.
Yeah. And for me, I use commit, PR, feature dev. So Sid created this one. It’s kind of cool.
We kind of walk you through step by step building something. So we prompt Claude, like
first ask me what exactly I want, like build the specification, and then, you know, kind of
build a detailed plan and then make a to-do list, walk through step by step. So it’s kind of
more structured feature development. Yeah. And then I think the last one that we
probably use a lot, so we use security review for all of our PRs and then also code review.

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

9/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

So Claude does all of our code review internally at Anthropic. You know, there’s still a
human approving it, but Claude does kind of the first step in code review. That’s just a
slash code review slash command.
Got it. Yeah. What are the—
Dan Shipper
Things I would love to go deeper into—how do you make a good plan? So the sort of the
feature dev thing, because I think there’s a lot of little tricks that I’m starting to find or
people at Every are starting to find that work. And I’m curious, what are things that we’re
missing?
So for example, one unintuitive step of the plan development process is even if I don’t
exactly know what the thing that needs to be built is, I just have a little sentence in my
mind, like I want feature X, I have Claude just implement it without giving it anything
else. And I see what it does and that helps me understand like, okay, here’s actually what I
mean because it made all these different mistakes or it did something that I didn’t expect
that might be good. And then I use that, like learning from a sort of throwaway
development. I just clear it out and then that helps me write a better plan spec for the
actual feature development, which is something that you would never do before because
it’d be too expensive to just yolo send in an engineer on a feature that you hadn’t actually
specced out. But because you have Claude going through your code base and doing stuff,
you can learn stuff from it that helps inform the actual plan that you make.
Boris Cherny
Yeah. I feel maybe I can start and I’m curious how you use it too. I think there’s a few
different modes maybe for me. One is prototyping mode. So like traditional engineering,
prototyping. You want to kind of build the simplest possible thing that touches all the
systems, just so you can kind of get a vague sense of what the systems are, there’s
unknowns, and just to kind of trace through everything.
And so I do the exact same thing as you, Dan. Claude just does the thing and then I see
where it messes up, and then I’ll ask it to just throw it away and do it again. So just hit
escape twice, go back to the old checkpoint and then try again. I think there’s also maybe
two other kinds of tasks. So one is just things that Claude can one shot and I feel pretty
confident it can do it, so I’ll just tell it and then I’ll just go to a different tab and I’ll shift tab
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

10/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

to auto accept and then just go do something else or go to another one of my Claudes and
tend to that.
But also there’s this kind of harder feature development. So these are, you know, things
that maybe in the past would’ve taken like a few hours of engineering time. And for this,
usually I’ll shift tabs into plan mode and then align on the plan first before it even writes
any code. And I think what’s really hard about this is the boundary changes with every
model and in a surprising way, where the newer models, they’re more intelligent. So the
boundary of what you need plan mode for got pushed out a little bit. Like before you used
to need to plan, now you don’t. And I think this is a general trend of stuff that used to be
scaffolding with a more advanced model, it gets pushed into the model itself. Right. And
the model kind of tends to subsume everything over time.
Dan Shipper
Yeah. How do you think about building an agent harness that isn’t just going to—you’re
not spending a bunch of time building stuff that is just going to be subsumed into the
model in three months when the new Claude comes out. Like, how do you know what to
build vs. what to just say? It doesn’t work quite yet, but next time it’s going to work, so
we’re not going to spend time on it.
Cat Wu
Ooh. I think we build most things that we think would improve Claude Code’s capabilities,
even if that means we’ll have to get rid of it in three months. If anything, we hope that we
will get rid of it in three months. I think for now we just want to offer the most premium
experience possible. And so we’re not too worried about throwaway work.
Boris Cherny
Hmm. Interesting. Yeah. And an example of this is something like, even like plan mode
itself. I think we’ll probably unship it at some point when Claude can just figure out from
your intent that you probably want to plan first. Or you know, for example, I just deleted
like 2,000 tokens or something from the system prompt yesterday. Just because Sonnet
4.5 doesn’t need it anymore. But Opus 4.1 did need it.
Dan Shipper

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

11/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

What about, you know, in the case where the latest frontier model doesn’t need it. But you
know, you’re trying to figure out how to make it more efficient because you have so many
users that maybe you’re not going to use Opus or Sonnet 4.5 for everything. Maybe you’re
going to use Haiku. So there’s a trade-off between having a more elaborate harness for
Haiku vs. just not spending time on it, using Sonnet, eating the cost, and working on more
frontier type stuff.
Cat Wu
In general, we’ve positioned Claude Code to be a very premium offering. So our North
Star is making sure that it works incredibly well with the absolutely most powerful model
we have, which is Sonnet 4.5 right now. We are investigating how to make it work really
well for future generations of smaller models, but it’s not the top priority for us.
Dan Shipper
Okay. What do you think about, you know, one thing that I notice is we get models often,
and thank you very much for this. We get models a lot before they come out, and it’s our
job to kind of figure out is it any good? And over the last six months when I’m testing
Claude, for example, in the Claude app with a new frontier model, it’s actually very hard to
tell whether it’s how—whether it’s better immediately. But it’s really easy to tell in Claude
Code because the harness matters a lot for the performance that you get out of the model.
And you guys have the benefit of building Claude Code inside of Anthropic. So there’s a
much tighter integration between the fundamental model training and the harness that
you’re building. And they seem to kind of really impact each other. So how does that work
internally and what are the benefits you get from having that tight integration?

(00:20:00)
Boris Cherny
Yeah, I think probably either one of us could take this. I think the biggest thing is
researchers just use this and so, you know, as they see what’s working and what’s not, they
can improve stuff. We do a lot of evals and things like that to kind of communicate back
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

12/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

and forth and understand where exactly the model’s at. But yeah, there’s this frontier
where you need to give the model a hard enough task to really push the limit of the model.
And if you don’t do this, then all models are kind of equal. But if you give it a pretty hard
task, you can tell the difference.
Dan Shipper
What subagent do you use?
Boris Cherny
I have a few. I have a planner subagent that I use. I have a code review subagent. Code
review is actually something where sometimes I use a subagent. Sometimes I use a slash
command. So usually in CI it’s a slash command. But in synchronous use, I use a subagent
for the same thing.
Um, why?
That’s a good question. Yeah. Maybe it’s like a matter of taste. Yeah. I don’t know. I think
it’s maybe when you’re running synchronously, it’s kind of nice to fork off the context
window a little bit because all the stuff that’s going on in the code review, it’s not relevant
to what I’m doing next, but in CI it just doesn’t matter.
Dan Shipper
Are you ever spawning like 10 subagents at once and for what?
Boris Cherny
For me, I do it mostly for big migrations. That’s like the big thing. Actually we have this
code slash command that we use, there’s a bunch of subagents there and so one of the steps
is find all the issues and so there’s one subagent that’s checking for Claude MD compliance.
There’s another subagent that’s looking through git history to see what’s going on.
Another subagent that’s looking for kind of obvious bugs. And then we do this kind of
deduping quality step after. So they find a bunch of stuff. A lot of these are false positives.
And so then we spawn like five more subagents and these are all just like checking for false
positives. And in the end, the result is awesome. It finds all the real issues without the false
issues.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

13/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Dan Shipper
That’s great. I actually do that. So one of my non-technical Claude Code use cases is
expense filing. So like when I’m in SF right now, I have all these expenses and so I built this
little Claude project in Claude Code that uses one of these, you know, finance APIs to just
download all my credit card transactions. And then it decides like, these are probably the
expenses that I’m going to have to file. And then I have two subagents, one that represents
me and one that represents the company. And they do battle to figure out what’s the
proper actual set of expenses. It’s like an auditor subagent and a pro-Dan subagent. So,
yeah, that kind of thing. The sort of opponent processor pattern seems to be an interesting
one.
Boris Cherny
Yeah. Yeah. It’s cool. I feel like when subagents were first becoming a thing, actually what
inspired us, there’s a Reddit thread a while back where someone made subagents for—
there was a front end dev and a back end dev, and like a—I think it was like a designer,
testing dev—
Cat Wu
Testing dev.
Boris Cherny
Testing dev. There was a PM subagent. And this is, you know, it’s cute. It feels a little,
maybe too anthropomorphic. Maybe there’s something to this, but I think the value is
actually the uncorrelated context windows where you have these two context windows that
don’t know about each other. And this is kind of interesting. And you tend to get better
results this way.
What about you? Do you have any interesting subagents you use?
Cat Wu
So I’ve been tinkering with one that is really good at front end testing. So it uses
Playwright to see, all right, what are all the errors that are on this site and pull them in and
try to test more steps of the app. It’s not totally there yet, but I’m seeing signs of life and I
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

14/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

think it’s the kind of thing that we could potentially bundle in one of our plugin
marketplaces.
Dan Shipper
Yeah. Definitely I’ve used something like that just with Puppeteer and just like watching it
build something and then open up the browser and then be like, oh, I need to change this.
It’s like, oh my God. Yeah, it’s really cool.
Boris Cherny
It’s really cool. I think we’re starting to see the beginnings of this massive multi—massive
subagent. I don’t know what to call this, like swarms or something like that. There’s a
bunch of people, there’s actually an increasing number of people internally at Anthropic
that are using a lot of credits every month. Like, you know, spending like over a thousand
bucks every month. And this percent of people was growing actually pretty fast. And I
think the common use case is code migration. And so what they’re doing is framework A
to framework B. There’s the main agent, it makes a big to-do list for everything and then
just kind of map reduces over a bunch of subagents. So you instruct Claude like, yeah, start
10 agents and then just go like, you know, 10 at a time and just migrate all the stuff over.
Dan Shipper
That’s interesting. What would be a concrete example of the kind of migration that you’re
talking about?
Boris Cherny
I think the most classic is lint rules. So there’s, you know, there’s some kind of lint rule
you’re rolling out, there’s no auto fixer because it’s like, you know, static analysis can’t
really—it’s kind of too simplistic for it. I think other stuff is framework migrations. Like,
we just migrated from one testing framework to a different one. That’s a pretty common
one where it’s super easy to verify the output. Yeah.
Dan Shipper
One of the things that I found is, and this is both for projects inside of Every and then just
open source projects—it’s like if you’re someone building a product and you want to build
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

15/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

a feature that’s been done before. So maybe an example that people might need to
implement a bunch is memory. How do you memorize? Because we have a bunch of
different products internally, you can just spawn Claude subagents to be like, how do these
three other products do it? And there’s a possibility for just tacit code sharing where you
don’t need to have an API or you don’t need to ask anyone. You can just be like, how do we
do this already? And then use the best practices to build your own. And you can also do
that with open source because there’s tons of open source projects where people have been
working on memory for a year and it’s really, really good. And you can be like, what are the
patterns that people have figured out? And which ones do I want to implement?
Cat Wu
Totally. You can also connect your version control system. If you’ve built a similar feature
in the past, Claude Code can use those APIs, query GitHub directly and find how people
implemented a similar feature in the past and read that code and copy the relevant parts.
Yeah.
Dan Shipper
Is there—have you found any use for log files of, okay, you know, here’s the full history of
how I implemented it and is that important to give to Claude? And how are you
implementing that or making it useful for it?
Cat Wu
Some people swear by it. There are some people at Anthropic where for every task they do,
they tell Claude Code to write a diary entry in a specific format. Yeah. That just documents
what it does?
What did it try? Why didn’t it work? Yeah. And then they even have these agents that look
over the past memory and synthesize it into observations. I think this is the starting
budding—there’s something interesting here that we could productize. But it’s a new
emerging pattern that we’re seeing that works well. Yeah. I think the hard thing about
shooting memory from just one transcript is that it’s hard to know how relevant a specific
instruction is to all future tasks. Right? Like our canonical example is if I say make the
button pink, I don’t want you to remember to make all buttons pink in the future. And so I
think synthesizing the memory from a lot of logs is a way to find these patterns more
consistently.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

16/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Dan Shipper
It seems like you probably need—there’s some things where you’re going to know, you’ll
be able to summarize in this sort of top-down way like, this will be useful later. And you’ll
know the right level of abstraction at which it might be useful. But then there’s also a lot of
stuff where it’s like you actually, you know, any given commit log, make the button pink. It
could be useful for kind of an infinite number of different reasons that you’re not going to
know beforehand. So you also need the model to be able to look up all similar past
commits and surface that at the right time. Is that something that you’re also thinking
about?
Boris Cherny
Yeah, I think there could be something like that. And maybe, I think one way to see it is
this kind of traditional memory storage work. Like Memex kind of stuff where you just
want to put all the information into the system and then it’s kind of a retrieval problem
after that. I think as the model also gets smarter, it naturally—I’ve seen it start to naturally
do this also with Sonnet 4.5, where if it’s stuck on something, it’ll just naturally start
looking, like we talked about before, using bash spontaneously to just look through git
history and be like, oh, okay, yeah, this is kind of an interesting way to do it.
Dan Shipper
Yeah. One of the things that we were talking about before we started recording—one of
the things that we’re doing inside of Every, I feel like it has really changed the way that we
do engineering because everyone is Claude Code pilled, CLI pilled. And we have this
engineering paradigm that we call compounding engineering where in normal
engineering, every feature you add, it makes it harder to add the next feature. And in
compounding engineering, your goal is to make the next feature easier to build from the
feature that you just added. And the way that we do that is we try to codify all the learnings
from everything that we’ve done to build the feature. So like, you know, how did we make
the plan and what parts of the plan needed to be changed? Or when we started testing it,
what issues did we find? What are the things that we missed? And then we codify them
back into all the prompts and all the subagents and all the slash commands so that the next
time when someone does something like this, it catches it. And that makes it easier. And
that’s why for me, for example, I can hop into one of our code bases and start being
productive even though I don’t know anything about how the code works because we have
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

17/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

this built up memory system of all the stuff that we’ve learned as we’ve implemented stuff,
but we’ve had to build that ourselves. I’m curious, are you working on that kind of loop so
that Claude Code does that automatically?
(00:30:00)
Boris Cherny
Yeah, we’re starting to think about it. It’s funny, we heard the same thing from Fiona. She
just joined the team and, you know, she’s our manager. She hasn’t coded in like 10 years,
something like that. And she was shipping PRs on her first day. And she was like, yeah, not
only did I kind of—I forgot how to code and Claude Code kind of made it super easy to
just get back into it. Yeah. But also I didn’t need to ramp up on any context because I kind
of knew all this. And I think a lot of it is about when people put up pull requests for Claude
Code itself, and I think our customers tell us that they do similar stuff pretty often—if you
see a mistake, I’ll just be like, at Claude, add this to Claude MD so that the next time it just
knows this automatically. And you can kind of instill this memory in a variety of ways. So
you can say at Claude, add it to Claude MD. You can also say to Claude, write a test. You
know, that’s an easy way to make sure this doesn’t regress. And I don’t feel bad asking
anyone to write tests anymore. Right? It’s just super easy and I think probably close to 100
percent of our tests are just written by Claude. And if they’re bad we just won’t commit it.
And then the good ones stay committed.
And then also I think lint rules are a big one. So for stuff that’s enforced pretty often, we
actually have a bunch of internal lint rules. Claude writes 100 percent of these. And this is
mostly just Claude in a PR, right? Write this lint rule. And yeah. There’s sort of this
problem right now about how do you do this automatically? And I think generally how
Cat and I think about it is we see this power user behavior. And the first step is how do you
enable that by making the product hackable. So the best users can figure out how to do this
cool new thing. Right? But then really the hard work starts of how do you take this and
bring it to everyone else? Yeah. And for me, I count myself in the everyone else bucket.
Like, you know, I don’t really know how to use Vim. I don’t have this crazy setup. So I have
a pretty vanilla setup. So if you can make a feature that I’ll use, it’s a pretty good indicator
that other kinds of average engineers will use it.
Dan Shipper

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

18/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

That is interesting. Tell me about that, because that’s something I think about all the time
—making something that is extensible and flexible enough that power users can find novel
ways to use it that you would not have even dreamed of. But it’s also simple enough that
anyone can use it and they can be productive with it. And you can kind of pull what the
power users find back into the basic experience. How do you think about making those
design and product decisions so that you enable that?
Cat Wu
In general, we think that every engineering environment is a little bit different from the
others. And so it’s really important that every part of our system is extensible. So
everything from your status line to adding your own slash commands through to hooks,
which let you insert a bit of determinism at pretty much any step in Claude Code. So we
think these are the basic building blocks that we give to every engineer that they can play
with.
For plugins—plugins is actually our—so it was built by Daisy on our team, and this is our
attempt to make it a lot easier for the average user like us to bring these slash commands
and hooks into our workflows. And so what plugins does is it lets you browse existing
MCP servers, existing hooks, existing plugins—or sorry, existing slash commands—and
just let you write one command in Claude Code to pull that in for yourself.
Boris Cherny
Hmm. There’s this really old idea in a product called latent demand. Which I think is
probably the main way that I personally think about product and thinking about what to
build next. And it is, it’s a super simple idea. It’s you build a product in a way that is
hackable, that is kind of open-ended enough that people can abuse it for other use cases it
wasn’t really designed for. Then you see how people abuse it and then you build for that
because you kind of know there’s demand for it.
And like, you know, when I was at Meta, this is how we built all the big products. I think
almost every single big product had this nugget of latent demand in it. You know, like for
example, something like Facebook Dating, it came from this idea that when we looked at
who looks at people’s profiles, I think 60 percent of views were between people of opposite
gender—so kind of traditional setup—that were not friends with each other. And so we’re
like, oh man, okay. Maybe there’s—maybe if we launch a dating product, we can kind of
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

19/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

harness this demand that exists. That’s interesting. And for, you know, Marketplace, it was
pretty similar. I think it was like 40 percent of posts in Facebook groups at the time were
buy-sell posts. And so we’re like, okay, people are trying to use this product by itself. We
just build a product around it that’s probably going to work. And so we think about it kind
of similarly, but also we have the luxury of building for developers. And developers love
hacking stuff, and they love customizing stuff. And it’s like, as a user of our own product, it
makes it so fun to build and use this thing.
And so, yeah. Like I said, we just built the right extension points. We see how people use it,
and that kind of tells us what to build next.
Cat Wu
Like for example, we got all these user requests where people were like, Claude Code is
asking me for all these permissions and I’m out here getting coffee. I don’t know if it’s
asking me for permission. How can I just get it to ping me on Slack? And so we built hooks
—Dixon built hooks—so that people could get pinged on Slack and you could get pinged
on Slack for anything that you want to get pinged on Slack for. So it was very much like
people really wanted the ability to do something. We didn’t want to build the integration
ourselves, and so we exposed hooks for people to do that.
Dan Shipper
The thing that makes me think of is you recently released—you kind of moved or
rebranded how you talk about Claude Code to be this more general purpose agent SDK.
Was that driven by some latent demand where you sort of saw there’s a more general
purpose use case for what you built?
Cat Wu
We realized that similar to how you were talking about using Claude Code for things
outside of coding, we saw this happen a lot. Like, we get a ton of stories of people who are
using Claude Code to help them write a blog and manage all the data inputs and take a first
pass in their own tone. We find people building email assistants on this. I use it for a lot of
just market research because at the core it’s an agent that can just go on for an infinite
amount of time, as long as you give it a concrete task, and it’s able to fetch the right
underlying data. So one of the things I was working on was I wanted to look at all the
companies in the world and how many engineers they had and to create a ranking. And
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

20/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

this is something that Claude Code can do, even though it’s not a traditional coding use
case. So you realize that the underlying primitives were really general as long as you have
an agent loop that can continue running for a long period of time and you’re able to access
the internet and write code and run code, pretty much you can—if you squint, you can
kind of build anything on it.
Boris Cherny
And I think by the point where we rebranded it from the Claude Code SDK to the Claude
Agent SDK, there were already many thousands of companies using this thing. And a lot
of those use cases were not about coding. So it’s like both internally and externally we kind
of saw that. Yeah, it was—
Cat Wu
Like health assistants, financial analysts, legal assistants. It was pretty broad.Retry
Boris Cherny
Yeah. What are the coolest ones? I feel like actually you had Noah Breyer on the podcast
recently. I thought the Obsidian kind of mind mapping note keeping use cases—that’s so
cool. It’s funny, it’s insane how many people use it for this. Yeah. This particular
combination. I think some other, like some coding or kind of coding adjacent use cases
that are kind of cool is we have this issue tracker for Claude Code. The team’s just
constantly underwater, trying to keep up with all the issues coming in. There’s just so
many and so Claude dedupes the issues and it automatically finds duplicates and it’s
extremely good at it. It also does first pass resolution, so usually when there’s an issue it’ll
proactively put up a PR internally. And this is a new thing that Ingo on the team built. So
this is pretty cool. There’s also on-call and kind of collecting signals from other places, like
getting Sentry logs and getting logs from queues and kind of collating all this. It’s really
good at doing this because it’s all just bash in the end. Right. And so these are all kinds of
these internal use cases that I saw.
Is it—
Dan Shipper

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

21/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

So when it’s collating logs or deduping issues, is that like you have Claude continually
running in the background and is that something that you’re building for?
Cat Wu
It gets triggered for that particular one. It gets triggered whenever a new issue is filed.
Okay. So it runs once. But it can choose to run for as long as it needs.
Dan Shipper
Got it. What about the idea of Claude always running?
Cat Wu
Ooh, proactive Claude? I think it’s definitely where we want to get to. I would say right
now we’re very focused on making Claude Code incredibly reliable for individual tasks.
And you know, if you think about multi-line auto complete and then single turn agents,
and then now we’re working on Claude Code that can complete tasks. I feel like if you trace
this curve, eventually you go to even higher levels of abstraction, like even more
complicated tasks, and then hopefully the next step after that is a lot more proactivity,
right? So just understanding what your team’s goals are, what your goals are, being able to
say, hey, I think you probably want to try this feature. And here’s a first pass at the code
and here are the assumptions I made. And are these correct?
Dan Shipper
I can’t wait. And I think probably right after that Claude is now your manager. That’s not
on the plan. So everyone on the team was super excited that we were talking today and
they gave me a bunch of questions and I want to make sure I hit all of the questions. Oh,
here’s a good one. Why did you choose agentic RAG over vector search in your
architecture and are vector embeddings still relevant?
(00:40:00)
Cat Wu
So actually initially we did use vector embeddings. They’re just really tricky to maintain
because you have to continuously re-index the code and they might get out of date and you
have local changes. So those need to make it in. And then as we thought about, what does
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

22/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

it feel like for an external enterprise to adopt it, we realized that this exposes a lot more
surface area and security risk. We also found that actually Claude is really good and Claude
models are really good at agentic search. So you can get to the same accuracy level with
agentic search and it’s just a much cleaner deployment story.
Dan Shipper
Hmm. That’s really interesting.
Cat Wu
If you do want to bring semantic search to Claude Code, you can do so via an MCP tool. So
if you want to manage your own index and expose an MCP tool that lets Claude Code call
that, that would work.
Dan Shipper
Hmm. What do you think are the top MCPs to use with Claude Code?
Cat Wu
Ooh. Puppeteer and Playwright are pretty high up there. Definitely. Yeah. Sentry has a
really good one. Asana has a really good one.
Dan Shipper
Hmm. Do you think that there are any power user tips that you see people inside of
Anthropic or, you know, other people who are big Claude Code power users that people
don’t know about that they should?
Cat Wu
One thing that Claude doesn’t naturally like to do, but that I personally find very useful is
Claude doesn’t naturally like to ask questions, but you know, if you’re brainstorming with
a thought partner, a collaborator, usually you do ask questions back and forth to each
other. And so this is one of the things that I like to do, especially in plan mode. I’ll just tell
Claude Code, hey, we’re just brainstorming this thing. Please ask me questions. If there’s
anything you’re unsure about, I want you to ask questions and it’ll do it. And I think that
actually helps you arrive at a better answer.
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

23/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Boris Cherny
Hmm. There’s also so many tips that we can share. I think there’s a few really common
mistakes I see people make. One is not using plan mode enough. This is just super
important and I think this is people that are kind of new to agent coding, they kind of
assume this thing can do anything and it can’t. It’s not that good today and it’s going to get
better. But today it can one shot some tasks, it can’t one shot most things. And so you kind
of have to understand the limits and you have to understand where you get in the loop.
And so something like plan mode, it can like two, three X success rates pretty easily if you
align on the plan first.
Other stuff that I’ve seen power users do really well is companies that have really big
deployments of Claude Code—and now, you know, luckily there’s a lot of these companies
so we can kind of learn from them. Having settings.json that you check into the code base
is really important because you can use this to pre-allow certain commands so you don’t
get permission prompted every time. And also to block certain commands, let’s say you
don’t want to touch or whatever. And this way as an engineer, I don’t get prompted and I
can check this in and share it with the whole team so everyone gets to use it.
I get around that by just using a dangerous key to skip permissions.
Yeah. We kind of have this here, but we don’t, you know, we don’t recommend it. It’s like
it’s a model, you know? It can do weird stuff.
I think another kind of cool use case that we’ve seen is people using stop hooks for
interesting stuff. So the stop hook runs whenever the turn is complete. So Claude’s done
some tool calls back and forth with, you know, whatever. And it’s done and it returns
control back to the user. Then we run the stop hook. And so you can define a stop hook
that’s like, if the tests don’t pass, keep going. Essentially it’s like you can just make the
model keep going until the thing is done. And this is just insane when you combine it with
the SDK and this kind of programmatic usage. Yeah, you can, you know, this is a stochastic
thing, it’s a non-deterministic thing, but with scaffolding you can get these deterministic
outcomes.
Dan Shipper
So you guys started this sort of CLI, this CLI paradigm shift. Do you think the CLI is the
final form factor? Are we going to be using Claude Code in the CLI primarily in a year or in
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

24/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

three years, or is there something else that’s better?
Cat Wu
I mean, it’s not the final form factor, but we are very focused on making sure the CLI is the
most intelligent that we can make, and that’s as customizable as possible. You can talk
about the next form factors.
Boris Cherny
Yeah, I mean, Cat’s asking me to talk about it because no one knows this. This stuff ’s just
moving so fast, right? No one knows what these form factors are. Like right now I think
our team is in experimentation mode. So we have CLI, then we came out with an IDE
extension. Now we have a new IDE extension that’s a GUI. It’s a little more accessible. We
have Claude on GitHub, so you can just add Claude anywhere. Now there’s Claude, there’s
Claude on the web and on mobile. So you can use it in any of these places. And we’re just in
experimentation mode, so we’re trying to figure out what’s next.
I think if we kind of zoom out and see where this stuff is headed, I think one of the big
trends is longer periods of autonomy. And so with every model we kind of time how long
can the model just keep going and do tasks autonomously and just, you know, in
dangerous mode in a container, keep auto-accepting until the task is done. And now we’re
on the order of like double digit hours. I think the last model is like 30 hours, something
like this. And, you know, the next model is going to be days. And as you think about kind
of parallelizing models, there’s kind of a bunch of problems that come out of this. So one is
what is the container this thing runs in, because you don’t want to have to close your
laptop.
I have that right now because I’m doing a lot of—I don’t know, I’ve only heard, I’ve only
read it, but DSPY or DSPY prompt optimization and it’s on my laptop and it’s like, I don’t
want to close. I’m in Waymo with my laptop open because I’m like, I don’t want to close it.
Boris Cherny
Uh, yeah, that’s right. Yeah. We’ve visited companies before. For customers, everyone’s
just walking around with their Claude Code running. So I think one is kind of getting away
from this mode. And then I also think pretty soon we’re going to be in this mode of
Claudes monitoring Claudes. Yeah. And kind of, I don’t know what the right form factor
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

25/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

for this is because as a human, you need to be able to inspect this and kind of see what’s
going on. But also it needs to be Claude optimized where you’re optimizing for kind of
bandwidth between the Claude to Claude communication.
So my prediction is that the terminal is not the final form factor. My prediction is there’s
going to be a few more form factors in the coming months, you know, maybe a year or
something like that. And it’s going to keep changing very quickly.
Dan Shipper
What do you think about, you know, I teach a lot of Claude Code to a lot of Every
subscribers and—thank you. You’re welcome. Doing your work for you. And I think one
of the big things is that the terminal is intimidating. And just being on a call with the
subscribers being like, here’s how you open the terminal and you’re allowed to do this even
if you’re non-technical, is a big deal. What do you think about that?
Cat Wu
Yeah, one of the people on our marketing team started using Claude Code because she was
writing some content that touched on Claude Code and I was like, you should really
experience it. And she got like 30 popups on her screen where she had to accept various
permissions because she’d never used a terminal before. Yeah. So I completely see eye to
eye with you on that. It’s definitely hard for non-engineers and there’s even some
engineers we found who aren’t fully comfortable with working day to day in the terminal.
Our VS Code GUI extension is our first step in that direction because you don’t have to
think about the terminal at all. It’s like a traditional interface with a bunch of buttons. I
think we are working on more graphical interfaces. Claude Code on the web is a GUI. I
think that actually might be a good starting point for people who are less technical. Yeah.
Boris Cherny
Yeah, there was this magic moment, maybe a few months ago where I walked into the
office and some of the data scientists at Anthropic—they sat right next to the Claude Code
team—and the data scientists just had Claude Code running on their computers. And I
was like, what, what is this? How did you figure this out? I think it was Brandon who was
the first one to do it. And he was like, oh yeah, I just installed it. I work on this product, so
I should use it. And I was like, oh my God. So he figured out how to use a terminal and git
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

26/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

and, you know, he hasn’t really done this kind of workflow before, obviously very
technical.
So I think now we’re starting to see all these kinds of code adjacent functions, people use
Claude Code and, yeah, it’s kind of interesting from a latent demand point of view, these
are people hacking the product. So there’s demand to use it for this. And so we want to
make it a little bit easier with more accessible interfaces. But at the same time, for us, for
Claude Code, we’re laser focused on building the best product for the best engineers. And
so we’re focused on software engineering and we want to make this really good, but we
want to make it a thing that other people can hack.
Dan Shipper
I love it. Well thank you. This was amazing. I’m really glad I got to talk to you and keep
building.
Cat Wu
Thank you for having us.
Dan Shipper
Yeah, thanks.

Thanks to Scott Nover for editorial support.
Dan Shipper is the cofounder and CEO of Every, where he writes the Chain of Thought column and
hosts the podcast AI & I. You can follow him on X at @danshipper and on LinkedIn, and Every on
X at @every and on LinkedIn.
We build AI tools for readers. Write brilliantly with Spiral. Organize files automatically with
Sparkle. Deliver yourself from email with Cora. Dictate effortlessly with Monologue.

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

27/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

We also do AI training, adoption, and innovation for companies. Work with us to bring AI into your
organization.
Get paid for sharing Every with your friends. Join our referral program.

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

Prompts and use cases for builders

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

Spiral: Repurpose your content endlessly

28/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'
Monologue: Effortless voice dictation for your Mac

RELATED ESSAYS

What Jhana Meditation
Can Teach Us About LLMs
Author Nadia Asparouhova on why AI
isn't as different from us as we think

17 May 7, 2025
RHEA PUROHIT

How to Use Claude Code
Like the People Who Built It
Anthropic’s Cat Wu and Boris Cherny explain how
they use Claude Code inside the company—and
what they’ve learned about getting the most out of it

23 Oct 29, 2025
RHEA PUROHIT

He’s Building AI for the
Person You Want to Become
Former Stripe and Google exec Alex
Komoroske on designing technology that
goes beyond what you want right now

20 1 Jul 9, 2025
RHEA PUROHIT

Comments
https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

29/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

Write a comment
Post
Write a comment
Post

You need to login before you can comment.
Don't have an account? Sign up!

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

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

30/31

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code Like the People Who Built It'

FAQ

Terms

Site map

©2026 Every Media, Inc.

https://every.to/podcast/transcript-how-to-use-claude-code-like-the-people-who-built-it

31/31

