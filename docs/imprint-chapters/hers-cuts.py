"""Which of her messages the second variation leaves out, and why.

Sophie, Aug 2026: "you can take out the technical stuff that we got wrong,
like when we were going back-and-forth about the Mason images for example —
you can take out the actual messages. I'm mostly looking for the ones where I
described how I wanted the stories to be. If you take a lot of stuff out just
keep track of what you took out so I can ask you about it."

So the page keeps anything carrying an idea, a description, a decision or a
standing rule, and drops four kinds of message. EVERY drop is listed on the
page itself under "What I left out" with its reason, so nothing goes quiet.

REASONS (the four kinds):
  wrong    the going-wrong loops — the Mason re-draws, the asset-tab bug
  chasing  is-it-there-yet while a deploy caught up
  queue    one-line procedure: what's next, go, check it, OK build it
  pasted   a block you pasted in from another chat — its words, not yours
  nothing  an upload with no message attached to it
"""

CUT = {
    'ch04.3': ('queue',   "reading the rest of my messages, no reply needed"),
    'ch04.4': ('queue',   "added a couple more comments, are they done"),
    'ch04.5': ('nothing', "four journal pages, no words with them — you sent the transcription next, and that one is kept"),
    'ch06.3': ('wrong',   "only the first lesson opened, the rest said tap to begin"),
    'ch10.1': ('nothing', "the How to Read People PDF, no words with it"),
    'ch10.3': ('queue',   "haven't been reading your messages, what are you waiting on"),
    'ch12.1': ('queue',   "did you redo the reading people ones"),
    'ch12.2': ('queue',   "what else is on the queue"),
    'ch12.3': ('queue',   "go 1 → 2 → 3"),
    'ch12.4': ('queue',   "what's next"),
    'ch14.11':('queue',   "a garbled line, then: I want to check what you've already done"),
    'ch15.1': ('queue',   "are those 40 asset notes new ones or all of them"),
    'ch15.7': ('pasted',  "the PROMPT-button announcement from another chat"),
    'ch16.3': ('pasted',  "the two-way asset notes announcement from another chat"),
    'ch16.5': ('chasing', "are you sure the APIFrame key is nowhere"),
    'ch17.1': ('wrong',   "did you take images out of the Assets tab — the hard truncate"),
    'ch17.2': ('wrong',   "why is there a cap, and are you posting some twice"),
    'ch17.3': ('wrong',   "give me a message to paste so another chat can fix it"),
    'ch17.4': ('wrong',   "you made Mason an actual Viking — on purpose, or didn't you look"),
    'ch17.5': ('wrong',   "reuse the Mason description; the beef jerky already exists"),
    'ch17.6': ('wrong',   "the jerky isn't a lesson card, it's a corner card"),
    'ch17.7': ('queue',   "OK, build it"),
    'ch17.8': ('wrong',   "what did you base the sauna illustration on"),
    'ch17.9': ('wrong',   "isn't the original text already earlier in this conversation"),
    'ch17.10':('wrong',   "do you have the exact prompt from the first Mason comic"),
    'ch17.11':('wrong',   "why didn't you use the original and change the one thing"),
    'ch17.12':('wrong',   "this one doesn't have the house colours — you are not doing well"),
    'ch17.13':('wrong',   "did you look at the original prompt and change one thing, or not"),
    'ch17.14':('wrong',   "what the fuck are you doing, the point is small changes"),
    'ch17.15':('wrong',   "did you re-create the crop one with the corner metaphors"),
    'ch17.16':('wrong',   "why didn't you post the exact prompt in the prompt tab"),
    'ch18.2': ('queue',   "will that be a web page or a TestFlight build every time"),
    'ch19.3': ('queue',   "yes, go ahead with the lessons hub"),
    'ch19.5': ('queue',   "finish it, I'm going to bed"),
    'ch19.6': ('queue',   "i'm awake!"),
    'ch20.6': ('chasing', "I don't see the tiles, are they there yet"),
    'ch20.7': ('chasing', "they're still not there"),
    'ch20.8': ('chasing', "I'm only looking at the iOS app, still not there"),
    'ch20.9': ('chasing', "were you looking at the iOS app or the web app"),
    'ch21.2': ('queue',   "OK, check it"),
    'ch21.4': ('queue',   "verify it for everything, not just that one message"),
    'ch21.6': ('queue',   "copy-paste block versus a markdown file"),
    'ch21.7': ('queue',   "what about the thinking in between"),
    'ch21.9': ('queue',   "give me those first messages as markdown, unchanged"),
    'ch22.1': ('queue',   "did the test station work get finished"),
    'ch22.2': ('queue',   "the same question again — it sent twice"),
    'ch24.1': ('pasted',  "the backfill-my-messages instructions from another chat"),
    'ch25.3': ('pasted',  "the hook-update command from another chat"),
    'ch28.3': ('queue',   "there are two back buttons, where does the top one go"),
}

LABEL = {
    'wrong':   'going wrong',
    'chasing': 'waiting on a deploy',
    'queue':   'moving things along',
    'pasted':  'pasted from another chat',
    'nothing': 'an upload with no words',
}
ORDER = ['wrong', 'chasing', 'queue', 'pasted', 'nothing']
