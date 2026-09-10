#!/usr/bin/env python3
# cards.py — THE SHOT LIST for the Nautchaug draft (2026-09-09), built OUT OF
# her script, never rewritten: every card's words are whole paragraphs of
# script.md lifted verbatim by paragraph index. "Main shots only" (her rule,
# 2026-09-09) — one card per scene, the shot that carries it; the B-roll and
# the synopsis/summary lines are named in LEFT_OUT, not dropped silently.
# The header lines under `mine` are the chat's and are labelled as such on
# the page (who is who by slot, the setting) — never a description of what is
# in a reference. Regenerate jobs.json:  python3 cards.py
import json, html, re
P = [l for l in open('script.md').read().split('\n')[4:]]   # paragraph i of the docx
def T(a, b=None):   # script.txt line numbers (the numbered read) → paragraphs, verbatim
    b = b or a
    return '\n'.join(P[a-5:b-5+1]).strip()

# Sophie's references (docs/mental-hospital/refs/stills.json). Atlas runs no
# real-person check on a still (measured 2026-09-09), so the PLAIN frames ride —
# the eyes-bar is only for ByteDance-direct doors and costs likeness.
SOPHIE_DRESS = ('Sophie — the jazz clip, in the dress', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/e0a3d5c8a24893877433083e2e4f9912.png')
SOPHIE_FACE  = ('Sophie — head-on (intake A)', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/40c4297c5ad31247083c19fee84d8275.png')
PJ_A  = ('the blue hospital pajamas — A', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/0e7139dc94a4418015ae6a692370be87.png')
PJ_C  = ('the blue hospital pajamas — C', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/e78b0b8ab03512e6fa28415b4ed422e7.png')
ROOM  = ('her room at the hospital', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/a26b474c31334b9e2b32d1d10b6ec5bc.png')
DINING= ('the dining room — ceiling and wall, no people', 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/1c9795c66026ee3374ab37bc6eb54b58.png')

# costume phases: 'dress' (episode one, the streets) · 'gown' (police / ER / holding — her text says a white gown with blue flowers) · 'pj' (the center — blue pajamas)
def card(key, title, ep, lines, cast, phase, setting=None, note=None, secs=4):
    text = T(*lines) if isinstance(lines, tuple) else '\n\n'.join(T(*l) if isinstance(l, tuple) else T(l) for l in lines)
    images = [SOPHIE_DRESS if phase == 'dress' else SOPHIE_FACE]
    mine = ['sophie is the woman in [Image1].']
    if phase == 'pj':
        images += [PJ_A, PJ_C]; mine[0] += ' she wears the blue hospital pajamas in [Image2] and [Image3].'
    if setting == 'room':
        images.append(ROOM); mine.append('setting: her room at the hospital, in [Image%d].' % len(images))
    elif setting == 'dining':
        images.append(DINING); mine.append('setting: the dining room at the hospital, in [Image%d].' % len(images))
    elif setting:
        mine.append('setting: %s.' % setting)
    return dict(key=key, title=title, ep=ep, secs=secs, status='waiting for go', text=text, mine=mine,
                images=images, cast=cast, note=note or '')

C = []
a = C.append
E1 = 'Episode one'
a(card('e1-01', 'The bus', E1, (16, 20), ['sophie', 'the bus driver', 'three passengers'], 'dress', 'a bus stop on a dusty road, Connecticut, late November'))
a(card('e1-02', 'Running to Wesleyan', E1, (24,), ['sophie'], 'dress', 'a grassy roadside, then the Wesleyan University sign'))
a(card('e1-03', 'Ro Sam across the street', E1, (25, 28), ['sophie', 'ro sam'], 'dress', 'a street near campus'))
a(card('e1-04', 'The gray house — Andreas at the door', E1, (29, 36), ['sophie', 'andreas'], 'dress', 'a small gray house with two pillars and green shutters'))
a(card('e1-05', 'Brenda comes home', E1, (37, 40), ['sophie', 'brenda'], 'dress', 'inside the house — the couch and the stairs'))
a(card('e1-06', 'Brenda and Sage on the couch', E1, (41, 52), ['sophie', 'brenda'], 'dress', 'the living room — the couch and the chair across from it'))
a(card('e1-07', 'Charlie and Brenda come home — she pretends to sleep', E1, (53,), ['sophie', 'charlie', 'brenda'], 'dress', 'the living room, the couch'))
a(card('e1-08', 'The dinner', E1, (55, 56), ['sophie', 'charlie', 'brenda'], 'dress', 'a restaurant table, night'))
a(card('e1-09', 'The storage unit — night one', E1, (58,), ['sophie', 'two hippies', 'charlie and alex on the phone'], 'dress', 'a Public Storage lot at dusk, then inside her unit'))
a(card('e1-10', 'Waking in the storage unit', E1, (61, 62), ['sophie'], 'dress', 'inside the storage unit — dark, then the door opens'))
a(card('e1-11', 'Leaving the storage unit — three pairs of pants', E1, (64,), ['sophie'], 'dress', 'the Public Storage lot, morning'))
a(card('e1-12', 'Up the hill, through the brambles', E1, [(65,), (67,)], ['sophie'], 'dress', 'a hill, then brambles'))
a(card('e1-13', 'The hipster on the path', E1, (68, 70), ['sophie', 'the hipster in the maroon hoodie'], 'dress', 'a campus path, early morning'))
a(card('e1-14', 'The tornado shelter — Brenda in the window', E1, (71,), ['sophie', 'brenda', 'charlie'], 'dress', 'the stairway shelter beside the gray house; Brenda\'s room above'))
a(card('e1-15', 'The search party', E1, (73,), ['charlie', 'about seven students'], 'dress', 'inside the house — Charlie in front of the group', note='no Sophie in this shot — image 1 is not attached'))
a(card('e1-16', 'The search party at the professor\'s house', E1, (75,), ['charlie', 'the search party', 'the man', 'his wife'], 'dress', 'a front door at night; the wife in the window', note='no Sophie in this shot — image 1 is not attached'))
a(card('e1-17', 'The closet — the poison bottle', E1, (78,), ['sophie'], 'dress', 'the science building — a supply closet'))
a(card('e1-18', 'Charlie finds the closet', E1, (81,), ['charlie'], 'dress', 'the library, the same closet, door ajar', note='no Sophie in this shot — image 1 is not attached'))
a(card('e1-19', 'The easy chair and the poster', E1, (83, 85), ['sophie', 'the bumbling professor'], 'dress', 'a comfy chair outside the library, then the old green books'))
a(card('e1-20', 'Police outside the library', E1, (86,), ['policemen'], 'dress', 'outside the library, night, rain', note='no Sophie in this shot — image 1 is not attached'))
a(card('e1-21', 'Whatchyou reading — chemistry', E1, (88, 91), ['sophie', 'the attractive policeman'], 'dress', 'the library stacks, then the hallway out'))
a(card('e1-22', 'In the police car', E1, (93, 94), ['sophie', 'two policemen'], 'dress', 'the back seat of a police car, rain'))
a(card('e1-23', 'Charlie in the raincoat — is she ok?', E1, (95, 103), ['sophie', 'charlie', 'the policemen'], 'dress', 'outside the library in the rain, seen through the car window'))

E2 = 'Episode two — the ER'
a(card('e2-01', 'Amber alert', E2, (107,), ['sophie', 'the policemen'], 'dress', 'the back seat of the police car'))
a(card('e2-02', 'The stretcher, the handcuffs, the ambulance', E2, (108, 110), ['sophie', 'the woman', 'the policemen'], 'dress', 'the street beside the police car, then the ambulance'))
a(card('e2-03', 'The evaluation — the questions', E2, (112, 121), ['sophie', 'the woman with the clipboard'], 'gown', 'a hospital room — she on the bed, the woman in a leather chair'))
a(card('e2-04', 'The evaluation — you are a very sick girl', E2, (122, 128), ['sophie', 'the woman with the clipboard'], 'gown', 'the same hospital room'))
a(card('e2-05', 'Night — eyes open above the blanket', E2, (130,), ['sophie'], 'gown', 'a hospital room at night, tungsten light from the hall'))
a(card('e2-06', 'The shower, the mirror, the crying', E2, (131, 133), ['sophie', 'the woman with the towel'], 'gown', 'a hospital bathroom — white and wood, blue linoleum'))
a(card('e2-07', 'Sex and the City — the man with the bandaid', E2, (135, 136), ['sophie', 'the man with the bandaid', 'the man with the short beard'], 'gown', 'her room, the TV far from the bed; the doorway'))
a(card('e2-08', 'The railing — the Nautchaug story', E2, (138,), ['sophie', 'the man with the bandaid'], 'gown', 'the holding-room hallway, a railing along the wall'))
a(card('e2-09', 'Better not to struggle — the needle', E2, (144,), ['sophie', 'the man with the bandaid', 'a nurse'], 'gown', 'the holding room'))

E3 = 'Episode two — the center'
a(card('c-01', 'Brought into the center', E3, (150,), ['sophie', 'staff'], 'pj', 'the intake room, a row of chairs'))
a(card('c-02', 'The game room — the diaries', E3, (151,), ['sophie', 'the pretty girl', 'the exuberant man', 'patients'], 'pj', 'the day room, a table of games'))
a(card('c-03', 'Brenda the occupational therapist', E3, (155, 156), ['sophie', 'brenda the OT'], 'pj', 'a hallway on the unit'))
a(card('c-04', 'The escape — the forest, the storm drain', E3, (158,), ['sophie', 'brenda the OT', 'staff', 'people in the lobby'], 'pj', 'the unit door, the lobby, the woods outside'))
a(card('c-05', 'The padded room', E3, (161, 170), ['sophie', 'the short nurse'], 'pj', 'a padded room'))
a(card('c-06', 'Andrew and the juice', E3, (174, 182), ['sophie', 'andrew', 'patients'], 'pj', 'dining'))
a(card('c-07', 'The fruit cart — are you a pirate?', E3, (183, 184), ['sophie', 'andrew', 'michael', 'staff', 'patients'], 'pj', 'dining'))
a(card('c-08', 'An armload of board games', E3, (187, 189), ['sophie', 'michael', 'andrew'], 'pj', 'a hallway into the quiet room, yoga mats'))
a(card('c-09', 'The board game — Sophenka', E3, (190, 191), ['sophie', 'michael', 'andrew'], 'pj', 'the day room floor around a board game'))
a(card('c-10', 'Sorry sir', E3, (192,), ['sophie', 'andrew', 'michael', 'the large nurse'], 'pj', 'the day room'))
a(card('c-11', 'The hallway kiss', E3, (202, 205), ['sophie', 'michael', 'the nurse', 'the nurses'], 'pj', 'the hallway, the nurses\' station down the hall'))
a(card('c-12', 'The doctor\'s office — my matchmaker', E3, (208, 215), ['sophie', 'the doctor'], 'pj', 'the doctor\'s office'))
a(card('c-13', 'Michael\'s plan to sue', E3, (218,), ['sophie', 'michael'], 'pj', 'the hallway'))
a(card('c-14', 'Group — trauma from childhood', E3, (220,), ['sophie', 'michael', 'the nurse', 'the group'], 'pj', 'a group room, chairs around a table'))
a(card('c-15', 'The boring meeting — hands under shirts', E3, (222,), ['sophie', 'michael', 'the group'], 'pj', 'a meeting room'))
a(card('c-16', 'The bananas', E3, (224,), ['sophie', 'michael'], 'pj', 'the snack table, a big plastic bowl'))
a(card('c-17', 'Andrew on the banister — the noose', E3, (227, 228), ['sophie', 'andrew'], 'pj', 'the hallway banister'))
a(card('c-18', 'The shower door', E3, (231, 232), ['sophie', 'andrew'], 'pj', 'the hallway outside a shower'))
a(card('c-19', 'Andrew — it makes me feel sick', E3, (235,), ['sophie', 'andrew'], 'pj', 'the hallway'))
a(card('c-20', 'Michael leaves — the bathroom doorway', E3, (239, 243), ['sophie', 'michael', 'the nurse'], 'pj', 'room'))
a(card('c-21', 'Andrew\'s number, Michael on the phone', E3, (245,), ['sophie', 'andrew', 'the old man'], 'pj', 'the unit door, then the phone room'))
a(card('c-22', 'The leopard-skin coat', E3, (248,), ['the man in the leopard coat', 'sophie'], 'pj', 'the day room, a rocking chair'))

E4 = 'Episode three — Nicolas'
a(card('n-01', 'Orange juice — Nicolas and the old teacher', E4, (256,), ['sophie', 'nicolas', 'the older gay man'], 'pj', 'dining'))
a(card('n-02', 'Peanut butters for poker', E4, (258,), ['sophie', 'nicolas', 'the older gay man'], 'pj', 'dining'))
a(card('n-03', 'Bitch — the punches', E4, (260, 265), ['sophie', 'the seventeen-year-old girl', 'a guard'], 'pj', 'the other room, crackers on the table'))
a(card('n-04', 'Gin rummy — it keeps coming up six', E4, (269, 270), ['sophie', 'nicolas', 'chelsea'], 'pj', 'dining'))
a(card('n-05', 'Alicia — I have ADHD', E4, (272,), ['sophie', 'alicia'], 'pj', 'the day room'))
a(card('n-06', 'The K2 joint', E4, (274,), ['sophie', 'nicolas'], 'pj', 'a corner of the hallway'))
a(card('n-07', 'The food line — the mattress tag', E4, (276, 283), ['sophie', 'nicolas', 'the criminal'], 'pj', 'dining'))
a(card('n-08', 'The hole in the window', E4, (285,), ['sophie', 'nicolas', 'the criminal'], 'pj', 'the rec room window'))
a(card('n-09', 'The plan', E4, (287,), ['sophie', 'nicolas', 'the criminal'], 'pj', 'a corner of the day room'))
a(card('n-10', 'The wife at the window — motherfucker', E4, (289, 290), ['the criminal', 'his wife', 'nicolas', 'sophie'], 'pj', 'the rec room, curtains drawn; the lot outside, a small white car'))
a(card('n-11', 'Every goddamn one — the baby powder', E4, (292, 293), ['sophie', 'nicolas', 'the criminal'], 'pj', 'an empty hallway'))
a(card('n-12', 'The bathroom — turn the water on', E4, (295, 296), ['sophie', 'nicolas'], 'pj', 'her bathroom, the shower running, steam'))

E5 = 'Episode five'
a(card('f-01', 'The bath — toilet paper on the drain', E5, (299,), ['sophie'], 'pj', 'her shower'))
a(card('f-02', 'Dr. Sugarman\'s office — she makes a fair point', E5, (302, 307), ['sophie', 'dr. sugarman', 'the assistant'], 'pj', 'the doctor\'s office'))
a(card('f-03', 'Praying to the wall', E5, (312, 314), ['sophie', 'the assistant'], 'pj', 'room'))
a(card('f-04', 'The phone — Charlie on the stairmaster', E5, (316, 324), ['sophie', 'charlie'], 'pj', 'the phone room; Charlie in a giant house'))
a(card('f-05', 'The phone — why didn\'t you visit', E5, (325, 331), ['sophie', 'charlie'], 'pj', 'the phone room, a rolling chair'))
a(card('f-06', 'You know who I\'d like to fuck', E5, (334,), ['sophie', 'the girl'], 'pj', 'the day room rug'))
a(card('f-07', 'Making fun of Shannon', E5, (336,), ['sophie', 'the gin rummy people', 'shannon'], 'pj', 'the hallway'))
a(card('f-08', 'The security camera', E5, (338, 340), ['sophie', 'nicolas', 'staff'], 'pj', 'the day room'))
a(card('f-09', 'Where is Nicolas', E5, (343, 348), ['sophie', 'the male nurse'], 'pj', 'the nurses\' desk'))
a(card('f-10', 'Sandy visits', E5, (358,), ['sophie', 'sandy'], 'pj', 'the visiting room, then the unit door'))

E6 = 'Episode 3.5 — Jake'
a(card('j-01', 'The religion meeting, and their own', E6, (364,), ['sophie', 'jake', 'the religion woman', 'the group'], 'pj', 'a meeting room, then a group in the hallway'))
a(card('j-02', 'Jake and the woman — alchemy', E6, (366,), ['sophie', 'jake', 'the woman with strange beliefs'], 'pj', 'the hallway'))
a(card('j-03', 'Jake\'s books, her game', E6, (368,), ['sophie', 'jake'], 'pj', 'the hallway, a pile of books'))
a(card('j-04', 'Walking to the dining hall — meds', E6, (370,), ['sophie', 'jake'], 'pj', 'the hallway toward the dining hall'))
a(card('j-05', 'Jake\'s wife is sixty', E6, (372,), ['sophie', 'jake'], 'pj', 'the hallway'))
a(card('j-06', 'Karen — someone hasn\'t been taking their meds', E6, (374, 376), ['sophie', 'karen'], 'pj', 'the meds window'))
a(card('j-07', 'The neon syringe', E6, (378, 381), ['sophie', 'jake', 'karen', 'the boy who writes poems'], 'pj', 'the hallway, Jake in a chair'))
a(card('j-08', 'I feel kinda weird — cleaning the dining room', E6, (382,), ['sophie'], 'pj', 'dining'))
a(card('j-09', 'Eight tea bags', E6, (384,), ['jake', 'sophie'], 'pj', 'the snack table, four drawers of tea'))
a(card('j-10', 'Something I shouldn\'t say', E6, (387, 389), ['sophie', 'jake'], 'pj', 'the hallway near the nurses\' station'))
a(card('j-11', 'Jake asleep', E6, (392,), ['sophie', 'jake'], 'pj', 'Jake\'s doorway, his legs in the bed'))
a(card('j-12', 'Todd', E6, (398, 399), ['sophie', 'todd'], 'pj', 'the hallway', note='her line as written; the model may refuse — a refusal is free'))
a(card('j-13', 'The bathroom — a very long time', E6, (402,), ['sophie', 'staff'], 'pj', 'her bathroom', note='her line as written; the model may refuse — a refusal is free'))

E7 = 'Adam'
a(card('a-01', 'Adam is escorted onto the unit', E7, (407,), ['adam', 'staff', 'sophie'], 'pj', 'the long hallway, Sophie at the far end'))
a(card('a-02', 'Watching him pace — plans to live together', E7, (409, 412), ['sophie', 'adam'], 'pj', 'the end of the hallway, juice and crackers'))
a(card('a-03', 'The methadone', E7, (414, 417), ['sophie', 'adam'], 'pj', 'the hallway'))
a(card('a-04', 'The corner kiss — behind the curtain', E7, (420,), ['sophie', 'adam', 'a nurse'], 'pj', 'room'))

E8 = 'Seamus, and the 1:1s'
a(card('s-01', 'Seamus — disgusting — the 1:1', E8, (424,), ['sophie', 'seamus', 'the older woman', 'the doctor', 'the graying 1:1'], 'pj', 'the day-room floor, the card table, the dining hall', note='several scenes in one paragraph — write `cut` on its own line to split it'))
a(card('s-02', 'Brenda\'s depression talk — the cat', E8, (426, 429), ['sophie', 'brenda the OT', 'the group'], 'pj', 'a meeting room'))
a(card('s-03', 'Karen, the horse pills', E8, (431,), ['sophie', 'karen', 'dr. sugarman'], 'pj', 'the meds window, then her room'))
a(card('s-04', 'The 1:1 who ran after her — wiping pills on the sheet', E8, (432,), ['sophie', 'the 1:1'], 'pj', 'room'))
a(card('s-05', 'The army 1:1', E8, (433,), ['sophie', 'the army 1:1'], 'pj', 'the hallway'))

E9 = 'Sabrina'
a(card('sb-01', 'Two nurses bring Sabrina', E9, (436,), ['sophie', 'sabrina', 'two nurses'], 'pj', 'room'))
a(card('sb-02', 'The chalkboard, the ring', E9, (438, 440), ['sophie', 'sabrina'], 'pj', 'room'))
a(card('sb-03', 'The bananas, the chalk', E9, (442, 443), ['sophie', 'sabrina', 'the fruit lady', 'a male nurse', 'jake'], 'pj', 'room', note='several scenes in one paragraph — write `cut` on its own line to split it; the model may refuse — a refusal is free'))
a(card('sb-04', 'Sabrina on the phone', E9, (445,), ['sabrina', 'sophie'], 'pj', 'the phone room'))

E10 = 'The finale, and the rest'
a(card('x-01', 'Alpha on the phone — the pretend hospital', E10, (451,), ['sophie'], 'pj', 'the phone room'))
a(card('x-02', 'Lunch date beside the trash can', E10, (455,), ['sophie', 'patrick'], 'pj', 'dining'))
a(card('x-03', 'Andrew\'s confession', E10, (463,), ['sophie', 'andrew'], 'pj', 'the hallway'))
a(card('x-04', 'Don\'t tell anyone', E10, (465,), ['sophie', 'the man who sits in on meetings'], 'pj', 'a meeting room'))
a(card('x-05', 'Risperdal', E10, (469,), ['sophie', 'the doctor'], 'pj', 'the doctor\'s office, night'))
a(card('x-06', 'The printer paper', E10, (471, 480), ['sophie', 'the man behind the desk'], 'pj', 'the nurses\' desk, then her room floor'))
a(card('x-07', 'Staring into space', E10, (483,), ['sophie', 'staff'], 'pj', 'outside, an uncomfortable chair'))
a(card('x-08', 'The silver fox — conspiracy theories', E10, (486,), ['sophie', 'the silver-haired staff man'], 'pj', 'dining'))
a(card('x-09', 'The sleepover', E10, (488,), ['sophie', 'nicolas', 'the red-haired man'], 'pj', 'the day room, cards'))
a(card('x-10', 'The headsets — Katy Perry', E10, (490,), ['nicolas', 'the man in the leopard coat', 'patients', 'sophie'], 'pj', 'the hallways'))
a(card('x-11', 'The English accent', E10, (492,), ['sophie', 'the physics professor on the phone'], 'pj', 'the phone room'))
a(card('x-12', 'A whole facility — the Airbnb', E10, (494, 495), ['sophie', 'the man'], 'pj', 'the unit door, then outside it'))
a(card('x-13', 'The blonde nurse — you\'ll do great', E10, (497,), ['sophie', 'the blonde nurse'], 'pj', 'the hallway bench'))
a(card('x-14', 'You should smile more', E10, (499,), ['sophie', 'dr. sugarman'], 'pj', 'the hallway'))
a(card('x-15', 'Her brother on the phone', E10, (501,), ['sophie'], 'pj', 'the phone room'))
a(card('x-16', 'Out the doors — the snow, the lake', E10, (503,), ['sophie'], 'pj', 'the hospital doors into blinding sun; snow; the lake; the car'))
a(card('x-17', 'Tracy — Sade', E10, (505,), ['sophie', 'tracy'], 'pj', 'the hallway to the phone'))
a(card('x-18', 'The manila folder', E10, (508, 509), ['sophie', 'the man with the folder'], 'pj', 'the day room'))
a(card('x-19', 'We\'re going to Pendleton — hiding in the wall', E10, (513, 514), ['sophie', 'debra', 'a guard'], 'pj', 'the day room, then Debra\'s room at night'))
a(card('x-20', 'The watch, the pudding', E10, (516,), ['sophie', 'the roommate', 'staff'], 'pj', 'room'))
a(card('x-21', 'Be careful who you tell', E10, (520,), ['sophie', 'the pregnant girl', 'the guard'], 'pj', 'the team room, then the desk'))
a(card('x-22', 'The hole in the wall, the doctored soup', E10, (523, 524), ['sophie', 'nicolas'], 'pj', 'dining'))
a(card('x-23', 'Can\'t sleep — the Yale art professor', E10, (527, 531), ['sophie', 'the lanky gray-haired man', 'the nurse'], 'pj', 'the hallway at night'))
a(card('x-24', 'Going outside — the closet, Tracy', E10, (533,), ['sophie', 'tracy', 'the man'], 'pj', 'the coat closet by the unit door'))
a(card('x-25', 'The fake ring', E10, (535,), ['sophie', 'patrick'], 'pj', 'dining'))
a(card('x-26', 'Nicolas at the doctor\'s door — the cheer', E10, (538,), ['nicolas', 'sophie', 'patients', 'the doctor'], 'pj', 'the hallway outside the doctor\'s door'))

LEFT_OUT = [
  'the title, the synopsis and every "summary:" / "synopsis:" line (lines 5–12, 138 is kept as the Nautchaug story, 254, 354–355)',
  'the bus-ride B-roll — Thanksgiving talk, the dreary countryside, "dirty dirty dirty buildings" (line 22) — and CREDITS/THEME SONG',
  'the flashback directions (lines 60, 66), the campus repeat of the hipster scene (line 74), the "cut to" / "CUT TO" lines',
  'the reminder lines with no scene in them — "charlie" (359), the Jake/Adam timing note (393), the "EPISODE WHATEVER" lists (251, 453, 457–461, 467, 511)',
]
json.dump(C, open('jobs.json', 'w'), indent=1, ensure_ascii=False)
json.dump(LEFT_OUT, open('left-out.json', 'w'), indent=1, ensure_ascii=False)
print(len(C), 'cards;', sum(len(c['text']) for c in C), 'characters of her words')
for c in C:
    assert c['text'], c['key']
    if len(c['text']) > 1900: print('LONG', c['key'], len(c['text']))
