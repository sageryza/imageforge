# build-coincidences-deck.py — the deck behind docs/suspicious-coincidences.md
#
# Sophie, 2026-08-31: "go to find all my suspicious coincidences". This builds
# the payload for the stock `deck` Compare page in her suspicious-coincidences
# chat: one card per coincidence, HER OWN telling verbatim (trimmed, never
# reworded), her framing line as the caption, and a Listen link that plays the
# voice memo the card was lifted from.
#
# It only PRINTS the payload — piping it anywhere is a deliberate second step:
#   python3 scripts/build-coincidences-deck.py > page.json
#   curl -X POST https://imageforge-q125.onrender.com/api/chatfeed/page \
#        -H 'content-type: application/json' --data-binary @page.json
#
# A NEW VERSION IS A NEW PAGE, never a re-post of the old id — her verdicts are
# keyed to the sheet name, so rebuilding in place re-points them at different
# cards. Supersede the one it replaces (POST /page/:id/supersede).
#
# The `session` below belongs to the chat that built it; a later chat passes its
# own, or the page files against the wrong thread.

import json
AUD = "https://imageforge-q125.onrender.com/api/search/audio/"
def L(src): return {"url": AUD + src, "label": "Listen to the memo"}

I = []
def card(who, eyebrow, text, src, caption=None, said=None, label=None):
    it = {"label": label or who, "who": who, "eyebrow": eyebrow, "text": text, "link": L(src)}
    if caption: it["caption"] = caption; it["captionLabel"] = "In your words"
    if said: it["said"] = [{"when": eyebrow.split("· ")[-1], "text": s} for s in said]
    I.append(it)

# ── EVAN ──────────────────────────────────────────────────────────────
card("The Evan phone call", "EVAN · Jul 9, 2026",
 "I was thinking about my friend Evan when the phone rang. It was Evan. I said, I was just thinking about you when the phone rang. He said, oh that's cool, what a strange coincidence. I said, oh yeah, but I don't know if it's a coincidence. He said, haha, what, you think it's magic or something? I said, yeah, well, I don't know if I'd call it magic. I think there's some science behind it, I just don't know what it is.",
 "2026-07-09_0456_2026-07-09T11_56_09Z",
 caption="I don't like seeing the future. It's kind of hard, you know.")

card("Don't tell Evan", "EVAN · Aug 2, 2026",
 "I vowed not to tell him anything. But then he called me, and he was like blah blah blah, and I told him. And then I was like, okay, give me a sign. Then just before bed, with my hand on the doorknob, my dad's like, you know what I saw? All these people slowly watching a rat die.",
 "2026-08-02_1243_2026-08-02T19_43Z",
 caption="Okay, well, I guess I shouldn't have told Evan. He and I haven't talked in two months.")

# ── PICTURED IT ───────────────────────────────────────────────────────
G1 = "PICTURED IT, THEN FOUND IT"
card("The Gap Kids shirt", G1 + " · Jul 9, 2026",
 "One time I thought it would be great to have a clothing line for short people — button-down shirts, but for women, the same cut as they look on men, not the long, loose, boxy cut. The next day, who knows why, I ended up at the Gap. Gap Kids specifically. And who would have known that the exact shirt I was picturing — and it was very specific, I was picturing a white shirt with pastel stripes down the front — I found that shirt at the Gap the next day. I bought it, of course. It didn't quite fit me. The armpits were too tight.",
 "2026-07-09_1048_2026-07-09T17_48_09Z",
 caption="I was, like, so confused and excited. How did this happen? How did this come true?")

