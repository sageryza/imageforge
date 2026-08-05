# IN THE HOSPITAL — watercolor film shot list (v1)

A shot list for a ~20-minute short film of Sophie's story **"In the Hospital"**
(the ~3,000-word manuscript in Drive: "in the hospital" / "Copy of in the
hospital"). Narrated at a gentle pace, 3,000 words runs right around 20
minutes — 91 core shots means each picture holds ~13 seconds. Cut, hold, or
re-roll freely; the numbering is chronological with the text.

## Prompt rules from Sophie (Aug 2026 — do not break these)

- **NEVER describe anything you are already attaching an image of.** If a
  character reference is attached, the prompt says "the girl" and nothing
  else — no hair colour, no build, no "short wavy brown hair". Describing it
  in words fights the picture and lets the model drift toward the words.
  This was broken once: the character line read "the woman with short wavy
  brown hair", which is exactly the thing the attached photo was there to
  say.
- **Do not add "same face and same hair"** (or any preserve-list wording) when
  a character reference is attached. It over-weights the face and hair
  specifically instead of letting the whole reference carry.
- **Say what people are WEARING when their role matters.** A prompt that says
  "three nurses" in a hospital scene gets three women in the same blue
  patient pajamas as everyone else — name the uniform ("nurses in scrubs, not
  patient pajamas") or the scene reads wrong.
- **Never invent a prop.** Every object in a prompt has to be traceable to a
  line in the manuscript. The soup containers, masking tape, butter pats and
  sugar packets are all verbatim from the story — check before adding
  anything that isn't.

## Production notes (learned the hard way, Aug 2026)

- **Every prompt must say it is a drawing.** `wtr` alone at `lora_scale 1` does
  NOT beat Flux's photographic prior when the sentence reads like a photo
  brief — the first character-reference run came back as glossy photographs of
  a woman in pajamas. Prefixing the content with **"an ink and watercolor
  drawing of"** and running **`lora_scale 1.2`** fixes it completely. Keep both.
- **The 2x2 grid trick works, with a caveat.** Asking for "a comic page of
  exactly four rectangular panels in a two by two grid, every panel fully
  enclosed by a heavy hand-drawn black ink rectangle border, wide clean white
  gutters" reliably produces four separate, sliceable panels — and, because the
  panel-border language forces illustration, those runs never came out
  photographic. Soft wording ("a two by two grid of four comic panels") is
  unreliable: one test lost its borders entirely and merged two panels.
  Generate grids at **4:3** so each sliced panel lands closest to the film's
  aspect. `scripts/hospital-film-gen.js` slices at exact quarters with a 3.5%
  inset; panel art occasionally bleeds past a gutter and mis-cuts.
- **Grids barely save money on THIS style.** A single WTR image is ~1.2¢, so all
  91 shots cost ~$1.10 as singles vs ~28¢ as grids — under a dollar saved, and
  a sliced panel is 544x416 against 832x1216 for a single (a quarter of the
  pixels, landscape instead of portrait). Draw the film as singles. The grid
  trick is worth real money on the gpt-image-2 styles (~6¢ an image) and is
  worth keeping for pages where a comic grid is the intended look.

## How to produce these

- Playground, **WTR** style: https://imageforge-q125.onrender.com/playground?style=watercolor
- Each line's prompt (the part after the em dash) is the **whole thing to
  paste** — the WTR trigger word and suffix are added server-side, so these are
  content only. One tap = one image; ×3 draws the LoRA-scale ladder when a shot
  needs options.
- **Character consistency:** the WTR style has no character reference, so the
  cast is kept consistent by repeating the same description words in every
  prompt, verbatim:
  - the narrator: "a thin girl with long dark hair in sky blue hospital pajamas"
  - Francesca: "a heavyset older woman with long graying dark hair"
  - Laura: "a pale sad woman with very long flowing hair"
  - Mayra: "a small young woman with short black hair"
  - Dr. Grim: "a stern doctor in a dark purple checkered shirt and black suit pants"
  Swap the narrator's hair line in every prompt if you want her to look more
  like you (find-and-replace works since the wording is identical everywhere).
- Hearted keepers land in the Scratch Pad inbox automatically → place them as
  beats in a story pad → record/TTS your narration per beat → the pad's play
  button stitches the film for free.
- Cost: a LoRA image is well under a cent — the whole list with generous
  re-rolls stays under a couple of dollars.

## Cold open

1. cold open — an empty hospital corridor at dawn in pale blue-gray light, a single pair of white socks left in the middle of the floor

## Chapter One — introduction

2. wilted rooms — a hospital room where the walls sag and droop like wilting flower petals, a low wooden bed, gray-green wash
3. the food — a hospital food tray seen from above: moldy bread, gray meat, and a paper cup of blue cleaning liquid with a straw
4. animals — a hospital hallway of people in sky blue pajamas with gentle animal heads, a sheep, a pig, a heron, shuffling in single file
5. gold stars — a toddler perched on a toilet in a vast white room, a huge golden star sticker floating in the air above
6. the pajamas — people in identical thin sky blue pajamas pacing a long circular hospital hallway, spread out like dancers rehearsing a choreographed piece
7. rolled cuffs — a nurse kneeling to roll up the pajama cuffs of a thin girl with long dark hair in sky blue hospital pajamas, who stands still like a child, faint pleasure on her face
8. the menu form — a small white paper menu form and a stubby pencil on a wooden desk in morning light
9. Sophie Spincher — a thin girl with long dark hair in sky blue hospital pajamas at a desk, squinting at the name printed on a little white form
10. filling it out anyway — a thin girl with long dark hair in sky blue hospital pajamas dutifully filling out a form at a desk by a window
11. the soup container — a long white plastic soup container with a rounded lid with two holes, sitting on a desk glowing softly like a treasure
12. forms in the trash — a thin girl with long dark hair in sky blue hospital pajamas listlessly dropping white paper forms into a metal trash can beside her desk
13. Francesca and the yogurt — a heavyset older woman with long graying dark hair in sky blue pajamas eating sweet bread in a hallway chair, reaching for a small yogurt cup a thin dark-haired girl holds out
14. trash treasure — a thin girl with long dark hair in sky blue hospital pajamas reaching into a hospital trash can and lifting out an empty white soup container like a pearl
15. the sculptures — a cluster of small strange sculptures made from white plastic soup containers and masking tape in different stages of completion, crowding a little wooden desk
16. night gallery — a girl with long dark hair crouched at a dark windowsill at night, arranging little white sculptures in a careful row in front of an air conditioning vent
17. the titles — tiny slips of paper standing up in front of little white tape-and-plastic sculptures on a moonlit windowsill
18. taken down — three nurses crowding into a small hospital room in the morning, pointing at sculptures on the windowsill while a thin dark-haired girl in blue pajamas watches from her bed
19. drawer museum — an open wooden drawer holding small white sculptures arranged neatly like museum pieces, a tiny paper label standing in front of each

## Chapter Two — meeting with Sarah

20. speaking up — a thin girl with long dark hair in sky blue hospital pajamas sitting small in a large office chair, speaking timidly to a big woman in a dark blue suit behind a desk
21. the accusation — a nurse's aide bursting through an office doorway mid-accusation, pointing, while a thin girl in blue pajamas shrinks into her chair

## Chapter Three — candy

22. the bad dream bursts — a dark storm cloud breaking apart into falling pastel candy squares, watercolor burst
23. circling — a thin girl with long dark hair in sky blue hospital pajamas walking a wide wary circle around a large nurse seated in a hallway chair
24. the ant and the idol — a tiny ant walking a wide circle around an enormous seated stone idol on a dusty floor
25. the offer — a large seated nurse tearing open a yellow candy wrapper and holding out one pink candy square to a thin dark-haired girl in blue pajamas
26. pink square — a single pink candy square in the middle of an open palm, close up
27. at peace — a thin girl in sky blue pajamas and a large seated nurse looking at each other calmly, the girl's cheek round with candy
28. the red one — a thin girl with long dark hair in blue pajamas slipping a red candy square into her shirt pocket with a small secret smile

## Chapter Four — Francesca

29. telling Tommy — a heavyset older woman with long graying dark hair in sky blue pajamas talking with big gestures to a blonde young man in a hallway of blue wire chairs
30. music group — patients in sky blue pajamas seated in a circle with little percussion instruments, a heavyset older woman striking hers out of turn, a teacher with a blonde bob glaring
31. the silence — a heavyset older woman with a miniature tambourine in her lap, fingers pressed to her lips, a circle of patients waiting
32. the beautiful body — a heavyset older woman in blue pajamas telling her story in a hallway while behind her a faint memory of a young beautiful woman dissolves into watercolor
33. the singing — ribbons of song winding out of a doorway and down a hospital hallway, painted as flowing colored lines
34. the spa — through a doorway, a small young woman with short black hair gently combing the hair of a heavyset older woman in a little hospital room, tender as a secret spa
35. morning song — early light, a heavyset older woman with long graying hair brushing her hair slowly before a mirror, small birds at the window

## Chapter Five — fire detector

36. the forgery — a thin girl with long dark hair in blue pajamas at a desk, building a fake fire detector out of an empty jello cup, masking tape and black paper, deep in concentration
37. installation — a thin girl in sky blue pajamas standing on a chair, taping a little handmade fire detector to the ceiling right next to the real one
38. twins — two fire detectors side by side on a white ceiling, one real, one made of a jello cup and masking tape, nearly identical
39. everything I could be doing — small daydream vignettes floating like thought bubbles above a bored girl in blue pajamas: a McDonald's, a frozen yogurt shop, a pizza slice, two friends waving
40. the little house — a daydream of a small cardboard house on wheels being wheeled down a city sidewalk

## Chapter Six — stealing scissors

41. the theft — a thin girl with long dark hair in blue pajamas hiding a pair of scissors deep in a wooden drawer, glancing over her shoulder
42. not even feeling good — a thin girl in sky blue pajamas sitting stiffly on a desk chair beside a closed drawer, hands in her lap
43. the knock — the silhouette of a nurse knocking at a hospital room door, serious, seen from inside the dim room
44. handing them over — a thin girl in blue pajamas surrendering a pair of scissors into a nurse's open hand at a nurses' station
45. the explanation — a thin girl with long dark hair in blue pajamas mid-explanation before a skeptical nurse, her hands tangled in the air like string
46. we don't steal scissors — a thin girl in sky blue pajamas walking small and scolded down a hallway beside a stern doctor in a dark purple checkered shirt and black suit pants
47. gray options — a watercolor map of branching colored paths inside a girl's silhouetted head, all the colors fading to gray

## Chapter Seven — me going crazy

48. delicious black — a hospital hallway dissolving into rich black ink around two small walking figures
49. the square table — a thin girl in blue pajamas and a woman doctor sitting at a square table next to a window, both looking out at the sun
50. facebook — a thin girl with long dark hair in blue pajamas at an old computer in a TV room, the glowing screen showing tiny sunlit people walking around outside
51. another world — a dim room and a girl in blue pajamas peering through a laptop screen as if it were a bright window into another world
52. not sent — a girl's hand hovering frozen over a computer keyboard, unable to press a key

## Chapter Eight — one shower

53. the one shower — a thin girl with long dark hair standing under a warm shower with her eyes closed, steam curling around her
54. flowers blooming — red and pink flowers blooming explosively out of a girl's head under falling water, watercolor bursting
55. first meal in three days — a hospital tray with corned beef, mashed potatoes, carrots and a pudding cup, a fork lifted mid-bite, eaten with real hunger

## Chapter Nine — terrible night

56. the pill in the cup — a small white paper cup of water with a partially dissolved pill at the bottom, two careful fingers fishing it out
57. breaking the soap — a thin girl in blue pajamas in a shower stall breaking a tiny corner off a bar of hospital soap
58. soap water — a paper cup of water held up to fluorescent light, jagged little soap pieces floating at the bottom
59. look, I'm going to take it — a thin girl with long dark hair in blue pajamas showing a paper cup to a tall nurse at a nurses' station at night
60. down in one — a thin girl in sky blue pajamas drinking down a paper cup in one motion while a nurse watches, night hallway shadows
61. the pill travels — a small glowing bead traveling up through a girl's neck toward her head, painted through translucent watercolor anatomy, synapses branching like coral
62. butter and sugar — three little mounds of butter on a hospital floor where the wall curves, sugar snowing down from a torn packet
63. seven packets — seven torn empty sugar packets scattered across a hospital floor, night
64. push-up position — a thin girl with long dark hair in blue pajamas frozen in push-up position in the center of a dark hospital room, moonlight through the window
65. caught — a nurse's silhouette in a doorway and a girl in bed with covers pulled to her chin, eyes wide open
66. the fish tank — a hospital meeting room where all the patients are goldfish drifting inside a huge fish tank, one girl watching from outside the glass
67. the mechanical arm — a thin girl in blue pajamas mechanically putting an arm around a crying pale woman with very long hair, in a circle of chairs

## Chapter Ten — footage

68. the demand — night, a girl lying awake in a hospital bed, above her a dream of a wall of grainy security monitors, each tiny screen showing the same girl pacing
69. security camera — grainy security camera view from a high ceiling corner: a small figure in pajamas pacing a long circular hallway, mid-stop
70. inventing activities — a thin girl with long dark hair in blue pajamas striding the circular hallway with purpose while other patients sit motionless in doorways
71. the business of art — a girl solemnly placing a tiny standing paper label in front of an ordinary paper cup, presenting it like a museum piece

## Chapter Eleven — Laura

72. New York is a beautiful city — a pale sad woman with very long flowing hair leaning on a big glass window, her hair falling in tresses, city light on her face
73. Europan — a view over a bakery cafe from high above: people filing in and out with paper bags, crowded buildings behind, a pretty floating sky
74. ten minutes — two women in sky blue pajamas side by side at a tall hospital window, faint reflections in the glass, looking out at the city
75. paper city — a city seen from a tower window painted slightly disjointed, buildings like stacked paper cutouts under a floating sky

## Chapter Twelve — coffee shots

76. sun in the dining room — morning sun streaming clear into a hospital dining room, girls in sky blue pajamas and socks stepping in together
77. pouring — a thin girl with long dark hair in blue pajamas pouring coffee into a row of tiny creamer cups on a table
78. little shots — a row of tiny half-and-half cups filled with coffee and orange juice like little shot glasses, a girl drinking one delightedly, pinky up

## Chapter Thirteen — Francesca cried the day I left

79. Francesca crying — a heavyset older woman with long graying dark hair in blue pajamas crying at a dining table, a strawberry yogurt in one hand and a piece of bread in the other
80. sign here — a head nurse gripping a thin girl's shoulder and holding out papers to sign, the girl's parents waiting at a table behind them
81. goodbye — a thin girl with long dark hair in blue pajamas kissing a heavyset older woman gently on the hair

## Chapter Fourteen — medicine line

82. tired — patients in sky blue pajamas crowding a lit nurses' station window at night, tired, asking
83. feeding time — a crowd of drifting fish rising toward a small lit hatch of light in a dark aquarium

## Chapter Fifteen — bright sunny day

84. handstands — a bright sun-patched day room, a small young woman with short black hair doing a handstand in the light, legs straight up
85. jumping — a thin girl with long dark hair in a red tank top jumping up and down in a patch of sunlight, hair mid-air, joyful
86. ninety-eight — a thin girl standing on a hospital scale in morning light, a nurse noting something down

## Chapter Sixteen — the tour

87. the wail — a woman wailing at a hospital window, and behind her a small faded daydream of a tour bus in New York, tiny and far away

## Chapter Seventeen — hopelessness

88. followed — a thin girl with long dark hair in blue pajamas dragging herself down a hallway, two faint gray watercolor ghosts following close behind her
89. dusk hallway — an empty circular hospital hallway at dusk in gray wash, one small figure far away at the curve

## Coda

90. almost stylish — a group of people in sky blue pajamas standing together like a fashion plate, elegant poses, but every face is sad
91. I mean I was — a thin girl with long dark hair in sky blue hospital pajamas among them, looking straight out at the viewer

## Bonus — scenes from the "at the hospital" draft

These moments live only in the rawer "at the hospital" / "Copy of at the
hospital" drafts, not in the finished manuscript — gorgeous visuals if the
narration ever folds them in.

B1. disco ball — a hospital dayroom where everyone's light blue pajamas shine like mirrors, the whole room glittering like the inside of a giant disco ball
B2. the red cart — a girl pushing herself down a hospital hallway in a little red cart, snatching fruit off passing meal trays
B3. two chairs — a girl in mismatched socks squatting between two identical gray hospital chairs with black armrests, unable to choose either
B4. coalition of nurses — a circle of nurses conferring in a huddle right outside a bedroom door at night, a girl in blue pajamas walking slowly past with her eyes down
B5. moving the bed — a group of nurses carrying an unmade bed down a hospital hallway while a thin girl sits on a chair watching them work
B6. become a real person kit — a cardboard box with a neat square hole cut in its front on a desk, surrounded by little inventions: a gauze net with a toothbrush handle, taped packets, tiny tools
B7. the cape — a thin girl with long dark hair with a white bedsheet tied around her neck like a cape, parading around two hospital beds while her roommate stands at the window talking to herself
B8. the pillowcase — a thin girl with long dark hair in blue pajamas walking down a hallway toward the exit with a stuffed white pillowcase over her shoulder, glancing back once
B9. stuffed raspberries — a row of little stuffed raspberries sewn from white pillowcase fabric, sitting in a sunny windowsill
B10. we couldn't touch — two girls in blue pajamas gripping hands tightly in a hallway, a staff member approaching to separate them
