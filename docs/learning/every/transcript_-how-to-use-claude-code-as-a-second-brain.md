2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Roman Popenov

AI & I

Transcript: ‘How to Use Claude Code as a
Second Brain’
'AI & I' with Alephic cofounder Noah Brier
DAN SHIPPER

September 10, 2025 · Updated February 6, 2026

Listen

7

The transcript of AI & I with Noah Brier is below. Watch on X or YouTube, or listen on
Spotify or Apple Podcasts.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

1/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Timestamps
1. Introduction: 00:01:19
2. How you can do deep work on your phone: 00:04:28
3. Why Noah thinks Grok has the best voice AI: 00:06:14
4. The nuts and bolts of Noah’s Claude Code-Obsidian setup: 00:11:39
5. Using an agent in Claude Code as a “thinking partner”: 00:23:59
6. Noah’s Thomas’ English Muffin theory of AI: 00:35:07
7. The white space still left to explore in AI: 00:44:04
8. How Noah is preparing his kids for AI: 00:50:41
9. How he brought his Claude Code setup to mobile: 01:01:54

Transcript
(00:00:00)
Dan Shipper
Noah, welcome to the show.
Noah Brier
Thanks for having me.
Dan Shipper
I'm excited to have you. It's really good to get to chat. This is our first interview in
probably five years. For people who don't know, you were one of the first Superorganizers
interviewees. That was the newsletter that turned into Every, and I love the way that your
brain works. You have this really interesting taste for tools for thought, and back in the
day, you were using Evernote in all these really interesting ways. You were the co-founder
of a really cool startup called Percolate and then another one called Variance and now
you're running Alpehic, which is an AI strategy consultancy.
And I'm just really excited to see how your mind has started to use these AI tools now that
they're working so well. And I know you have some pretty cool Claude Code stuff to show
us. So yeah, thanks for coming on.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

2/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Noah Brier
Thanks for having me. Yeah, I'm super excited. That was a fun interview all those years
back.
Dan Shipper
It was really, really fun. So, I want to just dive right into the thing that I think is so cool
about what you're doing. So I know you have a whole vibe coding setup that you've built
for yourself. Can you talk us through that?
Noah Brier
Yeah, I'm not sure about actually the vibe coding part of it. I have a sort of fairly heavy
duty Claude Code set up but actually mostly not for code. Since those days of
Superorganizers, like many people, I've abandoned Evernote and switched over to
Obsidian. And one of the big advantages with Obsidian as a note taking platform is that
it's a bunch of Markdown files and a bunch of folders. And they can then be synced with
Git and you can do lots of other fun kinds of things. And so, actually probably my number
one Claude Code use is using it as a tool to interact with my notes. So, I've got a fairly
serious Claude Code setup that I use with Obsidian. And my most recent obsession has
been standing up a server in my house so that I could also use Claude Code on my phone.
Dan Shipper
This is incredible. I want to go through all of this. So where should we start? Should we do
how you use Claude Code as sort of this research assistant notes organizer, note taker
thing? Or should we start with how you use it on your phone?
Noah Brier
We can start with just the general part of it. That might be the easiest—the phone is really
just an extension of that same thing. I would say, generally, and this is something I feel like
not enough people talk about with AI, one of the things I find really extraordinary about it
is the ability for me to work really productively on my phone. That's been a huge change
because so much of what I do is writing or coding, and the phone is definitely not the best
place for that.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

3/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

You know, even the phone wasn't always the best place for doing research and thinking. I
felt like my computer was a better place for it, which is why I've been such a note taker.
And I have found whether it's Claude Code and Obsidian or even Claude Code. So the
other piece of it is being able to then, if you see something go wrong, sign in on your phone
and have Claude Code push a small update to something because you just realize it while
you're out.
Dan Shipper
That's amazing.
Noah Brier
But then even I use quite a bit of Grok voice mode, and I find that as an alternative way of
working through problems. I have a Tesla, so now it's baked into the Tesla. And obviously
all the other ChatGPT and Claude and all these things—just being able to go and do
research and really think and explore things in this device that's always been useful, but
not useful for deep work. I think most people would agree that the phone has not been the
best place to do deep coding and research work. And I feel like it's really changed my
ability to do that.
Dan Shipper
Wait, I’ve got to stop you. So you're using Grok voice mode, and is that specifically because
it's built into your Tesla or are you using it in situations where you could also use, for
example, ChatGPT voice mode?
Noah Brier
No, I'm using it because it's way better than any of the other voice modes, and I will fight
anybody who says anything different.
Dan Shipper
Okay, tell me. What do you like about it? Why is it better?
Noah Brier

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

4/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

To be fair, OpenAI launched their real-time API, which may or may not be baked into
ChatGPT voice now—it's not totally clear. But the old voice mode was based on 4o and I
just found it to be completely unusable. And Gemini's voice mode I just didn't find to be
smart enough.
I just found Grok's voice mode to be significantly smarter than anybody else's. I'm using
Grok-2, I don't even remember whatever the latest one is. I don't have the most expensive
account, I don't have super heavy—but I just find it to be much better. It does tool calling
way better than any of the other ones. That's what I found to be a major weakness of the
voice models - they don't do great tool calling and research. And Grok seems to have
solved that.
So even before it was loaded in my Tesla, I dropped my daughter off at summer camp this
summer up in New Hampshire. So I had a five-hour drive on my own and I spent like two
hours researching and essentially working through a piece. I did it by just connecting it to
Bluetooth and sitting there in the car. And I found it to be by far the best of the voice
modes. I hope these other models catch up because I would love more really good voice
modes.
I had a mind-blowing session this weekend where I have a conference coming up on
September 18, and I'm giving a talk. I sort of have some ideas. I think it's generally going to
be about transformers eating the world. So I was sort of catching myself up on selfattention and exactly how it works. I did like an hour session and it really was by far the
best explanation I've ever read for it, or ever heard, I guess. So yeah, I've just found it to be
a pretty extraordinary product.
Dan Shipper
I do love voice mode for that. It's sort of like a podcast made specifically for you about
whatever you're curious about, and that's really cool. I went upstate this weekend and I've
been reading the Iliad. So I had it on audiobook and then I had some questions as I was
driving. And so I unfortunately used ChatGPT voice mode because I didn't know about
Grok's voice mode. I wish we had had this conversation before then, but the thing about
ChatGPT voice mode is—yeah, I think when it first came out, it was cool, but it just hasn't
gotten as smart as the models are. And they gave it this new personality that I had to get
used to where every time you ask it a question, it goes like, oh yeah, uh-huh, well, you
know, and it's just this weird Gen Z thing that feels like it has a little bit too much ennui or
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

5/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

