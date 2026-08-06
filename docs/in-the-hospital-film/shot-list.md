# IN THE HOSPITAL — watercolor film shot list (v2)

A shot list for a ~20-minute short film of Sophie's story **"In the Hospital"**
(the ~3,000-word manuscript in Drive: "in the hospital" / "Copy of in the
hospital"). Narrated at a gentle pace, 3,000 words runs right around 20
minutes — 91 core shots means each picture holds ~13 seconds. Cut, hold, or
re-roll freely; the numbering is chronological with the text.

**v2 (Aug 2026): rewritten for the ChatGPT-watercolor engine, and every shot
made fully self-contained.** v1 was written like prose — the soup container
was described once (shot 11) and later shots said just "soup container",
assuming you'd already seen it. But every image generates independently with
no memory of any other shot, so a detail not repeated in that exact prompt
does not exist. In v2 every prop carries its manuscript description at every
appearance, everyone's clothing is stated, and nothing refers back to an
earlier shot.

## The engine (v2)

- **gpt-image-2 EDITS** with `refs/evan-film-style.png` attached as a pure
  style reference — the Playground's ChatGPT style recipe, verbatim
  (`PL_GPT_STYLES.evan` in server.js). Quality **medium** (6¢) unless decided
  otherwise; 1024x1536 portrait. Run via `scripts/hospital-gpt-gen.js`.
- **The narrator is only ever "the girl".** Her look comes from an attached
  watercolor character reference — currently
  `hospital-film/gB-med.png` (the hearted curly-haired B render) — with the
  line "Use the second attached image as a character reference. Whenever the
  prompt mentions the girl, draw her as that girl." **Never describe her in
  words** (see the rules below). Any prompt containing "the girl" attaches
  the reference; prompts without her don't.
- **The rest of the cast has no references yet**, so they keep verbatim
  descriptions, identical at every appearance:
  - Francesca: "a heavyset older woman with long graying dark hair, in sky
    blue patient pajamas"
  - Laura: "a pale sad woman with very long flowing hair, in sky blue
    patient pajamas"
  - Mayra: "a small young woman with short black hair, in sky blue patient
    pajamas"
  - Dr. Grim: "a stern middle-aged doctor in a dark purple checkered shirt
    and black suit pants"
  - Nurses are always "in scrubs, not patient pajamas".
  (Once a render of each is hearted, lock it as that character's reference
  the same way and strip their descriptions too.)
- The engine's baked suffix bans text in the image, so paper labels and forms
  render as blank slips — that's expected and right.
- The 2x2 panel trick works on this engine (hard-border language, slice at
  quarters) and at high quality matches the singles' hand. Whether the film
  uses panels, singles, or both is Sophie's call.
- **Narration: Sophie — morning (`UTkHGl2ImiT6gwtAFCql`) on
  `eleven_multilingual_v2` — NEVER `eleven_v3`** (Aug 2026, Sophie; film v1
  shipped on v3 by mistake and was re-rendered). Settings: stability 0.5,
  similarity_boost 0.75, style 0, use_speaker_boost true. Pad-style timing:
  each shot holds for exactly its own slice's audio length, per-unit audio as
  PCM WAV, one encode at the mux.

## Prompt rules from Sophie (Aug 2026 — do not break these)

- **NEVER describe anything you are already attaching an image of.** If a
  character reference is attached, the prompt says "the girl" and nothing
  else — no hair colour, no build. Describing it in words fights the picture
  and lets the model drift toward the words.
- **Do not add "same face and same hair"** (or any preserve-list wording) when
  a character reference is attached. It over-weights the face and hair
  specifically instead of letting the whole reference carry.
- **Say what people are WEARING when their role matters.** A prompt that says
  "three nurses" in a hospital scene gets three women in the same blue
  patient pajamas as everyone else — name the uniform ("nurses in scrubs, not
  patient pajamas") or the scene reads wrong.
- **Never invent a prop** — every object has to be traceable to a line in the
  manuscript.
- **Name a prop the way SHE described it, not by its generic noun — in EVERY
  shot it appears in.** "An empty white soup container" got cones and cups;
  the manuscript's "long white plastic rounded rectangle with a cover that
  had two holes in it" got the real object. The specific shape is the point
  of the object, and it must ride in each prompt separately.

## Production notes (learned the hard way, Aug 2026)

- **Quality changes the STYLE on this engine, not just the sharpness.** Panel
  pages at low come out dense and painted like a graphic novel; at high they
  match the light ink-and-wash of the singles; medium sits between. Panels
  and singles only mix in one film if the panels run at high.
- **Costs:** ~2¢ low / ~6¢ medium / ~25¢ high per image at 1024x1536. A high
  panel page is 4 pictures for 25¢ (~6¢ each); a medium single is one picture
  for the same 6¢.
- **The WTR-LoRA findings** (drawing-language cue at lora_scale 1.2, the
  photographic-prior trap, grids needing hard black-ink border wording, the
  people-drift on object shots) are recorded in git history with v1 — they
  still apply to the Replicate house styles, but this film moved to the
  ChatGPT engine, where Sophie's scanned page is the style and adherence is
  far better.

## Cold open

1. cold open — An empty hospital corridor at dawn in pale blue-gray light, a single pair of white socks left in the middle of the floor.

## Chapter One — introduction

2. wilted rooms — A hospital room that is wilting like a dying flower: the walls sag and droop inward, the doorframe slumps, curls of paint peel like petals, one bare low wooden bed with a thin mattress.
3. the food — A hospital food tray seen from above: moldy bread, gray meat, and a paper cup of blue cleaning liquid with a straw.
4. animals — A hospital hallway of people in thin sky blue patient pajamas with gentle animal heads — a sheep, a pig, a heron — shuffling in single file.
5. gold stars — A toddler perched on a toilet in a vast white room, a huge golden star sticker floating in the air above.
6. the pajamas — People in identical thin sky blue patient pajamas pacing a long circular hospital hallway, spread out like dancers rehearsing a choreographed piece.
7. rolled cuffs — A nurse in scrubs, not patient pajamas, kneels to roll up the too-long pajama cuffs of the girl, who stands still like a child, faint pleasure on her face.
8. the menu form — A small white paper meal-order form and a stubby pencil on a wooden desk in morning light.
9. Sophie Spincher — The girl sits at a wooden desk, squinting at the name printed at the top of a little white meal-order form.
10. filling it out anyway — The girl dutifully fills out a little white meal-order form at a desk by a window.
11. the soup container — A soup container — a long white plastic rounded rectangle with a lid that has two holes in it — sitting alone on a wooden desk, glowing softly like a treasure.
12. forms in the trash — The girl listlessly drops white paper forms into a metal trash can beside her desk.
13. Francesca and the yogurt — A heavyset older woman with long graying dark hair, in sky blue patient pajamas, eats sweet bread in a hallway chair, reaching for a small yogurt cup the girl holds out to her.
14. trash treasure — The girl reaches into a hospital trash can and lifts out an empty soup container — a long white plastic rounded rectangle with a lid that has two holes in it — holding it up like a treasure.
15. the sculptures — Small handmade sculptures crowd a little wooden desk in a hospital room, each built from long white plastic rounded-rectangle soup containers with two holes in their lids, stacked upright and held together with copious masking tape, clear plastic cutlery sleeves taped onto their sides.
16. night gallery — At night the girl crouches at a dark windowsill, arranging little sculptures built from long white plastic rounded-rectangle soup containers and masking tape into a careful row in front of an air conditioning vent, a tiny paper label standing in front of each one, city lights outside the window.
17. the titles — Close up: tiny paper labels standing upright on a moonlit windowsill, one in front of each little sculpture built from long white plastic rounded-rectangle soup containers and masking tape.
18. taken down — Morning light. Three nurses in scrubs — not patient pajamas — crowd into a small hospital room, pointing at little sculptures built from white plastic rounded-rectangle soup containers and masking tape lined up on the windowsill, while the girl watches from her bed.
19. drawer museum — An open wooden drawer holding little sculptures built from long white plastic rounded-rectangle soup containers and masking tape, arranged neatly like museum pieces, a tiny paper label standing in front of each.

## Chapter Two — meeting with Sarah

20. speaking up — The girl sits small in a large chair in an office, speaking timidly to a big woman in a dark blue suit behind a desk.
21. the accusation — A nurse's aide in scrubs, not patient pajamas, bursts through an office doorway mid-accusation, pointing, while the girl shrinks into her chair.

## Chapter Three — candy

22. the bad dream bursts — A dark storm cloud breaking apart into falling pastel candy squares.
23. circling — The girl walks a wide wary circle around a large nurse in scrubs seated in a hallway chair.
24. the ant and the idol — One tiny black ant walking in a wide circle around an enormous carved stone statue of a seated figure on a dusty floor; the statue is solid carved stone, not a living person.
25. the offer — A large nurse in scrubs, seated in a hallway chair, tears open a pack of candy in a yellow paper wrapper and holds out one pink candy square to the girl.
26. pink square — A single pink candy square in the middle of an open palm, close up.
27. at peace — The girl and a large seated nurse in scrubs look at each other calmly, the girl's cheek round with candy.
28. the red one — The girl slips a red candy square into the pocket of her sky blue pajama shirt with a small secret smile.

## Chapter Four — Francesca

29. telling Tommy — A heavyset older woman with long graying dark hair, in sky blue patient pajamas, sits on a blue wire chair in a hospital hallway, talking with big gestures to a blonde young man in patient pajamas.
30. music group — Patients in thin sky blue pajamas seated in a circle holding small percussion instruments; a heavyset older woman with long graying dark hair strikes hers out of turn while a music teacher with a blonde bob glares.
31. the silence — A heavyset older woman with long graying dark hair, in sky blue patient pajamas, a miniature tambourine in her lap, fingers pressed to her lips, a circle of waiting patients around her.
32. the beautiful body — A heavyset older woman with long graying dark hair, in sky blue patient pajamas, tells her story in a hallway while behind her a faint memory of a young beautiful woman dissolves into the wall.
33. the singing — Ribbons of song winding out of a doorway and down a hospital hallway, painted as flowing colored lines.
34. the spa — Through a doorway: a small young woman with short black hair gently combs the long graying hair of a heavyset older woman, both in sky blue patient pajamas, in a little hospital room, tender as a secret spa.
35. morning song — Early light. A heavyset older woman with long graying dark hair brushes her hair slowly before a mirror, small birds at the window.

## Chapter Five — fire detector

36. the forgery — The girl at a desk builds a fake fire detector out of an empty jello cup, masking tape and black paper, deep in concentration.
37. installation — The girl stands on a chair, taping a little handmade fire detector made from an upside-down jello cup to the ceiling right next to the real one.
38. twins — Looking straight up at a white ceiling: two round fire detectors side by side, one factory-made, one handmade from an upside-down jello cup, black paper and masking tape, nearly identical; no people in the picture.
39. everything I could be doing — Small daydream vignettes float like thought bubbles above the girl sitting bored on a bed: a McDonald's, a frozen yogurt shop, a pizza slice, two friends waving.
40. the little house — A daydream: a small cardboard house on wheels being wheeled down a city sidewalk.

## Chapter Six — stealing scissors

41. the theft — The girl hides a pair of scissors deep in a wooden drawer, glancing over her shoulder.
42. not even feeling good — The girl sits stiffly on a desk chair beside a closed wooden drawer, hands in her lap.
43. the knock — The silhouette of a nurse in scrubs knocking at a hospital room door, serious, seen from inside the dim room.
44. handing them over — The girl surrenders a pair of scissors into the open hand of a nurse in scrubs at a nurses' station.
45. the explanation — The girl mid-explanation before a skeptical nurse in scrubs, her hands tangled in the air like string.
46. we don't steal scissors — The girl walks small and scolded down a hallway beside a stern middle-aged doctor in a dark purple checkered shirt and black suit pants.
47. gray options — An abstract branching map of forking colored paths drawn on paper, the bright colors draining to flat dead gray toward the edges; no people in the picture.

## Chapter Seven — me going crazy

48. delicious black — A hospital hallway dissolving into rich black ink around two small walking figures.
49. the square table — The girl and a woman doctor sit at a square table next to a window, both looking out at the sun.
50. facebook — The girl at an old computer in a TV room, the glowing screen showing tiny sunlit people walking around outside.
51. another world — A dim room; the girl peers through a glowing laptop screen as if it were a bright window into another world.
52. not sent — A hand hovering frozen over a computer keyboard, unable to press a key, close up.

## Chapter Eight — one shower

53. the one shower — The girl stands under a warm shower with her eyes closed, steam curling around her.
54. flowers blooming — Red and pink flowers bloom explosively out of the girl's head as warm shower water falls.
55. first meal in three days — A hospital tray with corned beef, mashed potatoes, carrots and a pudding cup, a fork lifted mid-bite.

## Chapter Nine — terrible night

56. the pill in the cup — Two careful fingers fish a partially dissolved white pill out of a small paper cup of water, close up.
57. breaking the soap — In a shower stall, the girl breaks a tiny corner off a bar of white hospital soap.
58. soap water — A paper cup of water held up to fluorescent light, jagged little pieces of white soap floating at the bottom, close up.
59. look, I'm going to take it — The girl shows a paper cup to a tall nurse in scrubs at a nurses' station at night.
60. down in one — The girl drinks down a paper cup in one motion while a nurse in scrubs watches, night hallway shadows.
61. the pill travels — A small glowing bead travels up through the neck of a translucent watercolor figure toward her head, synapses branching like coral inside.
62. butter and sugar — Three little pats of butter on a hospital floor where the wall curves to make room for the bathroom, white sugar pouring down onto the little mounds from a torn paper packet.
63. seven packets — Seven torn empty sugar packets scattered across a hospital floor at night; no people in the picture.
64. push-up position — The girl holds a frozen push-up position in the center of a dark hospital room, moonlight through the window.
65. caught — A nurse in scrubs silhouetted in a doorway; the girl in bed with covers pulled to her chin, eyes wide open.
66. the fish tank — A hospital meeting room where all the patients are goldfish drifting inside a huge fish tank; the girl watches from outside the glass.
67. the mechanical arm — In a circle of chairs, the girl mechanically puts an arm around a crying pale sad woman with very long flowing hair, in sky blue patient pajamas.

## Chapter Ten — footage

68. the demand — Night. The girl lies awake in a hospital bed; above her floats a dream of a wall of grainy security monitors, each tiny screen showing the same small figure pacing a hallway.
69. security camera — Grainy security-camera view from a high ceiling corner: a small figure in patient pajamas pacing a long circular hallway, stopped mid-step.
70. inventing activities — The girl strides a circular hospital hallway with purpose while other patients in sky blue pajamas sit motionless in doorways.
71. the business of art — The girl solemnly places a tiny standing paper label in front of an ordinary paper cup on a table, presenting it like a museum piece.

## Chapter Eleven — Laura

72. New York is a beautiful city — A pale sad woman with very long flowing hair, in sky blue patient pajamas, leans on a big glass window, her hair falling in tresses, city light on her face.
73. Europan — A view down from a high hospital window onto a bakery cafe: people filing in and out with paper bags, crowded buildings behind, a pretty floating sky.
74. ten minutes — The girl and a pale sad woman with very long flowing hair, both in sky blue patient pajamas, stand side by side at a tall hospital window, faint reflections in the glass, looking out at the city.
75. paper city — A city seen from a tower window, slightly disjointed, buildings like stacked paper cutouts under a floating sky; no people in the picture.

## Chapter Twelve — coffee shots

76. sun in the dining room — Morning sun streams clear into a hospital dining room; girls in sky blue patient pajamas and socks step in together.
77. pouring — The girl pours coffee into a row of tiny half-and-half creamer cups on a dining table.
78. little shots — A row of tiny half-and-half creamer cups filled with coffee and orange juice like little shot glasses; the girl drinks one delightedly, pinky up.

## Chapter Thirteen — Francesca cried the day I left

79. Francesca crying — A heavyset older woman with long graying dark hair, in sky blue patient pajamas, cries at a dining table, a strawberry yogurt in one hand and a piece of bread in the other.
80. sign here — A head nurse in scrubs grips the girl's shoulder and holds out papers and a pen; the girl's parents wait at a table behind them.
81. goodbye — The girl kisses a heavyset older woman with long graying dark hair, in sky blue patient pajamas, gently on the hair.

## Chapter Fourteen — medicine line

82. tired — Patients in sky blue pajamas crowd a lit nurses' station window at night, tired, asking.
83. feeding time — A crowd of drifting fish rising toward a small lit hatch of light in a dark aquarium; no people in the picture.

## Chapter Fifteen — bright sunny day

84. handstands — A bright sun-patched day room; a small young woman with short black hair, in sky blue patient pajamas, does a handstand in the light, legs straight up.
85. jumping — The girl, wearing a red tank top and pajama pants, jumps up and down in a patch of sunlight, hair mid-air, joyful.
86. ninety-eight — The girl stands on a hospital scale in morning light while a nurse in scrubs notes something down.

## Chapter Sixteen — the tour

87. the wail — A woman in sky blue patient pajamas wails at a hospital window, and behind her floats a small faded daydream of a tour bus in New York, tiny and far away.

## Chapter Seventeen — hopelessness

88. followed — The girl drags herself down a hospital hallway, two faint gray ghosts following close behind her.
89. dusk hallway — An empty circular hospital hallway at dusk in gray light, one small figure far away at the curve.

## Coda

90. almost stylish — A group of people in thin sky blue patient pajamas standing together like a fashion plate, elegant poses, every face sad.
91. I mean I was — The girl stands among people in sky blue patient pajamas, looking straight out at the viewer.

## Bonus — scenes from the "at the hospital" draft

These moments live only in the rawer "at the hospital" / "Copy of at the
hospital" drafts, not in the finished manuscript — gorgeous visuals if the
narration ever folds them in.

B1. disco ball — A hospital dayroom where everyone's light blue pajamas shine like mirrors, the whole room glittering like the inside of a giant disco ball.
B2. the red cart — The girl pushes herself down a hospital hallway in a little red cart, snatching fruit off passing meal trays.
B3. two chairs — The girl, in mismatched socks, squats between two identical hospital chairs with gray seats, long curved metal legs and black plastic armrests, sitting in neither.
B4. coalition of nurses — A circle of nurses in scrubs confer in a huddle right outside a bedroom door at night; the girl walks slowly past with her eyes down.
B5. moving the bed — A group of nurses in scrubs carry an unmade bed down a hospital hallway while the girl sits on a chair watching them work.
B6. become a real person kit — A cardboard box with a neat square hole cut in its front, on a desk, surrounded by little inventions: a net made of gauze with a bent toothbrush handle, a taped-on paper packet of sugar, salt, pepper, fork, knife and napkin; no people in the picture.
B7. the cape — The girl, a white bedsheet tied around her neck like a cape, parades around two low wooden hospital beds while her roommate stands at the window talking to herself.
B8. the pillowcase — The girl walks down a hospital hallway toward the exit with a stuffed white pillowcase over her shoulder, glancing back once.
B9. stuffed raspberries — A row of little stuffed raspberries sewn from white pillowcase fabric on a sunny windowsill; no people in the picture.
B10. we couldn't touch — The girl and a pale sad woman with very long flowing hair, in sky blue patient pajamas, grip hands tightly in a hallway as a staff member in scrubs approaches to separate them.