card("The double envelope", G1 + " · Jul 9, 2026",
 "I've had this idea for a while called the duplicitous envelope — when you say something but you really mean something else, and you're aware of both meanings when you say it. I imagined it one time as I was falling asleep, as an envelope with two slots, one for each meaning. A couple of days later I was in El Salvador, at dinner with a friend of my mom's from the Peace Corps. And he brought with him a strange surprise. It was more or less the exact envelope I'd been envisioning. His was made of leather. He had brought it to show my mom the leatherworking he'd been doing.",
 "2026-07-09_1048_2026-07-09T17_48_09Z",
 caption="It was so strange. It was the second instance of something I had exactly imagined existing in real life the next day.",
 said=["Perhaps you made it happen with your mind, drifting into that strange dream state. The theta state — the special state between waking and sleeping. According to some random AI YouTube channel I watched about a year ago, this exact time frame, the moments between sleep and wake, is exactly also where the spirit world overlaps with reality. So that the universe may find a way to make it happen for us in the day that lies ahead."])

card("The pink satin bed", G1 + " · Night one, May 2026",
 "I started thinking of a pink satin bed that had those cinched-up buttons on the headboard, all shiny and pink. I had no idea how I'd get it. Certainly I didn't want to find one on Craigslist and lug it into my house. In my mind, as I drifted off, it just sort of came. The next day I forgot about this idle wish, and no one came and delivered a bed frame to my door just because they felt like it. But I did see a white headboard that looked suspiciously like the one I'd been imagining. It had those cinched-up buttons. I walk down my alley every day on my way to get coffee, and I couldn't remember this one being there before.",
 "2026-05-27_1958_2026-05-28T02_58_27Z")

card("The cat on the wall", G1 + " · Night two, May 2026",
 "I thought it might be nice to have a cat. I'm not an animal lover and I can barely manage to feed myself. But this night was a little bit cold, and I imagined how nice it would be to have the cat kneading its little paws on my bed, purring, finally settling down on my chest. When I saw the cat the next day perched on a brick wall staring at me like I was late to a meeting, I actually got scared. I'd spent so long thinking about it the night before that I'd worked out the details — it would have to go in and out as it pleased, and it would have to follow me home. So I felt sure I was meant to take it home. It must have sensed my fear, because it jumped off the wall and gracefully padded in the other direction, and I was free to walk home.",
 "2026-05-27_1958_2026-05-28T02_58_27Z",
 caption="Whoa, this magic thing is kind of weird. Like, really works.")

card("The chocolate bars", G1 + " · Night three, May 2026",
 "I knew it was stupid, but I just couldn't stop myself imagining those chocolate bars that Charlie gets in Charlie and the Chocolate Factory. By this time I wasn't surprised to see that my mom had gone shopping and left three full-sized chocolate bars unopened on the counter. Well, actually, one was opened — revealing a bright silver foil that looked suspiciously like a golden ticket.",
 "2026-05-27_1958_2026-05-28T02_58_27Z",
 caption="Why hadn't I wished for something bigger?")

card("The cinnamon cake", G1 + " · Aug 11, 2026",
 "I started imagining something like chocolate cake — perhaps my dad would bring it home from my aunt's, and it would be on the kitchen counter for me to find. But even in my imagination I could see myself sadly walking past because of my moratorium on sweets. The only way I'd actually get to eat it was if someone literally forced me to. Locked me in a room and said, Sage, eat this. I laughed to myself as I imagined this and slipped into a dream. That Thursday our housekeeper had rearranged the living room furniture so she could sweep — the two large red chairs pushed right up against the two blue couches. When I stepped onto the rug, she disappeared into the kitchen. I found there was no easy way to get out.",
 "2026-08-11_0836_2026-08-11T15_36_26Z")

card("The Alive Water truck", G1 + " · May 7, 2026",
 "In a lucid dream I decided I ought to visualize something, so I visualized myself in a very specific spot in my neighborhood, healed, sitting beneath the tree. The next morning on my walk I stood in that same spot and realized it was the same place. Two chatty girls came by, so I stepped aside to let them pass — inordinately closer to the place I'd been imagining. And then an Alive Water truck rolled by with a picture of the exact glass water dispenser I'd been imagining on the side of it, so I could get water into my guest house and not have to go into the house for good water. Then I stood there a bit longer, not knowing what to do. And then a sparkles truck rolled by — another water truck.",
 "2026-05-07_1441_2026-05-07T21_41_41Z",
 caption="This is really meant for me. Lots of things meant for me.")