something—like it doesn't actually care about you. I don't know what that is. So I had to
get used to that.
Noah Brier
Grok has a stoner mode, for what it's worth. I will say the car version is very interesting to
me. This was in the most recent Tesla release like a couple weeks ago. You know, I had been
doing that same thing you did where you just plug your phone in and you put it on
Bluetooth and do your best to make it work. And it's very interesting to just have a voice
AI button—it syncs back to your regular Grok, but you can't rejoin old chats. So it's just
like, hey, it's just like—but you know, I mean these things are significantly better than Siri
and all of these other things. And particularly, there's no comparison if you actually have
something more than just a single question you want an answer to. If you actually want to
have a conversation about the Iliad or about transformers and self-attention—I don't
know, it's pretty amazing to just be able to hit this button and use that car time.
I was on my way somewhere last week and I was having it research—I was going back to
Walter Benjamin. I have this idea to write a piece about how the reactions to every new
technology are essentially elitist critiques of it. It's always like, "Oh no, everybody's gonna
be able to do this thing that only we used to be able to do." So I was in the car and I was
thinking about this, and I had it go and I was like, okay, you know, it's been years since I
read the Walter Benjamin mass production of images one. So yeah, then I'm having a
conversation about that and I'm like, who are Walter Benjamin's contemporaries? And
then I'm into all these—you know, it's just like, I don't know, it’s amazing.
Dan Shipper
It’s the best. Okay, so you're filling your brain with all these things from voice mode, which
I love. But tell us about your second brain setup—or I don't know how you refer to it,
whether you think that second brain is appropriate for this—but I want to know how
you're using Claude Code to take notes and do research and all that kind of stuff.
(00:10:00)
Noah Brier
Yeah, so I could just open it up. Maybe that's the easiest thing. I'll walk you through it. I'll
start on my computer and then we can do the phone. The computer's just way easier to
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

6/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

share here.
So alright, this is what I was working on before. But essentially, you know, this is just
Claude Code and it's just sitting on top of my Obsidian. So if I jump out here and I just do
like—you can see I'm following the PARA method. And I've just got everything organized
in here and put in the places that they need to be.
Dan Shipper
Well, let me just stop you. For people who are listening,we're looking at Claude Code. It
seems like you have Claude Code running in your Obsidian vault and there's some kind of
—it looks like it's adding something to an existing note. Is that what's going on? That's
what we're looking at?
Noah Brier
Yeah. So in this particular one, I'm working on this talk, so I'm putting on my conference
in two weeks. I'm giving this talk about marketing and AI and what's going on. If we sort of
jump back a second, I've been doing these conferences called brxnd.ai, and they're about
marketing and AI.
I did one in February in LA, and it was about this—I'm sure you've seen it—it was the
Office of Strategic Services, which was the precursor to the CIA, wrote this manual called
the Simple Sabotage Field Manual. And it was essentially a manual to help citizen
saboteurs in Nazi-occupied territories sort of quietly sabotage the Nazi occupation. So it
was like there's a whole bunch of stuff for blue-collar workers. It's like if you're a janitor,
you should leave a bucket of oily waste around and accidentally drop a cigarette in there so
that it will—but then there's this amazing set of recommendations for white-collar
workers and they're like, always refer things to committee. Always revisit previously made
decisions. Make sure that if somebody is trying to make a decision, you should suggest
that they don't act with too much haste, lest they be embarrassed.
And so my talk was about how one hope I have is that AI can kind of sidestep a lot of the
bureaucracy that exists inside large organizations because it has this goo-like effect where
it can kind of fit into any crevice or crack because it can act as this fuzzy interface and it
doesn't really care about the input-output.So the next part of the story is, after the
conference, I realized that manual was in the public domain. So I hired a designer and I
printed 300 copies and I wrote a new foreword for it. So we're giving this away at the
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

7/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

conference. And so my talk is trying to tie all these ideas together. I'm trying to pull from
the Sabotage manual, and then I was doing a bunch of research into Wild Bill Donovan,
who started the OSS. And the OSS was the precursor to both the CIA and the Special
Forces.
So anyway, I'm writing this talk and I've got a project inside my Obsidian, which is the
beginning of the research for this project. And I'm pulling in chats and articles and all
these things. And then I'm constantly talking to the AI in here and giving it new ideas. So
I'm like, oh, I need some conclusions. Here's my first thought on conclusions. And I'm
having it note down the conclusions, and then at the end of each day, I have the AI write up
the changes that I—sort of like the things I learned that day that are gonna help me push
this talk along.
So that's what you're looking at right here—this is all part of this work that I've been doing
where I've been feeding it. I was working on what are some of the conclusions I want it to
be. And so this is all sitting in my Obsidian inside of a project specifically for that talk.
Dan Shipper
Okay. So let me get a clearer sense of this. This is really interesting. So you have a project—
when you have a new thing, you're giving a talk, you make a new folder, and then as you're
thinking about stuff, you're working with Claude Code inside of the folder. And you're
researching stuff and then saying like, I want you to take notes on it.
In this particular case, you know that a component of your talk is the conclusions section,
and so there's one particular markdown file that you're just going back and forth with it
and having it add conclusions. But what else is in that folder? So is it like there's a body
note and then there's an intro note?
Noah Brier
So one of the big things here is that I'm in thinking mode, not writing mode yet. And so
there's some stuff in here where I've specifically told—I think it's in the front matter
actually—where I've told Claude Code like, don't help me write anything right now. And I
generally find this to be a big thing with all these models is like they immediately jump to
wanting to help you with the artifact. And you know, when you're just in thinking mode,
you have to be very explicit in like, hey, I just want you to help me think and ask me
questions.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

8/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

So yeah, what you can see here is like, there's a bunch of files in here. I've got “Chats”—
that's where I'm literally taking chats I'm having with other things and I'm just using the
Obsidian web clipper to pull the whole chat in. I've got “Daily Progress”—that's where I'm
having the AI actually look through all the notes that came out that day and help me think
through the progress. And then I've got “Research”—that's where I've got a bunch of
articles and PDFs and stuff that I've pulled in so far and been reading about. And then
there's a bunch of other random notes along here where I've been just using it to help me
think.
And so yeah, I was in the midst of—I've got this conclusion note. So I sort of felt like I had
blocked out the big themes of the talk, but I was like, “Okay, I need to figure out what am I
gonna say at the end?” And you know, essentially what I'm gonna say at the end is about a
lot of the stuff I've learned over the last few years of working with these large brands on AI
projects. So I was starting to get it to the conclusions. And so yeah, I'm just kind of piecing
all this stuff together right now. That's kind of what's happening.
Dan Shipper
And give me a sense of like, when this folder was empty, what did you start with?
Noah Brier
So I think I started with telling it like, I'm in thinking mode. I'm not in writing mode. Here
are my past few talks that I've given at Brxnd AI to give you a sense of the sort of style that
I have. And here's the kind of general idea and the big points I want to make. I'm giving
away this book. So I want to talk about Simple Sabotage Field Manual. And I have this
notion—I have this, it's kind of just a title—it's like Transformers are eating the world. It's
this idea that one of the very interesting things happening with these models is they're sort
of displacing a whole bunch of specialized code in places. And so I sort of want to talk
about that, and then I've got these conclusions.
And so the first thing I said was like, hey, just go look through all of the rest of my
probably 1,500 things in my Obsidian and go see anything else you can find that might be
of value to this talk, of the existing things I have. And so just go kind of pull those into the
research folder at the beginning to kind of jumpstart this process.
Dan Shipper
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

