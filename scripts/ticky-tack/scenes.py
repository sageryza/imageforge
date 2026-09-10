#!/usr/bin/env python3
"""The Ticky Tack film — the scenes page.

The twin of the Nautchaug scenes page (`The Nautchaug Boyfriend's — the scenes
v2`), which was built in a chat's container and never committed — so when its
fix landed, nothing could carry it. This one lives in the repo.

RED, not beige (2026-09-10, Sophie: "duplicate this page for the ticky tack
film but make the buttons red"). Same 3-D key: a flat face over one flat
darker wall, outlined, no gradient anywhere — only the palette moved.

One button a scene, in her own shooting order off `docs/ticky-tack/shot-list.md`.
A tap opens that scene's card on the draft belt (`belt.py`), the way the Nautchaug
scenes page opens onto its own — so the two pages are one thing: the index and the
cards it indexes.

    python3 scripts/ticky-tack/scenes.py            # write the html, don't post
    python3 scripts/ticky-tack/scenes.py --post     # post it into the chat
    python3 scripts/ticky-tack/scenes.py --post --supersede <id>
"""
import json, os, sys, html, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = json.load(open(os.path.join(HERE, 'icons.json')))
BASE = 'https://imageforge-q125.onrender.com'
CHAT = 'ticky-tack-film-page-dupe'
TITLE = "Ticky Tack — the scenes v2"
# The draft belt this page opens onto — a tap lands on that scene's card.
BELT = "MuKbzI8nmZVVbFdBnVxB"