card("The banana clove beer", G1 + " · Jun 21, 2023",
 "Earlier that day I thought I'd have an alcoholic beverage only if someone cool and hot and probably tall and skinny with long hair gave it to me. And then it happened. I was at a little food cart, and this guy was really pretty, and he gave me a sample of banana clove beer. He said it tasted like banana bread — and I'd been thinking earlier that if only Portland had a banana chocolate slushy it would be perfect, like LA. And there was one just on the side of the road for me. It was there for me.",
 "2023-06-21_0002_2023-06-21T07_02_25Z",
 caption="I always thought that I predicted it, and that's why these things would happen exactly how I thought they would. But it turned out that it wasn't that I was predicting it — it's that I was making it happen.")

card("Married in six months", G1 + " · Jun 21, 2023",
 "I predicted I would get married in six months or whatever. And then I did.",
 "2023-06-21_0002_2023-06-21T07_02_25Z",
 caption="Basically the ultimate instrumentalism. Like using myself — I'm using myself as an instrument. I don't understand the mechanism.")

# ── IT ARRIVED WHEN I NEEDED IT ───────────────────────────────────────
G2 = "IT ARRIVED WHEN I NEEDED IT"
card("The white gloves", G2 + " · May 2026",
 "I strolled aimlessly into the city, feeling quite depressed. I happened upon a sign pointing to some posh event at an art museum, and was immediately sad I couldn't go, and lamented not just that but all the events I would never get to go to. I headed in that direction anyway, but on the way I stopped at a 99-cent store, my happy place, and bought — for some reason unbeknownst to me — a pair of white gloves. Not latex, fabric. I had never endeavored to own a pair of gloves like this, but they caught my eye and I felt I needed them. Once at the event it became apparent that all the security guards were wearing a pair of these gloves, and I was let in after seeing that I too possessed them.",
 "2026-05-27_1954_2026-05-28T02_54_32Z",
 caption="I became quite undepressed by the end of the evening, all thanks to a pair of gloves that I had no idea why I was buying.")

card("The dance performance", G2 + " · May 2026",
 "I chose to wear an entirely black outfit — I didn't know why — black shoes, black pants, black shirt, hair in a ponytail. My roommates led me to a performance I didn't know a thing about, and I ended up sitting in the front row, which was actually just the floor. It was two women doing modern dance, grappling with each other, falling all over each other. I noted that they were wearing all black, and that I also was wearing all black. The situation seemed to be a dare, which I carried out without needing even to stand. I rolled away from the audience and into the performance. The performers, who looked exactly like me, embraced my appearance without a second thought, as though it had been planned.",
 "2026-05-27_1954_2026-05-28T02_54_32Z",
 caption="Two became three, and after it was over everybody clapped, and no one except my roommates were the wiser.")

card("The bobby pin and the mushrooms", G2 + " · May 28, 2026",
 "One day I was sitting on the toilet in my seven-bedroom loft when I had the urge to reach behind the seat. There I found a bobby pin. As though I were already on some substance, I felt compelled to use it to open the door of my roommate Nathan, who had gone on vacation. I had never picked a lock or thought to do so, but the door opened on the first try. And then, without knowing what was in it or what I was looking for, I opened the top left drawer of his dresser and took out a little bag of mushrooms.",
 "2026-05-28_1354_2026-05-28T20_54_21Z",
 caption="I call this strange phenomenon instrumentalism. You follow your heart's desire and it leads you on a path that you didn't know existed.")

card("The splinter", G2 + " · Aug 11, 2026",
 "I got a splinter while sitting on the toilet, cursing my situation, and it stayed with me for weeks. One day I watched a YouTube video about common household cures and she mentioned that charcoal was good for everything — bug bites, snake bites, splinters. I happened to have gotten my mom some activated charcoal pills over ten years ago when she got sick. I was very young and had to walk through the streets of New York by myself to get them, while she stayed in the hotel room throwing up. I used these to remove the splinter. In the morning I arranged a contraption with pillows and a mirror and took it out myself.",
 "2026-08-11_0836_2026-08-11T15_36_26Z",
 caption="If that splinter could come out after being lodged in my foot for weeks, then why can't I wake up and suddenly have no other health problems either?")