9/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Got it. And are you starting Claude in this folder or are you starting it in your full
Obsidian vault so that it can access all that stuff ?
Noah Brier
No, I'm starting it in the full Obsidian vault. So like if we—if I step out of here, right—
we're in the root directory. All this stuff is in the root directory of my Obsidian.
And my Obsidian setup is also a little more intense, for what it's worth, because I've also
realized you can add a package.json to add a bunch of custom code commands to your
Obsidian that you can then run. And then you could use those code commands and slash
commands and all of these other things. So there are a bunch of other moving pieces in
here, but generally it's fairly straightforward. I mean, I'm trying to use PARA and some
other bits and pieces.
Dan Shipper
So for people who are listening or watching and are like, we just went through a bunch of
stuff really fast—so the basic gist is Obsidian is just a note-taking app that runs all local.
And so everything that—all the notes you take—they exist in essentially text files on your
computer organized by folder.
And when you're starting Claude Code, one way to do it would be to start Claude Code in
the folder for the particular project that you have. But it sounds like what you're doing is
instead you're starting it in the root directory where all of your Obsidian notes live. And
the advantage of that is Claude Code has some sandboxing things where it's not really
supposed to run commands outside of the folder it was started in. It can run commands
inside of any subfolder, but it sounds like what you're doing—so it has access to your entire
Obsidian and it can do a bunch of stuff. And you've also added a package.json, which lets it
run custom software commands, basically. That's really interesting.
And do you find, because I've had this as a twinkle in my eye to have a go find relevant stuff
for me—do you find that it's actually relevant and interesting? Because I think sometimes
when I've done this kind of thing before with language models, they're like, oh yeah, this
random thing is relevant because X, Y, Z. Like, it doesn't feel like—I can understand why
it picked it as being relevant, but if it really knew who I am and what I think is interesting,
it definitely would not have. Do you find that that's the case or have you figured out a way
to make it relevant?
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

10/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

(00:20:00)
Noah Brier
I think by and large, yes, I agree with you. I think in this case relevance is a little simpler
since ultimately this talk is sort of—the things I was asking it to look for, I've done a bunch
of thinking and research around. So it's like I'm not asking it to make large conceptual
leaps to relevance. It's like, go find all this—like I want to talk about the Simple Sabotage
Field Manual. It can literally just do a find for all the times, all the articles and things I've
got in my Obsidian about that. And so relevance is kind of a loaded term, right? And I
agree with what you're saying. I think what I'm asking it to do is much more simple, which
is like amongst this set of things, go find all the notes that I've already researched that kind
of brought me to be thinking about these things to begin with.
Dan Shipper
Got it. And then once you had it do all that research, did you have it do any sort of
summary to sort of stimulate you to be like, okay, here are some jumping off points based
on what you've done before? What was your next step?
Noah Brier
So my next step is I actually have an agent in here, so if we go to—I'll continue for now.
Dan Shipper
So for people who are listening, you're just starting up Claude, you're using the continue
flag. So you're starting Claude by continuing the last session that you were in, and now
you've got—and Claude Code gives us the ability to do subagents. So those are like little
mini Claudes that you can spawn. And you have a, you have—
Noah Brier
I have a thinking partner.
Dan Shipper
Your thinking partner, sub agent, how does that work?

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

11/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Noah Brier
Yeah. And so this is the whole thing where I'm like, hey, you're a collaborative thinking
partner, specializing in helping people explore complex problems. Your role is to facilitate
thinking, and basically don't try to write the thing. And so after I had that initial set of
things, I flip to this and it's like, okay, let's get into a flow. Ask me the kinds of questions,
help me think through it.
You know, this is also where I've got a chats folder in here. So it's like, it's not just
happening here. I was also having—I've got a whole—sorry, I'm just backing out. So like, if
we go into chats, these are a whole bunch of the chats that I had.
Dan Shipper
Like with the interviewer?
Noah Brier
No, these are chats I was having with ChatGPT and Claude and Grok and all of these
different things that I went and just grabbed the full transcript of. So I was also having all
these other conversations and then I'm specifically telling the AI like, review all these other
things.
So actually, I think the first one—there's one of these conversations where I originally had
this idea about transformers are eating the world. And the notion there is like, there was
some research that came out, I think a few months ago, that they had found they were able
to sort of outperform some specialized time series modeling models with transformers.
And like, I think there's really interesting stuff. There's a story about Tesla removing
300,000 lines of code with a neural network. And I've just got these bits and pieces.
And one of the ways I work generally is like when I have an idea of something to write or
think about, I'll start a thread in ChatGPT or Claude. I'll then save that somewhere and
then I'll just keep coming back to it when I have more ideas. It's like, oh, here's another
example of transformers doing something. And so one of these conversations is actually
that thing from probably four or five months ago when that idea initially came into my
head, maybe when I saw the research about time series modeling or something really
interesting.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

12/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Dan Shipper
Okay, so let's keep going. So you've got the subagent and I actually want to pause on that
real quick, which is, I think this is a very common complaint that they just dive in and it's a
common pattern to make a thinking agent. And I think Claude Code, or Claude in general,
is probably the best one for this.
So this is a thing that we faced with one of the apps that we've incubated called Spiral,
which is an agentic ghostwriter. And I think we found—I found the same kind of thing
when I was thinking about, okay, how does a good ghostwriter work? They don't just like
—you don't say, hey, I want you to write a blog post, and they're just like, cool, I made it,
here it is. A good ghostwriter is gonna get to know you and really understand—you're
gonna work together to figure out what's in your head about it, but also shape what's in
your head. It's not just, oh, I can see it and I'm—they need to get it out of you. Like you're
actually making it together.
And in order to do that you have to have a really good interview process to uncover things.
And that sounds like you've found that too. And I think that's really interesting and really
important for people who are thinking about how do I get the best out of AI? Actually
stop for a second and let it ask—ask it to understand you first.
Noah Brier
One of the things I say to a lot of people is just like, I think partially because we call it
generative, there's entirely too much focus on its ability to write and not enough focus on
its ability to read. And its ability to read is incredible, right? And I think arguably it's
much more useful on a day-to-day basis. We produce artifacts far less frequently than we
just think about things.
And so yeah, I do this a lot. This is definitely a complaint I have about all the models—
even when you very specifically tell it not to try to do your work, it still often tries to do
your work. And so you have to really be like, no, I said no.
I think actually if we look at—so critical when Noah says he's just collecting source
materials or, I do not under any want you to try to write it. Take this literally do not create
outline drafts or any versions of talk/writing. Only gather and organize the requested
materials.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