# (section, [(number, word, icon, the scene in her own shot-list words)])
SCENES = [
 ("Shoot first — the climax", [
  ("1","pill","pill","The Rite Aid — Adam in the convertible with the prettier girl; the last pink box on a high shelf; tearing it open by the water fountain; the pill on her tongue while the girl in the grey vest stares; “God takes back”; she swallows it dry; caught, the small scene at the counter, the $18."),
  ("2","bus","bus","The bus stop — free fries at McDonald’s, she doesn’t go in; the bus, four policemen board, “she’s wearing a red dress,” she glides out the door; the tan coat thrown down; the gravel; the stairs."),
  ("3","doors","door-open","Alex and Alex — five brown doors, the last one opens; the closet full of soft clothes; “I was raped”; tea, the chihuahua, the Victoria’s Secret postcard “You’ve reached the next level”; the silver car home."),
  ("4","room","bed","Home — the tiny blue room, the foam slab; Jon’s party downstairs; she gets up and goes back out for Thomas."),
  ("5","reunion","heart-handshake","The reunion — Thomas hunched in the alcove outside Whole Foods, “Oh hi”; the 44 back; her porch, Jon’s friends; the cardboard over them under the window, the sliver of moon. “And then we take the 44 bus going the right way.”"),
 ]),
 ("Shoot next — the two beginnings", [
  ("6","billboard","signpost","The very beginning — the 44 going the wrong way; alone under the two fluorescents; running down the winding road; the billboard “god takes back he who disobeys” (and the abortion one two metres on)."),
  ("7","thomas","smartphone","Meeting Thomas — the pale boy with two black bags; “Can I use your phone?” “No.”; “Not one goddamn person”; “I’ve been thinking of ending things”; “me too, me too” under her breath; the intersection lights; the power box, eyes shut; his hand on her arm; under the tree, “I love you.”"),
 ]),
 ("Five moments with Thomas that must stay", [
  ("8","morning","sunrise","The morning after — the man in the suit, the police car with no siren, “Homeless people are lazy,” they walk off hand in hand."),
  ("9","dress","shirt","The $5 dress — the woman with the crisp bill, the $5 bin, and Thomas pulls the black dress on, pale shoulders going pink in the sun."),
  ("10","ducks","bird","The ducks — the pond at dusk, and the one line: “You seem to be… picking up on… all the signs you’re given.” Her favourite moment ever."),
  ("11","boxes","boxes","Ticky Tack — behind the metal box she finally pees; Thomas singing “little boxes” at the houses on the hill; the title, and the thesis."),
  ("12","christmas","gift","Christmas morning — he tells her the image she said no to (the presents, the parents on the stairs, the gun); the afternoon goes grey."),
 ]),
 ("Hers, must stay", [
  ("13","choke","hand","The choke — his wrists round her throat, “imagine this,” no squeeze; the orange he doesn’t share. Short."),
  ("14","powells","library","Powell’s — the bench, the bathroom mirror doll (“sign the bottom of my foot”), the man in the black vest: leave. Short."),
  ("15","crash","car-front","The car accident — her arms piled with yard-sale things; his rant drilling into her; the crash; the teenager and the old couple; she leaves the rug and the string on the wall."),
  ("16","egg","egg","The raw egg — the man with the carton in front of the co-op; “You can eat them raw”; she does; the barrette and the lucky penny."),
  ("17","orange","flag","The orange trail — the crossing guard, the crows going every way; she switches from black to orange; priuses, shorts, socks; the orange flags behind the caution tape. “I had won.”"),
  ("17a","glasses","glasses","The red dress — Lana Del Rey in the bougie store, “nothin scares me anymore”, the pointy sunglasses in the too-tiny mirror; she plots it, calm in the sun."),
  ("17b","train","train-front","The train — the old above-ground train at dark, the tracks and the telephone lines upside down; the three travellers and “the Black.”"),
  ("17c","needle","syringe","The Black — the park bathroom; the girl sobbing on the grass; his clothes laid out as a bed; the needle, fourteen times; the curb she steps off and back onto; the man who leaves her at the fan; the pregnancy dawns."),
  ("17d","slap","hand-coins","The slap — begging for $40; the two boys at their door; the slap, the other one’s three dollars."),
  ("17e","chair","accessibility","The wheelchair — the loose wheelchairs outside St. John’s; she wheels herself into the night; the little library, the gilded scrapbook, “Sophie’s book of mistakes”; the morning outside Planned Parenthood."),
 ]),
 ("Secondary — recommend keeping", [
  ("18","hotel","hotel","The hotel — the red hotel lobby, the fake room number, the black frozen couches, walking back out with the “luggage.”"),
  ("19","voter","vote","The voter man on the train — Thomas writes his name; she learns it."),
  ("20","winning","ticket","The Winning Spot — “come back when you have money”; Thomas curled up as a ball, “I’m feeling extremely anxious”; the woman with the $5."),
  ("21","pizza","pizza","The free pizza — the bags checked with little white tags; the To Do List pad; the coke on the cement pillar and the paralysis in the lot."),
  ("22","float","ghost","The night she floats — Thomas asleep under his coat, she crosses the street like a ghost, the two men order her off, she runs back into his arms."),
  ("23","coffee","coffee","The coffee — the McDonald’s coffee a woman hands her, Thomas dumps it in the bushes. “We have to get out of town.”"),
  ("24","dare","dices","The bus dare — the bar crawl of sips, the bus barrelling and she is told not to move; the wet leaves; Thomas thinks she was running off."),
  ("25","tracks","train-track","The leaving and the catching — she walks away at the co-op, he catches her under the bridge; the train tracks, “you’re the one”; that night she slips out to her old house and takes the girl’s underwear."),
  ("26","baby","baby","“Have a baby?” / “have sex?” on the yellow couch-thing."),
  ("27","juice","cup-soda","The juice — stolen, the man’s voice, the hill of trash: “It was worth it, though.”"),
  ("28","split","split","The split — the shelter, the bar and Mein Kampf, the fortune teller with the weed, she walks and doesn’t wait; the scissors; the hoodlums under the awning; the lit-up alcove. (This is how Part III starts and can’t be cut.)"),
  ("30","toms","users","The two Toms — the peanut butter aisle without him; the sous-chef; Thomas materialises; “I’ll see you tomorrow.”"),
  ("31","taxi","car-taxi-front","The taxi — the ride she bargains through, dumped by the freeway."),
 ]),
 ("Montage / can go", [
  ("32","bench","armchair","The bridge bench, falling slowly together; Africa and ayahuasca."),
  ("33","fries","utensils","French fries; Thomas calls his mother."),
  ("34","pens","pen-line","The little American flag on the train; the fabric store; the pens; the pigeons off the building."),
  ("35","humming","music-2","“Nice Dream” hummed on the walk."),
  ("36","tree","tree-deciduous","The man in the dark about blankets; the tree as a time machine."),
  ("37","dancing","party-popper","The bus with the two transfer men; the dancing woman."),
  ("38","noodles","soup","The Chinese restaurant’s unclaimed noodles; the truck of bananas."),
  ("39","pee","droplet","The pee attempts (the lawn mower, the pickup truck, “good job”)."),
  ("40","chemicals","flask-conical","The chemicals rants (“ammonium with nitric acid?”) — a running sound."),
  ("41","statue","landmark","The statue gold; the food cart feast; the green van chase."),
  ("42","peanut","nut","Peanut butter samples, the spoons taped to the cup, red and blue money."),
  ("43","books","book-open","The jeep and the books; the tarp and the three women."),
  ("44","scraps","shapes","The golf bag; froot loops; beef jerky and the cat; “you two sure are lazy”; car colours on the curb; the festival; the fries pantomime; the sauerkraut fence; the crystal."),
 ]),
]