card("The boy at the window", G2 + " · Aug 11, 2026",
 "Once, when I was 20, I asked to be woken up in 15 minutes, and a little boy came and shook the bars of my window at exactly that time.",
 "2026-08-11_0836_2026-08-11T15_36_26Z",
 caption="Star is the name I have given to magical activities that have already taken place. Spells I have already cast, whose results I already saw.")

card("The security patrol", G2 + " · May 17, 2026",
 "That day when I was walking, and I think I started feeling my splinter again — and then the security patrol people showed up, and they were like, hey, are you okay? Are you lost? I guess I had been in my head like, ah, I need help. So that was the help I got, but I didn't want it, so I left.",
 "2026-05-16_2200_2026-05-17T05_00_07Z",
 caption="But I was like, wait — maybe I was supposed to take that and go in their car.")

card("The abandoned cup of water", G2 + " · May 20, 2026",
 "I'd come to get water from a cup, and there were no cups left in the Country Mart, so I left and walked around looking for a cup elsewhere. I remembered how I have this idea of that Cartoon Network thing where you just find exactly what you're looking for — there's a part of it where it's something that doesn't seem like what you're looking for, and that's kind of how the universe works. Then I got called back into the bookstore, and someone had left an abandoned cup of water with ice and a lid.",
 "2026-05-20_1700_2026-05-21T00_00_00Z")

# ── SOMETHING STOPPED IT ──────────────────────────────────────────────
G3 = "SOMETHING STOPPED IT"
card("The car accident", G3 + " · May 22, 2026",
 "I was sitting outside listening to a friend talk about one of my greatest fears, going on and on in this very monotone voice, and for whatever reason I did not feel like I could get him to stop. I was completely paralyzed with fear, becoming like a pot about to boil over, until I really strangely felt like I couldn't hold it anymore. And just at that second, a car accident happened right in front of our eyes. There had been no cars. It was a deserted street, the middle of a suburban neighborhood, the middle of the day. Two cars, coming right at that moment, crashing into each other. Nobody got hurt — a fender bender. But it caused him to stop talking, because we were both surprised.",
 "2026-05-21_1709_2026-05-22T00_09_36Z",
 caption="The amount of emotion I was feeling was like a prayer to God. Honestly, it felt like I could physically feel my brainwaves. That has never, ever happened to me before or after.",
 said=["Hagrid says to Harry: have you ever made anything happen when you were nervous or scared? Now, I'm curious to know if you have ever made anything happen when you were very angry or nervous or scared, because I have. And I don't think I really understood what was happening at the time."])

card("The scream next door", G3 + " · May 17, 2026",
 "I ran into Rebecca and we were having a pretty intense discussion, and it got to the point where I was just like, wow, I don't really know what to even say. I was getting pretty upset, actually. And then we heard this screaming from next door, almost like an autistic person having a tantrum — and that actually kind of reset the conversation.",
 "2026-05-16_2200_2026-05-17T05_00_07Z",
 caption="So I guess I'm wondering if that's sort of like the car accident thing. Did I cause that, or was it somehow put there for me, to calm us down — or maybe both?")

card("The homework extensions", G3 + " · May 22, 2026",
 "When I was younger I would work myself up — I could not finish my homework assignments on time, and I would work myself into a frenzy. And always, at the very last second, the homework would be postponed, or the teacher would give me an extension for no reason, or something would happen. There'd be a fire drill.",
 "2026-05-21_1709_2026-05-22T00_09_36Z",
 caption="I sort of just got this feeling like I was so lucky all the time. Things just kind of work out in my favor.")