13/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Dan Shipper
So good. I love it.
Noah Brier
Yeah, this is like—but yeah, I think we all experience that. And I mean, I do hope over
time that sort of gets baked into the models. I think it's a very interesting tension that
exists with the model companies because obviously, a lot of the economic input-output is
sort of measured in the artifacts that it produces. And so I think it's very oriented and I
suspect that part of it is just like, that sort of helpful assistant thing has become a sort of
meme that is probably self-ingested.
But yeah, I think for those of us who are trying to do more interesting things with these
models, it becomes a real barrier to work.
Dan Shipper
Totally. Okay, so now I want to think about when you're using the thinking agent—did
you say it's outputting some sort of summary of what you've come to into a particular
place or—
Noah Brier
Yeah, so that thinking agent is sort of told to, as it asks me questions, kind of make notes
about the questions that it's asking me and keep a kind of running log of what I'm
uncovering and how I'm thinking about it and all those sorts of things.
Dan Shipper
Got it. And then you come back the next day and you're like, Oh, I just want to go down
this rabbit hole on X, Y, Z thing about this Wild Bill guy. And then you start in a new chat,
maybe with it, maybe with the subagent, maybe not, and that becomes its own new file on
that topic.
Noah Brier
Yeah, exactly. So the Wild Bill stuff started as deep research in ChatGPT. And I had to go
out and I'm reading the Wild Bill book right now. There's one particularly famous
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

14/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

biography of him, and I'm thinking about the bits and pieces and trying to make—and I
think I made an interesting connection in there where, you know, a big part of what he
seems to have been after with the OSS and the inspiration for the Special Forces was
empowering individuals.
That's the theme of that manual—obviously empowering citizen saboteurs, but also, I
think a big part of the Special Forces is having incredible operators at the edge who
obviously operate within a command and control hierarchy, but have a ton of autonomy to
move and execute independently because they have all the things that they need.
And so in all of that Wild Bill research, I went back to this and I was like, is this an
interesting way to connect all these ideas? And again, this is still early. I have not solidified
these conclusions—this is like the regular writing process, right? But it's like, well, I think
there's this idea that fundamentally, one of the big things with transformers is it moved us
from sequential-based models to models that can act in parallel better. And that obviously
allowed us to have much more powerful and interesting models and has arguably kicked off
this entire revolution of what's going on and what we both do for a living.
And so I think there's this interesting connection. And so that was what I was playing
with. I think here was like, oh, maybe there's this connection between sequential
processing to this parallel and then there's this connection to bureaucracy and then there's
this connection to Wild Bill who seems to have been very much about working within a
system, but having autonomy at the edges. And so that's what I was playing with and just
taking notes.
And then, yeah, I would jump out and be like, oh, well actually I haven't figured out a
conclusion yet. Let me start the conclusion section and I'll just get that going on the side.
But I have a job so I can't be doing this all the time. So it's also like you interrupt yourself
and it's really nice to be able to come back and be like, can you catch me up on the last three
days of research?
(00:30:00)
Dan Shipper
Oh, I love that question. That's so cool.
Noah Brier
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

15/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

And so, yeah, you can just go in and be like, can you catch me up on the last few days of
research? And it's just gonna go read all the stuff, right? And again, it's like, I think the
point you made earlier about go find relevant sources—I find a lot that the difference
between people who are getting a lot out of this right now is part of it is just like you have a
good feel for where the edges of the capabilities of these models are, and you sort of
encourage them to work within those capabilities.
This is an incredibly easy—we know what it's gonna do here, right? I could write all these
Unix commands, it's just gonna go find a bunch of files in this directory and it's gonna look
at them by date and it's gonna look at all the files created in that project over the last—and
we know it's gonna be able to do that.
And so it's saying the major breakthrough day was this idea of bureaucracy as positional
encoding, which is very much a work-in-progress idea, but I kind of like it. But you know,
so it's just like, it's pretty amazing also to just be able to revisit deep work like this, right?
Where you know you're gonna break your flow. And it's like, it's often—I find whether it's
code or writing, the hardest part is just picking it up again because you're out of it. And so
just to kickstart that process is sort of amazing.
Dan Shipper
So I'm curious about this—just a sidebar on the bureaucracy as positional encoding thing.
So I think what that means, and correct me if I'm wrong, but when the language model is
processing what's in context, it's turning each token into an encoding that knows its
position in the sequence. So, you know, let's say each token is a letter, which it's not, but if
it was, an A that's five letters into the sequence is gonna be different than an A that's like
20 letters into the sequence or something like that. Is that what you're talking about? And
if so, how does that apply to bureaucracy?
Noah Brier
Yes, that's definitely—and you know, the reason I'm talking about it is just because we
were—the RNNs, the previous generational models, did everything sequentially, right? So
rather than positionally encoding them, they just went 1, 2, 3, 4, 5. And there were a whole
bunch of problems with that, right? You sort of trailed off the past. So the further you got
away from one, the more it sort of forgot.I don't know what bureaucracy as positional
encoding means yet.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

16/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

I think what I was playing with here is this idea that bureaucracy was actually an
innovation, right? That we look at bureaucracy as a negative and generally we talk about it
as a negative, and I think often it is a negative. But bureaucracy was a huge innovation for
how companies operate, right? And ultimately it sort of represents hierarchy and
structure and a whole bunch of things that are actually pretty positive for operating at a
large scale.
And so again, my whole thesis on AI around all this bureaucracy stuff is that what's
interesting about it is that, as opposed to past technologies which forced you to make a
decision about whether you wanted to use your existing structure and build that
technology into your existing structure or adopt the new structure, most of the time the
new software required you adopted the new structure. And that's why so many software
projects failed for so long. At least that's part of what I think.
And I think part of what's interesting about AI, what I find so interesting, is that you can
keep letting everybody work in whatever way they want. You know, it's like a classic
problem inside large companies—one team wants to use Asana and one wants to use Jira
and one wants to use Linear, right? And so then at some point there's a huge project and
they bring in some big consulting firm and they decide they're gonna all centralize on this
one thing. And now two-thirds of the company is unhappy. And like they've all made
sacrifices and you're sort of in this very non-ideal state.
And I think what's really interesting about AI—and this is a little more theoretical because
I think we're so early in this—is that I think it's very possible you could just say, well,
everybody just keep doing what you're doing. We're gonna stick some models in the
middle. They don't care what you use because it's all just data structures to them. And so
we can then have this sort of central thing.And when we talked about Percolate at the
beginning, Percolate was a marketing platform, worked with very large companies, so it
was an enterprise software product. And it's like, you know, at the end of the day this is the
fundamental challenge of enterprise software—adoption and change management.
And I just think, and I hope, and again this is the optimist in me, that AI kind of lets you
just not worry so much about these things. And rather than trying to make everybody
change the ways that they work, kind of let them work in these ways and let AI sort of—I
call it my Thomas's English Muffin theory of AI, which is that it gets into the nooks and
crannies.So anyway, but I have no idea what bureaucracy as positional encoding means yet.
I'm hoping I figure it out in the next two weeks before I have to give this talk.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