CSS = """
:root{--cols:5;
  /* RED (2026-09-10, her ask). Same structure as the beige twin: one flat face,
     one flat darker wall under it, one outline. The lettering is CREAM here
     rather than near-black — measured against the face, dark ink on this red
     is about a third of the contrast the beige tile gives its ink, and the
     label renders at ~8px on a 55px tile. */
  --red:#d5372c;--edge:#8f2119;--tileink:#3a0e08;--tiletext:#f7f0e2}
/* THE GRID ENDS BEFORE THE PILL'S COLUMN. The injected autoscroll pill is
   position:fixed in the top-right (x~326-374, y 14-197 at 390pt), so every row
   passes under it on the way up — and every cell here is a tappable control,
   so the whole grid stops 64px short rather than only its first row. */
.grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:11px 6px;margin-right:64px}
.b{container-type:inline-size;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
   background:var(--red);border:1.5px solid var(--tileink);border-radius:8px;color:var(--tiletext);text-decoration:none;padding:2px;-webkit-tap-highlight-color:transparent;
   box-shadow:0 3px 0 var(--edge),0 3px 0 1.5px var(--tileink)}
/* PRESSED = the tile drops onto its own shadow. No gradient anywhere. */
.b:active{transform:translateY(3px);box-shadow:0 0 0 var(--edge),0 0 0 1.5px var(--tileink)}
.b svg{width:20px;height:20px;width:36cqw;height:36cqw;display:block;color:var(--tiletext)}
.b span{font:700 8px/1 -apple-system,'Helvetica Neue',sans-serif;font-size:15cqw;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;color:var(--tiletext)}
.ep{grid-column:1/-1;font:700 10px/1.2 -apple-system,'Helvetica Neue',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin:14px 0 0}
.ep:first-child{margin-top:2px}
"""

HELP = ("<p><b>Every scene that has to be shot, in the order you said to shoot "
        "them.</b> One button a scene: its own word, and a tap opens that "
        "scene's card on the draft belt — the passage it comes out of, your box "
        "for the shot, the seconds, and Send to Footage. Nothing here sends "
        "anything.</p>"
        "<p>Five to a row; the number is <code>--cols</code>.</p>")


def build():
    e = html.escape
    rows = []
    for section, items in SCENES:
        rows.append('<p class="ep">%s</p>' % e(section))
        for num, word, icon, text in items:
            lab = '%s · %s' % (num, text.split(' — ')[0].split(';')[0])
            rows.append(
                '<a class="b" href="/api/chatfeed/page/%s#j-tt-%s" aria-label="%s" title="%s">'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>'
                '<span>%s</span></a>' % (BELT, e(num), e(lab), e(lab), ICONS[icon], e(word)))
    return (
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="stylesheet" href="/compare.css">\n'
        '<style>%s</style>\n'
        '<div class="wrap">\n<h1>%s</h1>\n'
        '<div class="grid">%s</div>\n'
        '</div>\n'
        '<script src="/compare.js"></script>\n'
        '<script>\n(function(){\n'
        '  window.__compareHelp({html:%s});\n'
        '})();\n</script>\n'
    ) % (CSS, e(TITLE), '\n'.join(rows), json.dumps(HELP))


def post(body, supersede=None):
    req = urllib.request.Request(
        BASE + '/api/chatfeed/page',
        data=json.dumps({'chat': CHAT, 'title': TITLE, 'html': body}).encode(),
        headers={'content-type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req).read())
    print(json.dumps(out, indent=1))
    if supersede:
        r2 = urllib.request.Request(
            BASE + '/api/chatfeed/page/%s/supersede' % supersede,
            data=b'{}', headers={'content-type': 'application/json'})
        print(urllib.request.urlopen(r2).read().decode())
    return out


if __name__ == '__main__':
    body = build()
    out = os.path.join(HERE, 'scenes.html')
    open(out, 'w').write(body)
    print('%s  %d bytes  %d scenes' % (out, len(body), sum(len(x[1]) for x in SCENES)))
    if '--post' in sys.argv:
        i = sys.argv.index('--supersede') if '--supersede' in sys.argv else -1
        post(body, sys.argv[i + 1] if i > 0 else None)