# ── ANIMALS ───────────────────────────────────────────────────────────
G4 = "AN ANIMAL SAID IT FOR ME"
card("The snake on the hike", G4 + " · May 25, 2026",
 "I was once in a fight on a hike. We had ceased communication and I was trying very hard not to say anything, when suddenly there was a snake in my path. I automatically gasped. I had never seen a snake on that trail before. It was like the snake had sensed the venom between us and taken that opportunity to show itself. The gasp broke the silence, and in figuring out what to do about the situation, we forgot the fight.",
 "2026-05-25_1314_2026-05-25T20_14_45Z")

card("The Labrador at the vista", G4 + " · May 25, 2026",
 "By the time we reached the next vista, we were holding each other as we took in the scenery. Just then, someone's off-leash Labrador came ambling over and nuzzled our backs. It was like nature had sensed the change in our temperaments and presented a very different animal companion.",
 "2026-05-25_1314_2026-05-25T20_14_45Z",
 caption="From that point on, I started noticing how creatures took the shape of what I was thinking or feeling.")

card("The golden retriever and my dad", G4 + " · May 25, 2026",
 "When my dad was repeatedly, intentionally missing my point of view, a large golden retriever reared up on his hind legs while we were passing and growled at him. A moment where I'd normally feel helpless, unsure what to do — I suddenly felt powerful, as though the dog was expressing what I could not say. My dad did not take kindly to the suggestion. Incompetent owner, untrained dog. But the encounter had shaken him a little. I could see fear in his eyes.",
 "2026-05-25_1314_2026-05-25T20_14_45Z")

card("The Yorkie behind the fence", G4 + " · May 25, 2026",
 "An adorable Yorkshire terrier peeked out hopefully from behind a fence, on a walk with my mom where she was suddenly able to see my perspective. My mom, who doesn't really like dogs, remarked that she found him cute — indeed, that it was the first time she'd found a dog cute.",
 "2026-05-25_1314_2026-05-25T20_14_45Z")

card("The cat that wouldn't be petted", G4 + " · May 25, 2026",
 "The cat I often saw on my walk to Whole Foods would not be petted by my male companion, and I took that to mean he was not to be trusted.",
 "2026-05-25_1314_2026-05-25T20_14_45Z")

card("The rat under the table", G4 + " · May 25, 2026",
 "I was at dinner with an ex, and he was midstream telling one of his usual fancy tales when a rat ran under the next table. A moment ago I had been under his spell, thinking, maybe he's not such a bad guy. There was the universe, warning me so clearly and plainly that this man was a liar that I had to point it out to him.",
 "2026-05-25_1314_2026-05-25T20_14_45Z",
 caption="He was happy to hear about the dog nuzzling our backs, but did not believe in the snake or the rat.")

# ── SMALL SIGNS ───────────────────────────────────────────────────────
G5 = "SMALL SIGNS"
card("Three of Cups", G5 + " · Sep 30, 2021",
 "Last year I started receiving cups as presents. I got them from three friends — three in total, and they were all new friends. So I thought it was kind of weird, so I looked up three cups. Turns out it's a tarot card. And guess what it means?",
 "2021-09-29_2209_2021-09-30T05_09_37Z",
 caption="So I guess it's a sign. But just like, you're doing fine.")

card("The week of signs", G5 + " · Aug 11, 2026",
 "A self-love ring, in a tree, when trying to heal myself watching Smallville. It was right in the window where I'd been looking, after seeing the blue jay. A red robin came to me when I thought, it's my choice and I choose not. Then in the library I see every day, I saw The Red Badge of Courage. Surrender — the pink, on the only open table. And then I found that was the pink paper that mommy gave me.",
 "2026-08-11_0836_2026-08-11T15_36_26Z",
 caption="So I got a couple of signs from the universe and now I'm all high in a cloud. No, no, no. You best believe I'm a scientist at heart.")

card("The pen that came back", G5 + " · May 17, 2026",
 "I stole a pen, which was in my bag and got sauce on it, so the tip turned white and I thought it wouldn't write anymore. I was going to throw it away — and then this morning I saw it was black, and now it writes again.",
 "2026-05-16_2200_2026-05-17T05_00_07Z",
 caption="So that's confusing, huh?")