17/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Dan Shipper
No, but I think the point you just made is totally right and it's actually not—it doesn't have
to be theoretical. Like I've been seeing this too inside of Every, and I've been meaning to
write about it, and the place that it's been coming up is we have—so inside of Every, we run
like six different products. And we have 15 people. So it's like a crazy product-toheadcount ratio.
And what's interesting is I really like doing things in a bottom-up way. So everyone—each
of the products is its own stack. We're not centralized into a particular stack. Each GM
that runs a product has just made a decision about do I run Rails or TypeScript or
whatever. And what I'm seeing happen, which is very cool, is a lot of the different products
are running into similar things they want to solve for.
So an easy example is we have one product called Sparkle, which is a little bit like a Finder
replacement or a Spotlight replacement. So it organizes your files and then it implements
really fast Spotlight search. I'm a user, I like it. And agentic search coming soon—check it
out.
And we're just building a new product, new GM, new stack, called Para, which is
essentially an in-house counsel, so it's short for paralegal, not PARA like Tiago Forte
PARA. And the whole job for Para is just, you know, take all of your legal files and
whenever I have a question and be like, okay, did we ever sign this contract? or what's the
employee agreement template? or whatever, it just gives you the answer and it's just
Claude Code sitting on top of a directory.
And a thing that we needed to implement for that is this sort of fast file search. And what's
really interesting is historically if we wanted to reuse the stuff that we learned from
implementing Sparkle's file search, that would have to be abstracted out into this modular
library that anyone can use. And then we have to be on the same platform and all those
things, right?
And what we did instead is we just added—who's the developer for PARA right now—we
just added her to the Sparkle repo and I was just like, just ask Claude Code to figure out
how it works and just do your own version. And so you get this sort of tacit code sharing
where we all get better, but without having to do the work of abstracting and modularizing
everything, because the percentage of things that you can do that for are pretty low
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

18/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

because it's a heavy lift. And I'm seeing that happen all the time where just having a bunch
of repos that are all solving similar problems but in different environments in different
ways, everyone gets more productive because AI can kind of translate.
Noah Brier
So at Alephic we do a whole bunch of building for very large brands. And so we sort of
build all kinds of AI things and we've got lots of sort of internal and external repos and we
frequently have the same thing. And actually I've used the GitHub MCP a few times for
that same purpose, which is just like, you know, you're just in Cursor or Claude Code or
whatever, and you're like, hey, can you go look up—we run, we've got an internal tool.
It's called Intelligence that just sort of is a wrapper around a whole bunch of stuff that we
use, right? So it's like got some CRM stuff and it is just like been a fun place to build the
things that we need to run our company. But it's also a good place to kind of experiment
and explore and figure out solutions to interesting problems.
And so I'll frequently be like, oh, can you go just look at the Intelligence repo and look at
how I implemented that thing there and take those sort of best practices and just pull them
over. And yeah, I think that stuff, again, that's where I really do believe in this idea.
One of my—whenever we have a client meeting or something, my first question, the
icebreaker I always use is, what was your aha moment with AI? And mine was—I mean, it
was probably not the very first, but it's the one that I think was most impactful—I was, I
got access to build a ChatGPT plugin. Remember when plugins came out like two and a
half years ago or something?
(00:40:00)
Dan Shipper
You mean 50 years ago?
Noah Brier
50 years ago. And you know, I've written a lot of software in my life and you know what
you do when you get access to something new. It's like, I've got to go read the API docs and
figure it out and, you know, there's going to be a contract and as long as you follow that
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

19/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

contract, it works. And I go read the plugin spec and it basically is like, oh, you just stick a
manifest.json following the root directory of your application. And in that you describe
how you want us to send you data and you describe how you're going to send it back to us
and then we'll deal with the rest. And I was just like, that's amazing. It's also how the world
should work. Like, I wish everything worked that way. I wish I didn't always have to adhere
to the big company's contract for how to send and receive data.
But also, the thing that really struck me in that moment, and it's been my rallying cry
around all this stuff, is that it's also just fundamentally counterintuitive in that I literally
have a career's worth of intuition for how to integrate software systems. And it flipped it
on its head—quite literally 180 degrees away from my intuition of how software systems
should be integrated was this thing.
And that I think since then has been my thing for everybody—this is just not intuitive for
now. And that's not a bad thing. It just means you need to build intuition and that's what
we're all just out there trying to do with it, right? And so when—I don't know, I mean, part
of what I like about what you're doing, and you know, even just hearing the things you're
saying, but generally what you do with the podcast and what you do with Every is so much
of it is we're all just figuring stuff out for the first time, right? And we're like, oh, will this
work? And then all of a sudden you have this new bit of intuition for what these things can
do and what a computer that is not deterministic looks like. And that's what we're all
doing all the time. And that's why it's so fun.
Dan Shipper
I think that's why I love this moment because like you just have a weird idea and you're
like, "Has anyone done this before?" And it's like, no. And it's not a complicated idea, it's
just a whole new territory. You know?
Noah Brier
Yes. I think about that all the time. And I think actually one of the really damaging things
out there is that I think there are a lot of people who think we're way further along in this
than we are. And so, you know, I think particularly the people who are sort of scared—you
know, we work with Fortune 50 companies, and so when we're out there and we're talking
to people inside the organization, a lot of people feel like they've already been left behind.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

20/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

And it's like, no, you can literally go sign into ChatGPT and do something nobody's
thought about doing with this thing yet because there's just so much white space to
explore. And you might discover some totally new way of using it or some totally new
trick. And I don't know, that's—and you know, I think to be fair to some people that's very
intimidating. And I don't think by and large the models do any favors to themselves in
helping those people get their feet wet in that, you know, I think people go on there and
they—it's like you ask it to write you a poem and then it writes you a poem and you're like,
okay, it wrote me a poem. But I don't know. That feeling of—that feeling of being—it's
like being on the frontier, right?
Dan Shipper
Totally. And yeah, I think that your point about intuitions and getting intuitions is the big
thing. And I think people—what we don't realize is when you're dealing with something
fundamentally new, you can't trust how you reason about it without experiencing it.
Because you have to build the intuition in order to be able to reason about what it means
and how it fits in and whether it works or not. And we're just not used to that because
we're used to reasoning about things we already have an intuition for.
And I think that's why when you first see—maybe when you first saw ChatGPT, you'd be
like, oh my God, it can do everything. We're not gonna have jobs in a year. And now we're
like three years in and we're like, yeah, it's awesome. And jobs are complicated. There's a
lot of complex stuff that we do. And I love that in order to build the intuition, all you have
to do is use it. And that just by using it, you're already kind of on the edge, for now. And
yeah, I think that's the best.
Noah Brier
There's apparently a German word called fingerspitzengefühl—of course there is—
meaning fingertip feeling. And that's been my—just because I can't resist also, I'm in that
whole realm that you're discussing, I've been trying to do a lot of analogizing, right? And I
think that's really hard, but my two that have sort of stuck the most—one is just, I watch a
lot of YouTube with my kids and we watch this channel called Veritasium. It's a science
channel.
Dan Shipper
I love Veritasium. Yeah, it's great.
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

