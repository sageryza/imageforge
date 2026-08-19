#!/usr/bin/env python3
"""Build the hand-off zip: the picked games, their settled rules, one image each.

Deliberately carries NOTHING else — no project context, no chat or person
names, no attributions, no version history. Game names, rules, pictures.

    python3 docs/weird-games-book/bundle/build-bundle.py [outdir]
"""
import os, shutil, sys, zipfile

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ART = os.path.join(REPO, 'docs/weird-games-book/art')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/weird-games-bundle'

# (game name, image file, rules) — image repeated where two games share a picture.
GAMES = [
 ("Meet in the Middle", "meet-in-the-middle-v3.webp",
  "The house goes completely dark. Everyone takes a lit candle and a different "
  "starting spot, then moves through the house until, inevitably, everyone "
  "converges. There is a prize, and terms are negotiated in advance."),

 ("Loud Elevator", "loud-elevator-v1.webp",
  "Be as loud as possible in the elevator — stomping, hollering — and the instant "
  "a stranger steps in, total silence. Resume the moment they step off."),

 ("Threshold", "threshold-v3.webp",
  "See how close you can get to needing to pee without actually peeing. Played in "
  "a halfhearted semicircle on a dark balcony at night, beer pong going on behind."),

 ("Nice to Meet You", "nice-to-meet-you-arcade-v2.webp",
  "At any recurring-strangers event, greet the same people warmly every single "
  "time as if meeting for the first time: handshake, “hey, nice to meet you.” "
  "If they ask “how are you,” the only legal answer is “good, how are you” — which "
  "loops. Original venue: a dark arcade bar, glowing machines on the periphery, "
  "played on strangers who were introducing themselves over and over anyway."),

 ("The Search", "the-search-v2.webp",
  "Solo. Go into a supermarket and ask staff to help you find a very specific item "
  "that does not exist. Your score is the number of employees involved in the "
  "search. Record to beat: three."),

 ("Not Drowning", "not-drowning-v2.webp",
  "Pool game. One player pretends to be drowning (“help me!”); everyone rushes over "
  "in maximum concern — “oh my gosh, are you OK?!” — whereupon they turn out to be "
  "completely fine. Then it’s someone else’s turn to drown."),

 ("Groundhog Day", "groundhog-day-high-v1.webp",
  "A party that restarts from the top every hour. Everyone must remember what they "
  "said, who they talked to, and what they did, and do it again — exactly. Some "
  "guests know the night is looping; some don’t, and whatever they got stuck doing "
  "in hour one is now their whole night. Prompting other players with their own "
  "lines is legal and eventually necessary."),

 ("Pooping Partners", "pooping-partners-v1.webp",
  "You and your partners text each other when you’re pooping. That’s the game."),

 ("Group Dream Journal", "group-dream-journal-v1.webp",
  "A shared document where everyone writes their dreams. You can read everyone "
  "else’s dreams, but you don’t always know whose dream you’re reading — and "
  "sometimes people you know talk to you inside their dreams, so you find out what "
  "your friends’ versions of you have been up to."),

 ("Menu Roulette", "regulars-v1.webp",
  "Everyone orders for the person to their left. No vetoes; whatever arrives is "
  "yours.\n\n(Shares its illustration with The Anniversary.)"),

 ("The Anniversary", "regulars-v1.webp",
  "Inform the staff it’s a special occasion that makes no sense — “our "
  "three-and-a-half-month friendaversary” — and see what the restaurant does.\n\n"
  "(Shares its illustration with Menu Roulette.)"),

 ("Reunions", "nice-to-meet-you-v1.webp",
  "Greet strangers as long-lost friends and commit until they “remember” you.\n\n"
  "(Shares its illustration with Diplomats.)"),

 ("Diplomats", "nice-to-meet-you-v1.webp",
  "Introduce your friend to everyone with escalating invented titles.\n\n"
  "(Shares its illustration with Reunions.)"),

 ("Tourists", "tourists-v1.webp",
  "Be tourists in your own neighborhood. Photograph the mailbox. Consult an "
  "enormous map. Ask a local for directions to the street you are standing on. Buy "
  "a souvenir from the corner store and treat it like a treasure."),

 ("Getaway Driver", "getaway-driver-v1.webp",
  "Every errand is a heist. One friend waits in the car with the engine running "
  "while the others hit the grocery store for the milk. Low voices, synchronized "
  "watches, walking fast without running. The debrief happens at the safehouse."),

 ("First Date", "first-date-v1.webp",
  "Two old friends go to dinner and play it as a first date: the nerves, the good "
  "shirt, the questions they already know the answers to (“so… do you have "
  "siblings?”). Falling out of character loses; so does answering like someone who "
  "knows."),

 ("The Critic", "the-critic-v1.webp",
  "One guest reviews the evening in real time — the tap water (“assured, mineral, "
  "cold”), the couch (“ambitious”), the host’s playlist — with a tiny notebook. The "
  "host must not defend anything."),

 ("Border Control", "border-control-v1.webp",
  "The kitchen doorway is an international border and one friend is the officer. "
  "Every crossing needs a purpose of visit, a declaration of goods (chips), and an "
  "arbitrary inspection. Smuggling is punished by escalating paperwork. Guests "
  "carry paper passports, stamped at every crossing."),

 ("The Inheritance", "the-inheritance-v1.webp",
  "On arrival everyone puts one pocket item in a bowl. At the end of the night, a "
  "solemn candlelit reading of the will redistributes them to different people — "
  "you never get your own item back (“to you I leave… this lip balm. Use it "
  "well”). Eulogies encouraged, never required."),

 ("Heavy Object", "heavy-object-v1.webp",
  "The group adopts a large object — a rock is traditional — and it comes to "
  "everything: brunch, the movies, the beach. Rituals accrue around it: how it is "
  "greeted, where it sits, who carries it, what happens on its birthday. "
  "Outsiders’ questions are answered with more ritual."),

 ("Elevator Pitch", "elevator-pitch-v1.webp",
  "Whenever two people end up alone together — the kitchen, the hallway, the porch "
  "— one must immediately begin pitching the other an invented business, and must "
  "keep pitching until someone else arrives. Investment is optional but binding."),

 ("Remember the Ferry", "remember-the-ferry-v1.webp",
  "One friend invents a shared memory — “remember the ferry?” — and everyone builds "
  "on it: the weather, who got seasick, the thing the captain said, until it feels "
  "real. It is retold at the next gathering as fact. Invented relationships count "
  "too."),

 ("The Ceremony", "the-ceremony-v1.webp",
  "Choose something mundane — opening a bag of chips, plugging in a phone — and "
  "give it everything: a procession, candles, vows, witnesses, a moment of silence. "
  "It only counts if everyone keeps a straight face; whoever laughs officiates next "
  "time."),

 ("Shipwreck", "shipwreck-v1.webp",
  "The floor is the sea, and every twenty minutes a timer sinks another piece of "
  "furniture (no appeals). Whoever is on a sinking piece must reach surviving "
  "furniture without touching water. The game ends with the entire party on one "
  "armchair — or with someone in the sea."),

 ("Sleep Race", "sleep-race-v1.webp",
  "First person to genuinely fall asleep at the party wins. Everyone else may keep "
  "them awake by any means except touching them. Faking disqualifies; snoring is "
  "accepted as proof."),

 ("The Interpreter", "the-interpreter-v3.webp",
  "Two people are declared mutually unintelligible for the night. They may not "
  "speak at all — they communicate only in gestures — and a third person sitting "
  "between them says out loud what they are “saying”. The interpreter’s "
  "translations are final."),
]