card("Nicodemus", G5 + " · May 7, 2026",
 "There's one episode of Smallville I thought I wanted to watch, called Nicodemus. I figured out which one it was. I remembered it too. And it will play every other episode but that one. It plays the two before. It plays every other disc. But it won't play that episode.",
 "2026-05-07_1441_2026-05-07T21_41_41Z",
 caption="I don't know why. I'd say I'm cursed. Something. How to get rid of it? I don't know.")

card("The Korsakov house", G5 + " · Jun 21, 2023",
 "I walked to the Korsakov house, which was very nice. But it was closed just on Tuesdays — which happened to be the day I was there.",
 "2023-06-21_0013_2023-06-21T07_13_59Z",
 caption="Okay, that's pretty much a coincidence.")

card("The seeds trivia", G5 + " · Jul 6, 2022",
 "I actually saw something unrelated about it on Instagram — that in the Middle Ages they were looking for where seeds came from. Did you see that? It was a trivia question. No, it was at work.",
 "2022-07-06_0108_2022-07-06T08_08_35Z",
 caption="That's a really weird coincidence. That's weird, because I also saw that.")

card("The Archer sex-ed class", G5 + " · Apr 29, 2024",
 "The synchronicity is that when I got home, my dad was telling me how he'd been talking to someone whose daughter had just been at Archer and had left because of what they were teaching them about sex — and of course that was exactly part of the scenario in the roleplay. Like, oh, where did you learn this? Oh, sex ed, whatever.",
 "2024-04-29_1010_2024-04-29T17_10_38Z",
 caption="Two coincidences that I wanted to record.")

# ── THE ONES YOU KEEP ALMOST TELLING ──────────────────────────────────
G6 = "THE ONES YOU KEEP ALMOST TELLING"
card("The meteorite", G6 + " · Jan 17, 2026",
 "I have never cursed anyone — I actually used to sell voodoo dolls, but I stopped because I was getting all this bad energy. Okay, so here's what happened. He came to my house, and… anyway, I have this meteorite. It's right here, it's in this case. And he gave it to me after I cursed him.",
 "2026-01-17_1627_2026-01-18T00_27Z",
 caption="I didn't tell anyone else for a while after that, thinking you might still come reclaim your meteorite.")

card("The witchcraft business", G6 + " · Jul 14, 2022",
 "The weirdest thing about my witchcraft business is that I started out just not believing in it. I literally started it as a joke. I was making all these silly products — Secretly a Witch Kit, Aspiring Alcoholics Anonymous, Baby's First BDSM Kit. And then I didn't realize that a bunch of people actually really liked witchcraft kits. But now I'm kind of like, wait a sec — maybe this stuff is kind of real.",
 "2022-07-14_1152_2022-07-14T18_52_50Z",
 caption="I call that being ironicized. Like when you do something ironically, and then it kind of becomes real.")

card("The one you won't tell", G6 + " · May 26, 2026",
 "One day this most mysterious magic overtook me once again. I played deer hunter and stayed up till six with some men I never saw again. What followed was the strangest series of coincidences that I dare not reveal, lest the reader begins to doubt the validity of my account. I now began to engage in these strange mishaps, always a lesson in being carried by the wind, as though they were my full-time job.",
 "2026-05-25_2030_2026-05-26T03_30_31Z",
 caption="The law of these missions was lack of doubt. No sooner had I to think, I know where this is going, and the whole series of steps would change its course.")

data = {
  "items": I,
  "voice": True,
  "browse": True,
  "states": [
    {"id":"yes","label":"Use it"},
    {"id":"maybe","label":"Maybe"},
    {"id":"no","label":"Skip"}
  ],
  "help": "Every card is your own telling, lifted verbatim from a voice memo and trimmed. The “?” holds more of what you said. The link at the bottom of a card plays the recording it came from. Heart the ones you want to use."
}
print(json.dumps({"chat":"suspicious-coincidences","session":"01BSZhgY25s1Qe5NqVGAztG5",
  "title":"Your suspicious coincidences v1 — 36 of them","template":"deck","data":data}))