21/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Noah Brier
And he did one where he built a bike that locks out left if you try to turn right and locks
out right if you try to turn left. And what he's proving is that you can't actually turn a bike
left unless you can turn it right. Which none of us would think about when we ride a bike
because it's all just second nature and intuition. But it's also why you can't explain to a
child how to ride a bike. They just have to get on it and feel it. And that video is amazing
and that channel is amazing, but I've thought a lot about that.
Then the other one, which is a sort of deeper cut, is there's an amazing book about
quantum physics called Beyond Weird by Philip Ball. And the thesis of the book is
basically that there's nothing particularly strange about quantum physics that we—we
have a very good understanding of it. We wouldn't be talking right now, we wouldn't be on
computers, we wouldn't have phones if we didn't have a very good grasp of the mechanics
that exist underneath it.
And his thesis in the book essentially is that what's really lacking is the vocabulary because
we all exist in a Newtonian world, not in a quantum one. And so we all have words that
reflect the sort of deterministic processes of that macro universe. And I think a lot about
that. I have not fully been able to sort of pull that string all the way to AI, but I feel like
there's a real connection there because I think that there's just something really weird
about using probabilistic computers.
We're not used to using things that—you ask them the same question twice and they have
different answers. That's very strange. We're not used to—I'm not used to writing code
where you can tell the computer how you want them to send you data and they can just do
it. These are not normal things that any of us have lived with in our lifetimes. And so of
course it takes some time for us to adjust.
Dan Shipper
I think so too. And I actually have a hope that language models, by becoming a standard
way that we use computers, will create that vocabulary. Because we actually are quite good
at dealing with probabilistic, non-deterministic things like other humans.
We've just grown up in a world where because of the Enlightenment and the scientific
revolution and the tools that came out of that are very much deterministic, we've
associated that with how we see the world because of those tools and that language. And
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

22/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

there's a whole other part of the way that we see the world, which is much more squishy
and much more vibes-based, that has been—I think deeply deprioritized, especially in
Western culture—that now that we have a tool that works that way, I think we'll be able to
start seeing that again. And that's one of the beautiful things to me about language models
—it opens up that whole world again.
Noah Brier
Yes. I love it.
Dan Shipper
I do want to go back to Claude Code. And should we do the phone? We should do the
phone unless there are other things that you want to share on the computer. But the thing
I want to do before we get there that's just on my mind right now is, you said you watch
this with your kids and I'm sort of curious—what do your kids think about this and how
are you dealing with it with your kids?
(00:50:00)
Noah Brier
I love that question. So I've got a 7 and a 10-year-old. And obviously I'm pretty deeply
embedded in this stuff and so I've sort of exposed them quite a bit to it. So they will
occasionally use the sort of voice models and they have a pretty good understanding and
we'll be in the car and just play games and ask questions with Grok and do those kinds of
things.This weekend actually for the first time, my 10-year-old—she was really eager to be
—every year, my wife and her sister and brother and mom and all the cousins, we all get
together and we do Christmas together. And so it's too many presents to give to
everybody. So we do a kind of not secret Secret Santa where everybody chooses one
person. And my 10-year-old really wanted to be the one who got to be the chooser. And I
encouraged her to vibe code an app to do it. And so I just gave her my phone and V0 and
honestly, that was so amazing to watch.
Not just because it was so cool to see her do that and build it. And she went through—she
was having so much fun. She did 75 revisions on V0. So she really got it going—polished
Secret Santa app. She also started to get into really interesting computer science ideas
without knowing it. So one of the things—the adults give presents to adults and the kids
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

23/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

give presents to kids, but she wanted this to be a more generalized app. So she realized that
rather than having adults and kids, you need to call them groups, right? And so she's
getting into data modeling and I'm watching this conversation happen and I just thought
that was so awesome.And you know, also just a real pet peeve of mine right now, and I've
gotten this argument with a bunch of people is there seems to be a big conversation that
there's a bubble in vibe coding because one company or another might have too high of a
valuation. And my take on that is I just could not care less what the valuations of these
companies are. I think fundamentally, if there's a tool that could allow a 10-year-old to
build an app, that can't be a bubble. I just can't see a possibility where that is.So anyway,
that's sort of one side of it. The other big one for me that I've been thinking a lot about is
media literacy and education stuff. So you know, both at the sort of schools they go to and
then also I went to NYU and I've been having more and more conversations with the dean
of the school I went to there.
There's a lot of fear inside schools right now about AI and about cheating. And there's a
big thing—so some parents in my town, they wanted to have more of a conversation about
it. And you know, as someone who—I've thought about this a lot, but I've also just been—
I've spent my entire life thinking about sort of technology and its effects on culture. And I
think I'm relatively grounded in these things. I've put in good hours of thinking. I mean, I
know that for sure.
And so my take on it is one that you can't hide technology that won't be hidden, right? So
putting our head in the sand is not the best solution. And then my bigger one though is—I
was out, a friend of mine asked me to come talk to a school two years ago about AI out in
LA and afterwards I was talking to an English teacher there and she was like, what do I do?
What do I do about all these kids using AI?
And I was like, look, I don't really know what your job is, because being an English teacher
for 11th graders sounds much harder than my job. But on a really fundamental level, I
don't actually think your job is to teach these kids to write because that's a lifelong pursuit.
I think your job is to convince them that it's worth learning to write. And so in that way,
I'm not sure that anything fundamentally changes because of AI.
And again, this is my very optimistic take, but I think that there are so many parts of the
education system that AI really just exposes the sort of flaws in the way that we teach. Why
are there so many tests on these kinds of things instead of encouraging thinking and
learning and coming to love to write and research and whatever? You know, it's like we're
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

24/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