COVER = "cover-high-v1.webp"


def slug(name):
    return ''.join(c if c.isalnum() else '-' for c in name.lower()).strip('-').replace('--', '-')


def build():
    stage = os.path.join(OUT, 'weird-games')
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(os.path.join(stage, 'images'))

    shutil.copy(os.path.join(ART, COVER), os.path.join(stage, 'images', '00-cover.webp'))

    lines = ['WEIRD GAMES TO PLAY WITH FRIENDS', '', 'Cover illustration: images/00-cover.webp', '']
    for i, (name, img, rules) in enumerate(GAMES, 1):
        dest = f'{i:02d}-{slug(name)}.webp'
        shutil.copy(os.path.join(ART, img), os.path.join(stage, 'images', dest))
        lines += [f'{i}. {name.upper()}', '', rules, '', f'Illustration: images/{dest}', '', '—' * 3, '']

    with open(os.path.join(stage, 'games.txt'), 'w') as f:
        f.write('\n'.join(lines).rstrip() + '\n')

    zpath = os.path.join(OUT, 'weird-games.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(stage):
            for fn in sorted(files):
                p = os.path.join(root, fn)
                z.write(p, os.path.relpath(p, OUT))
    print(f'{len(GAMES)} games + cover -> {zpath} ({os.path.getsize(zpath)//1024} KB)')


if __name__ == '__main__':
    build()