so focused on teaching kids the five-paragraph essay while every adult who is a writer has
long abandoned that because it's all about sort of discovering that you like to write and
what your own style is and how to do it.
And you know, it's like, I'm sure a big part of working with AI to write is telling it—is
ignoring it because you're like, no, that's not me. I'm not into that. I'm totally comfortable
saying really here I know you don't think it's a good idea, but I'm cool with it.
And so I don't know, I've been sort of having a lot of these different thoughts. I'm actually
pitching a class for the fall of '26 at NYU—the idea for it is "Code Is Essay." And my sort of
point of view is this opens up this new way to express yourself. And that we have all these
other ways that we celebrate to express ourselves. But code has been long shut off from
people because it's—but actually it's kind of amazing and it lets you express yourself in all
these different kinds of ways and that's what my 10-year-old was doing this weekend.
So anyway, those are all the bits and pieces as a parent I've been thinking about. The one
other thing I will plug is media literacy I think is a big piece of it. A lot of people are afraid
of these models and hallucinations. And there's a book by a guy named Tim Harford who
writes for the FT and he's an economist. And he has a book called the Truth Detective,
which is an adaptation of the Data Detective, but it's written for kids and it's the best
media literacy book I've ever read for adults or for children.
And I think a lot of what this AI conversation exposes is how bad a job we do with helping
and arming our kids and our adults to be sort of truly media and technology literate. And
you know, being really good at knowing what's real on social media turns out to be also
really useful for differentiating between hallucinations and non-hallucinations in
ChatGPT, right? This is a sort of—to me, a very central skill that we need to arm
everybody with.
And I am sort of way more interested in that with my kids than I am in worrying about
them cheating. That was a very long answer to your question. I don't know if it got at what
you were looking for.
Dan Shipper
No, it's amazing. That's exactly what I'm looking for and what strikes me—oh, another
way to frame what you're saying is, for example, rather than having them memorize and be
quizzed on what the 50 states are, asking them to go find the 50 states with ChatGPT and
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

25/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

be able to tell when the AI is giving them the wrong answer. Because that's a lot more of
the meta skill that they're going to need anyway down the line. And again, I'm not a
teacher. I'm sure there's lots of teachers who are like, this is crazy for a lot of probably good
reasons, but there's something interesting there where the meta skills become more
important than they used to be.
And in order to do well at the meta skill, you have to also be able to, to some degree, do the
underlying skill too. But we probably could be spending much more time on the meta skill
than we are now. The education system isn't really set up to do that anyway.
Noah Brier
Yeah, and I think even simpler examples is like, I went to a school called Gallatin at NYU
and when you graduate, you have to sort of—it's not quite a thesis defense, but you have to
sort of spend three hours with four professors and sort of explain your line of reasoning
around why you studied what you studied. And you need to be prepared to weave into that
defense any of 25 books that you put on your book list.
And you know, I was talking to them and it's like, amazing. That's entirely AI-proof,
right? There's no cheating on that. You show up in that room and you're either prepared
to speak to it or you're not. And whether you prepared with AI or not doesn't mean
anything, right? It's like, can you make an argument in this room? And not everything is
going to be that easy to be sort of cut off, but I don't know, there's something really
beautiful about that idea, right? Because it's naturally cheating-proof because you're
sitting there and it's a question of like, did you actually internalize these things?
And I don't know, that's way more interesting to me than even like, was your essay good or
any of these other—it's like, did you get it? And so yeah, I don't know. I'm trying to do my
best to take a balanced approach and try to at least sort of tamp down some of—I live in a
small town in Connecticut and you know, I think there's a lot of fear amongst parents. It
was mobile phones and then it was social media and now it's AI and it's like another thing
that's gonna ruin our kids. And I don't think that that is true. But I think there are things
we can and should do to encourage it to not be true—really get them really good at the
things you're saying.
How do you tell—and again, it's like hallucination is just a form of the same kind of
misinformation that exists on television and on the internet and in social media and
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

26/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

everywhere else. And just sort of encouraging people to get in touch—there's a great part
of the Truth Detective, for the kids' book, he calls it "the brain guard." And one of the bits
of advice he has is when you encounter some piece of information, if it makes you feel
really good because you agree with it, then you should be even more skeptical of it. And he
calls it the brain guard, and he's explaining this for a 9-year-old. And I just thought that
was such a beautiful way to put it, right?
That's what you learn to do when you get good at being on the internet—that you're like,
wait, I should be more skeptical of this because this is in line with everything I think. Let
me just double-check. Like you get to learn that feeling in your gut and get to learn when
to react to it. And so yeah, that's a lot of how I think about it.
(01:00:00)
Dan Shipper
That's great. I'm interested. I'm going to get that book. I'm interested in reading it.
Noah Brier
You should. My plan is to read it to my kids every year from now on.
Dan Shipper
I love it.
Noah Brier
Just refresh it.
Dan Shipper
Now for the moment we've all been waiting for—show us how you use Claude Code on
your phone as a second brain note taker.
Noah Brier
Okay. So here we go. So I am going into an app called Terminus. Terminus is just a
terminal. And what is allowing all this to happen behind the scenes is in my basement, I
have a mini PC. On that mini PC, I have a thing called Tailscale running. And Tailscale lets
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

27/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

you set up these very simple VPNs. So I'm currently inside—like if I scroll down here, you
see I'm on a VPN, that's my personal VPN. I'm not on an outside VPN. So the only way to
access this machine is through my VPN.
And so then when I go in there, because I sync my Obsidian with Git, so I put it—it's on
GitHub in a private GitHub—I can then sync it back down to here. And so then I can just
call up Claude, and now I'm just in Claude Code talking and thinking. And I can just be
like, what's new in the last two days? I can access any of my agents. I can do anything. And
again, this is in my Obsidian, but I can use this anywhere, right?
So I'll be like, on the fly—I've got other repos in here. You know, I realized a link was
broken on my conference site, and so I just opened the repo. I pulled it down. I asked
Claude Code to make the changes, and I was able to do it right here. So this has been
completely wild to me because again, this is very much in that—like on Tuesday of this
week, we had Monday off, Tuesday, I dropped the kids off at the bus and then I went and I
sat and had breakfast and I literally sat on my phone and worked on this talk for like two
hours. And I did it through here, right, on my phone where I was doing real thinking and
research and pulling things in and placing things in and doing all this kind of stuff. And
you know, I'm able to do it all and it just doesn't seem like I could do that kind of thing
without that.
So yeah, there's been a completely revolutionary change in my life. And actually one of the
things I've been doing lately is setting up—I've got all these friends now who I've set up
like little partitions of this mini PC in my basement so that they can also run Claude Code
on their phone because I like it so much.
Dan Shipper
Does this make you be like, oh my God, I gotta drop everything and just build an actual
purpose-built notes app that has Claude Code as a backend for this?
Noah Brier
No. I mean, actually one of the things I've been thinking a lot is like maybe I just—
everything should just run in Linux all the time for me. Maybe this is, at least for the short
term, this is the answer to all of what I just need to not have anything anywhere else.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

28/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

No, I mean, I'm sort of pretty out of the SaaS game these days, so I don't often think that I
should drop everything and do anything. I find this to be a really amazing solution.
Honestly, my only complaint here, which is a fairly big complaint, is that when you hit the
microphone button, you see how it's up there? The reason for that is because the way the
terminal works is that's not a real input box, and so you can't talk to it.
Which—man, I hope this company fixes. So they added this AI to generate commands
here. This is just in the Terminus app. This is whatever—an app on the app store. But the
problem is that it assumes you're in the terminal. So it writes terminal commands, but I'm
like, no, I just want you to be able to—right—I want you to just take what I said.
And just input it into that box. But no, I mean, this has really changed the way I work and I
feel like I can just be anywhere and just be on my phone and—you know, I mean, I was out
like, I needed a break. It was, you know, 4:30. I went and sat outside for a while. And then
we had a project that needed to get delivered to a client and a small change needed to be
made that I was the best suited to make that change. And so I just hopped on my phone. I
pulled the repo down and I went into Claude Code.
It's like a tiny little change. You know, the way I find myself using Claude Code the most
for code is that mostly I'm having it do the work I already know how to do. You know, I'm
like, oh, I know exactly—I knew exactly what was going on in that situation. I knew why
we were having the issue we were having, and so it was like I could have gone back to my
computer and opened up Cursor and done it in Cursor either by hand or with Cursor. But
it was like, I just—I was like, I told Claude Code exactly where to look. And I first
confirmed that the problem was what I thought the problem was, and then I just had it
push a solution and it pushed a PR and then I was done.
Dan Shipper
Amazing.
Noah Brier
And I was still sitting outside by the pond.
Dan Shipper

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

29/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

I love that. Yeah, I've definitely had that experience. I've never—I've not done it on my
phone. I'm like, I have my laptop out with me by the pond or by a lake or whatever. But
you're inspiring me. I have a Mac mini in the office that I've been meaning to set up.
Noah Brier
Yeah, you can also very easily—my first version of this was I used a little Hetzner box
because they're super cheap. They're just a cloud host, but you could—this could be an
AWS box. Anything. Tailscale makes the VPN thing stupidly simple. That's the biggest
unlock for me is I get overwhelmed by all the sort of low-level stuff. I don't know anything
about any of this really, and so having Claude Code do that.
One of the other—by the way, one of my other big ahas recently has been building Claude
Code helpers for doing basically setup work. So it's like, I'm not—I've been playing with
Linux lately. I'm playing with this Hey, which is DHH's Linux distribution. And I'm not
super comfortable in here. And so I got this whole—this is a Claude Code project
specifically to help me configure this box. And it's so nice because I'm like, oh, how do you
do this in Linux again? Or what's the Neovim command? Or can you change this? Can you
help me install this plugin for Neovim? Or whatever it is.
And so now I have one on my Mac too, where it's like, can you clean up all the Homebrew
things? Or I switched from which Python package manager I was using. And it was like,
that would've been super overwhelming for me. And I was like, I want to switch from using
pip to using uv. Can you just make that happen? And it just did all this stuff for me and it
knows all my preferred settings.
And so I actually have a version of this where now I've got it so tuned that if I want to
launch a new box for doing something, it'll just have all my settings ready to go, and then I
can log into Claude Code and the Claude Code can then set up anything else that didn't get
set up in the initial process.
Dan Shipper
That is amazing. That's wild. This is my happy place. I can see that. Are there any big
projects like this that you've been itching to do or itching to try out?
Noah Brier

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

30/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

No, not really. I mean, I've been having a ton of fun. My server stuff has been a ton of fun.
I've been doing a lot of that. I am—I'm, like I said, I mean this is kind of joking kind of not
—it's like I'm super interested in doing more. Because Claude Code has become such an
integral part of my life, I'm very interested in the command line and I found myself
installing more and more things into the command line and doing more and more work.
So I've been using Simon Willison's LLM command line tool and doing more and more
stuff sort of in that and then also layering that back into Claude Code. So my newest
Claude Code little Obsidian tool is—I have an attachments folder in Obsidian where all
the PDFs and images and stuff in any note go. But inevitably they have terrible names,
right? And so this goes through very similar to Sparkle and, but just in that Obsidian
folder and it renames them all and then it also puts them in metadata. It puts them in a
table in the attachments folder, and then it renames all the attachment links back. So just
cleans everything up. It just does it through Gemini Flash.
And so it's like, I don't know, stuff like that's kind of amazing. So I don't—I'm just having
the time of my life just building and tinkering and, you know, I mean, this is just on the
side and I get to do the same thing. I mean, we work with Amazon and Meta and PayPal
and all these big companies and we're just building amazing stuff all the time.
Dan Shipper
I love that. I love the energy. If people are interested in following you or working with you
at Alephic, where should they find you?
(01:10:00)
Noah Brier
Yeah. Aleph is alephic.com. And then I also run this thing called Brand—BRXND.AI, to
make it particularly confusing—that’s a conference. We've got the conference coming up
on September 18 in New York City. You should come if you're around, it'll be really fun.
We're gonna talk about marketing and AI and I also write a newsletter there at
newsletter.brxnd.ai specifically at this intersection of AI and marketing. Those are kind of
the best places to find me these days.
Dan Shipper

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

31/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

Awesome, Noah. Always a pleasure.
Noah Brier
The pleasure is all mine. Thank you, Dan.

Thanks to Scott Nover for editorial support.
Dan Shipper is the cofounder and CEO of Every, where he writes the Chain of Thought column and
hosts the podcast AI & I. You can follow him on X at @danshipper and on LinkedIn, and Every on
X at @every and on LinkedIn.
We also build AI tools for readers like you. Write brilliantly with Spiral. Organize files
automatically with Sparkle. Deliver yourself from email with Cora.
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

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

32/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'

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

You Don’t Need More Money—
Just A Better AI Strategy
Investor Mike Maples on how you can compete with OpenAI

36 Mar 5, 2025
DAN SHIPPER

He’s Building the Plumbing
for AI to Use the Internet
Stainless founder Alex Rattray on MCP, a protocol
giving LLMs the tools they need to do real work

27 Oct 1, 2025
https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

33/35

2/19/26, 1:01 PM

Transcript: 'How to Use Claude Code as a Second Brain'
RHEA PUROHIT

How to Use Claude Code
Like the People Who Built It
Anthropic’s Cat Wu and Boris Cherny explain how
they use Claude Code inside the company—and
what they’ve learned about getting the most out of it

23 Oct 29, 2025
RHEA PUROHIT

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

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

34/35

2/19/26, 1:01 PM
Help center

Transcript: 'How to Use Claude Code as a Second Brain'
YouTube

Privacy Preferences

Advertise with us

The team

FAQ

Terms

Site map

©2026 Every Media, Inc.

https://every.to/podcast/transcript-how-to-use-claude-code-as-a-thinking-partner

35/35

