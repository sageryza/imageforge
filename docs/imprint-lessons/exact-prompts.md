# Exact prompts — every lesson/story image, verbatim

For diffing against another chat's prompts. Nothing here is paraphrased: these are the exact strings sent to the model, reconstructed from the generation spec files with the generator's own defaults (`scripts/witch-school-cards.js`).

## How each prompt is assembled (the generator's exact recipe)

```
full prompt = STYLE + (CHARACTER, only if the card sets "char": true) + CONTENT + ENDING
```

- Endpoint: `POST https://api.openai.com/v1/images/edits`, model `gpt-image-2`, `size 1024x1024`, `quality medium`, `n 1`.
- The style reference images are attached as `image[]` files (they are Sophie's two style anchors unless a group lists different refs).
- Groups marked **whiten** get a post-process flood-fill of the border-connected background to pure white (code, not prompt).
- Concatenation is direct string concat — the trailing/leading spaces you see inside the quoted strings below are real and part of the prompt.

---

## Group 1 — Warm house style (the default)

- images: **314** · spec files: af-esoteric.json, all.json, astro-redo.json, coffee.json, cv1.json, diary.json, essays.json, essays2.json, expand1.json, hr-teams.json, htloft.json, lessons.json, md-test.json, meditation.json, meditation2.json, metaphor.json, nd2.json, nd3.json, readpeople.json, readpeople2.json, redo1.json, redo2.json, regen-warm.json, sauna5.json, shame2.json, shapes.json, warm-redo.json, wc-diagrams.json, zc-batch.json, zw-batch.json, zw-gossip.json, zw-mirror.json, zw-reroll.json, zw-spec.json, zw-twelve.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: as generated (cream kept)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Subject centered with lots of empty cream space around it. Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `af-esoteric` — char: yes

```
The recurring woman happily tending to small unusual esoteric pursuits — a little herb bundle, a tarot card, an odd handmade craft — off in her own quiet corner where no one else is competing. Content and unbothered. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-snake` — char: no

```
A woman standing calmly while a large gentle snake emerges from within her chest and rises beside her head, as if something living inside her is coming out to be seen. Uncanny but not scary. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-mask` — char: no

```
A person reaching up and unzipping their own human face like a mask, revealing a different gentle other self underneath — the true self under the human surface. Calm, a little uncanny. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-gender` — char: no

```
A person standing before a mirror; the reflection is a slightly different self than the person, so the two do not quite match. Gentle. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-age` — char: no

```
A short adult woman in a smart blazer holding a coffee cup, looking annoyed as a taller person condescendingly pats her on the head and offers her a child's menu, mistaking her for much younger. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-competence` — char: no

```
A capable professional woman by a meeting table, quietly exasperated, as a man mistakenly hands her his empty coffee cup as if she were the assistant. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-cluster` — char: no

```
A single person standing, and around them a soft cluster-cloud of little assorted symbolic icons that others pin on them at a glance: a graduation cap, a tool, a price tag, a heart, a small flag. A cluster of assumptions. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-youarehere` — char: no

```
A large pie chart and a simple bar graph floating in the air, with a little arrow marking a single spot as 'you are here', while a small person below looks up at where they have been plotted. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-approx` — char: no

```
The same figure shown three times left to right, getting clearer: first a vague featureless blob-shape of a person, then a rough simple figure, then a clearer detailed person. A guess of someone getting closer but never exact. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-banner` — char: no

```
A woman striding forward confidently and proudly holding up a blank protest placard on a stick (the sign is empty, no writing) like a one-person march. Upbeat and defiant. Flat house colors, bold outlines, cream space. No text, no letters, no numbers, blank sign.
```

### `cv-corey` — char: no

```
Two people sitting talking; above one man's head floats a rosy flattering thought-bubble showing him as a small heroic/victim version of himself, while the other person listens with a subtle knowing look. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-vehicle` — char: no

```
A little car shaped like a thought-bubble carrying a small person along a road from a dark gloomy spot on the left toward a brighter spot on the right. A thought that ferries you from one feeling to another. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-insideoutside` — char: no

```
A person's head with two kinds of thought bubbles: one open bubble floating freely outward and away, and one bubble kept close and locked inside a small box. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-shame` — char: no

```
A single figure walking away from a dark looming villain-shadow behind them toward a brighter upright hero-silhouette ahead — moving out of shame into a kinder self-story. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-broadcast` — char: no

```
A person opening their private locked box of inner thoughts and pushing it insistently toward other people as if it were public fact, while the others lean back unconvinced. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-novehicle` — char: no

```
A single figure slumped and stuck in a dark low dip in the ground, weighed down, no vehicle in sight — someone with no kind story to carry them out of shame. Gentle, not grim. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-grounding` — char: no

```
A person standing barefoot on green grass with their shoes set aside, arms relaxed, eyes closed, content — simply standing barefoot on the earth. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-banana` — char: no

```
A single banana that has been fully pre-peeled and placed in clear plastic packaging on a tray on a counter — an absurdly over-prepared pre-peeled banana. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-sadlamp` — char: no

```
A person sitting indoors close to a bright glowing sun-lamp on a desk, while behind them a window shows the real sun shining brightly outside. Using an artificial sun lamp while real sunlight pours in. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-treadmill` — char: no

```
A person walking on a treadmill indoors facing a television that shows a peaceful forest nature scene. Walking in place while watching nature on a screen. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-supplements` — char: no

```
A dinner plate on a table holding nothing but a small pile of colorful pills and supplement capsules, with a fork and knife beside it. Supplements in place of a meal. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-donut` — char: no

```
A person running on a treadmill chasing a donut that dangles on a string from a stick mounted in front of them, always just out of reach. The desire treadmill. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `sl-hero` — char: no

```
A person standing proudly on a small pedestal holding up a blank-covered book while a little admiring crowd looks up at them — hailed as a guru for stating something obvious. Flat house colors, bold outlines, cream space. No text, no numbers, blank book cover.
```

### `sl-pill` — char: no

```
A whole fresh apple on the left, an arrow, and a single small pill on the right — the whole thing distilled down to its extracted essence in a pill. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-tiktok-v2` — char: no

```
Two hands holding a phone; the vertical video on screen shows a DIFFERENT person (plain everyday clothes, definitely NOT a pink star jacket or striped pants) cheerfully picking their nose — a silly satirical clip casually handing out an ADHD diagnosis. Make it funny. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-wandspaghetti-v2` — char: no

```
A man holding up a magic wand that has gone completely limp and floppy, drooping over like a strand of overcooked spaghetti because his spell doesn't work; he looks deflated and disappointed. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-fearmask-v2` — char: no

```
A MAN recoiling in fear and disdain from astrology, backing away with a wary, hostile face; he wears ordinary plain clothes with absolutely NO stars on them (he hates astrology, so no star symbolism on him). Keep the consistent house style, not cartoonish. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-twelve-v2` — char: no

```
Twelve different people, one inside each of twelve simple boxes in a grid, each with a distinctly different expression and mood — some angry, some tired, some bored, some cheerful, some anxious — clearly twelve different personalities, NOT all smiling the same. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-cantdo-v2` — char: no

```
A man looking sad and a little annoyed that he can't do the magic himself, slumping with a helpless shrug; give him more interesting, patterned clothing (not plain and boring). Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-laugh-v2` — char: yes

```
being mocked and laughed at by two other people standing on either side of her; keep her in her pink star jacket and striped pants, but the two mockers wear plain clothing with NO stars on it (they hate astrology). Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-reality-v2` — char: no

```
A man getting a plate of spaghetti spilled down his shirt and storming off in a huff — the mishap lands on HIM. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-gossip-v2` — char: no

```
Two clearly DIFFERENT women gossiping side by side: one is the main character (reddish-brown hair in a messy topknot, pink star jacket, striped pants); the other has BLACK hair and plain clothes with NO stars. Each woman is framed in her own roundel — a white circle with a thin gold rim, then a thick colored ring (one emerald green, one midnight blue), then another thin gold rim outside. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-spin2-v2` — char: no

```
A simple globe of the Earth showing its daily spin with a little motion arrow, the continents colored as GREEN land on blue ocean (no yellow continents). Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-stakeasylum-v2` — char: yes

```
alone in a bare solitary-confinement cell, a soft glow of small four-point stars around her head, looking mildly terrified rather than serene. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-witchcast` — char: no

```
A witch in a tall pointed black hat standing in shadow in a dark alley at night, casting a spell — the tip of her wand glowing like a bright gold star — aimed at a couple fighting under a streetlight spotlight beside a car, the young woman throwing her purse. The witch herself is unlit and in shadow; the fighting couple is spotlit. Flat house colors, bold outlines. No text, no numbers.
```

### `cf-josiah` — char: yes

```
Walking with a friendly young man (her friend Josiah) down a Portland street, spotting a discarded paper coffee cup sitting on the ground and eyeing it curiously. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-wired` — char: yes

```
Having just gulped down the found cup of coffee, suddenly wide-eyed and jittery, buzzing with far too much caffeine energy, little vibration lines around her — she does not normally drink coffee. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-wallet` — char: yes

```
Having climbed over a fence, tipping out a stolen bag and scattering a handful of plain cards across a grassy lawn, deciding she doesn't want them after all. Blank cards, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-highway` — char: yes

```
Sprinting across a wide five-lane highway with cars rushing past on both sides, a startled bystander behind her — a reckless caffeinated dash. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-track` — char: yes

```
Running at full track-star speed with motion lines, narrowly dodging out of the path of a car by inches, a determined athletic stride. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-crowd` — char: yes

```
Lying on the pavement surrounded by a small worried crowd; a kind older African-American woman kneels beside her, hugging her gently and motioning for her to stay down. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-siren` — char: yes

```
Springing up and vaulting over a wooden fence to escape, as an ambulance with flashing lights approaches in the background. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-ride` — char: yes

```
Sitting in the passenger seat of a car beside a friendly Black man who is driving her somewhere, an easy casual conversation between them. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-container` — char: yes

```
Crouching and hiding inside a large metal storage container, peeking nervously out through the gap as she hears something coming. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-parkedcar` — char: yes

```
Hiding flat on the ground underneath a parked car, peering out warily at a police officer's boots and the silhouette of a police dog nearby. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-meth` — char: yes

```
Standing sheepish and embarrassed in front of two police officers, a small thought bubble beside her holding only a tiny coffee cup — the truth is she had only drunk coffee. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-valued` — char: yes

```
A police officer squinting in confusion at a plain blank loyalty card she has handed him instead of an ID, while she stands by looking indignant. Blank card, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-arrested` — char: yes

```
Being gently handcuffed and arrested by a police officer, wearing an indignant, put-out expression, convinced she did nothing wrong. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-jail` — char: yes

```
Sitting on a bench in a plain jail holding cell, holding a sad squished white sandwich at arm's length and offering it to a neighbor. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-sunrise` — char: yes

```
Walking out of a building at dawn with the sun rising behind her, turning her empty pockets inside out — her found silver bracelet and shiny penny both gone. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cf-penny` — char: yes

```
Looking down in dawning realization at a plain debit card in one hand and a single shiny penny in the other — all her collected coins turned into just one cent. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-keepout` — char: no

```
A single closed wooden door with a large sturdy padlock locking it shut, and a hand raised flat, palm-out, in front of the door in a clear 'stop, do not enter' gesture — private, keep out. Simple and iconic, one clear subject, generous cream space. Flat house colors, bold outlines. No text, no letters, no numbers.
```

### `nd-cluster2` — char: no

```
A single large soft blob outline containing several small vignettes of traits: a small figure with a crossed-out thought cloud (reduced mind-reading), a face with sound waves and music notes coming at its ears (sensory sensitivity), and a small figure beside a grid of dots (a knack for counting) — a cluster of characteristics gathered inside one shape. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-binaryspectrum` — char: no

```
A comparison diagram in three parts side by side: on the left two small checkboxes, one checked and one filled in solid (a yes/no binary); in the middle a single horizontal line with one mark sliding along it (a spectrum); on the right a loose cluster of scattered dots (a cluster) — three ways to picture the same trait. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-blobweb` — char: no

```
A diagram of four overlapping soft blob shapes arranged in a cluster, each blob holding a couple of small dots that connect by thin lines across the blob boundaries to dots in the other blobs — separate named conditions sharing one overlapping web of traits. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-phone2` — char: no

```
Two hands holding up a smartphone that shows a short vertical video of a talking head — a lighthearted satirical social-media clip casually handing out a diagnosis. Blank screen edges, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-escaping` — char: no

```
A figure standing while a strong, separate second self pulls and escapes outward from its body, breaking free of the outward shape other people see — the ache of a self that doesn't match the surface. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-assumptions` — char: no

```
A person-shaped blob with several unrelated objects stuck into it from outside — a mallet, a graduation cap, small hanging tags and labels — each one an assumption someone pinned on them at a glance; gender is just one of the many. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-youarehere2` — char: no

```
A small pie chart beside a grid graph, each with a single wedge or point marked and a little arrow pointing to it — a 'you are here' locator, the rough spot someone plots you on their mental chart. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-progression` — char: no

```
A left-to-right sequence of three stages joined by arrows: first a vague amorphous blob, then a more defined but still stiff and wrong figure, then a clear warm smiling woman — the vague shape, the closer guess, and the closest they'll come to the real you. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-olives` — char: no

```
Two simple people facing each other, each with an empty speech bubble — one surprised and delighted, the other calmly pleased — the small delight of a friend who has known you for years still discovering something new about you. Empty bubbles, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-setmind` — char: yes

```
The recurring woman lying cozy in bed at night, half-asleep with eyes closing, and a small dreamy wish-glow floating just above her head. Calm and warm. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-bed` — char: no

```
A dreamy shiny pink satin bed with a tufted headboard covered in round cinched buttons, glowing softly as if imagined, no person. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-headboard` — char: no

```
A white tufted headboard with round cinched buttons sitting abandoned in a narrow alley beside a little curb furniture, as if just left there. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-catwish` — char: yes

```
The recurring woman in bed at night imagining a small cozy cat kneading its paws on her chest, warm and content, a soft dreamy thought-glow around them. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-catreal` — char: yes

```
The recurring woman on a street looking startled at a cat perched on a brick wall staring back at her intently, as if she is late to a meeting. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-chocolate` — char: no

```
Three full-size chocolate bars on a kitchen counter, one unwrapped to reveal bright silver foil that looks like a golden ticket. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-partner` — char: yes

```
The recurring woman in bed at night, and above her floats a soft dreamy silhouette of an ideal romantic partner inside a thought-cloud. Wistful. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-hinge` — char: no

```
A smartphone held in a hand showing a dating-app chat screen with a fresh message bubble from a match and the match's small round profile photo — a hopeful message arriving. Empty bubble, no writing. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `mf-blackcat` — char: yes

```
The recurring woman sitting on a street at dusk beside a slim black cat that leans gently into her side sharing its warmth, tender and quietly magical. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-horse` — char: no

```
A smartphone screen showing a silly meme photo of a horse sitting at a desk in an office chair — an absurd, sweet surprise. No words on it. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `oc-child` — char: no

```
A young girl about ten years old with reddish-brown hair, looking anxious and carefully performing a small protective ritual, touching a doorframe with worry — a child's dread about her mother. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-cbt` — char: no

```
A young girl about ten with reddish-brown hair sitting across from a kind adult therapist who gently gestures as if to say it is only a trick of the brain; the girl listens. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-voices` — char: yes

```
The recurring woman standing uncertain, surrounded by several small whispering speech-shapes and wagging pointing fingers pressing in around her head — competing doubting voices. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-tracking` — char: yes

```
The recurring woman at a desk carefully noting results in a little notebook like a science experiment, with tiny tally marks and small plus and minus marks. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-art` — char: yes

```
The recurring woman calmly drawing at an easel, absorbed and non-judgmental, careful observing lines flowing onto the paper. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-witchkit` — char: yes

```
The recurring woman standing proudly in a driveway overflowing with piles of crystals and stacked boxes of tarot decks, running a booming little witch business. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-irony` — char: yes

```
The recurring woman holding a witch mask up in front of her face while a second different mask peeks out behind it — pretending to be a witch while pretending not to be one, a doubled irony. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-anger` — char: yes

```
The recurring woman sitting alone at home stewing, a hot red cloud of anger swirling around her, brooding after a breakup. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-spell` — char: yes

```
The recurring woman in bed at night concentrating intently, and floating above her a small soft symbolic effigy doll with a few large dark pins gently placed in its belly — casting an angry spell, stylized and gentle, not gory. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-result` — char: no

```
A man standing at a front door holding his stomach in pain, looking sheepish and apologetic, arriving unexpectedly. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-roadtrip` — char: yes

```
The recurring woman happily riding along on a whimsical road trip seated atop a big cheerful mushroom rolling down an open road, playful and surreal. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-bobbypin` — char: yes

```
The recurring woman sitting on a toilet in a large loft bathroom, reaching curiously behind the seat and discovering a single bobby pin, a spark of surprise. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-pick` — char: yes

```
The recurring woman crouched at a locked bedroom door using a bobby pin to pick the lock, the door clicking open on the first try, delighted and surprised. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-drawer` — char: no

```
An open top-left dresser drawer with a hand lifting out a small cloth drawstring bag of mushrooms from inside, as if gently guided. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-thread` — char: yes

```
The recurring woman following a glowing thread that leads from her own chest forward along a path toward a small unexpected doorway — desire quietly leading her somewhere new. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-brain` — char: no

```
A simple friendly brain with tiny gears quietly gathering scattered little pattern-dots and bundling them into one small arrow-shaped urge pointing outward. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-compass` — char: yes

```
The recurring woman holding a compass whose needle is a small glowing heart, letting her feelings point the way forward. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-shoulds` — char: yes

```
The recurring woman looking overwhelmed, bombarded by many little wagging pointing fingers and nagging speech-shapes pressing in from all sides. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-secretcode` — char: no

```
A small glowing whim-spark drifting down from a starry night-sky hand above toward a little person below, like a secret coded message sent from another world. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-neglect` — char: yes

```
The recurring woman calmly turning and walking away from a cluster of nagging pointing hands and voices behind her, following her own glowing path forward, serene. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-snake` — char: yes

```
The recurring woman hiking on a trail, stopping short and gasping as a snake appears in her path, a tense companion a few steps behind her — the snake breaking a heavy silence. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-lab` — char: yes

```
The recurring woman and a companion embracing at a scenic overlook while a friendly off-leash Labrador ambles over and nuzzles their backs — a warm reconciliation. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-cat` — char: yes

```
A cat on a low wall pulling away and refusing to be petted by a man reaching toward it, while the recurring woman watches knowingly. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-yorkie` — char: no

```
A hopeful little Yorkshire terrier peeking out from behind a garden fence, cute and gentle. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-retriever` — char: no

```
A large golden retriever rearing up on its hind legs and growling protectively at a dismissive man on a sidewalk. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-rat` — char: no

```
A rat darting under a restaurant table during a fancy candlelit dinner, a startling little omen. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `an-notice` — char: yes

```
The recurring woman walking, noticing several different animals around her that seem to mirror her feelings — a soft realization, little creatures echoing her mood. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-veil` — char: yes

```
The recurring woman gazing up at a deep starry night sky, a gauzy veil lifting to reveal glowing stars — remembering where she came from, a feeling of peace. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-fade` — char: yes

```
The recurring woman trudging through humdrum daily errands with shopping bags, a small warm feeling fading like the embers of a dying fire above her. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-grace` — char: no

```
A circle of people, some of them homeless, holding hands and saying grace together in a modest living room — an unexpected gathering. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-loft` — char: no

```
A bare, furniture-less loft at night with several young roommates sitting on the floor in a loose circle, a little aimless. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-wind` — char: yes

```
The recurring woman leaping forward with her eyes closed and feet lifted onto a small cloud of faith, carried by the wind on an adventure. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-volley` — char: yes

```
The recurring woman playfully keeping a single glowing golden ball up in the air like a volley, light and careful. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-shapeshifter` — char: yes

```
The recurring woman as a soft shape-shifting figure nodding along agreeably to several different companions, subtly blending to match each one. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-above` — char: yes

```
The recurring woman floating high above a large chessboard, observing the whole picture from a distance and quietly strategizing her next move. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-balcony` — char: yes

```
The recurring woman on a stranger’s balcony at night as a long-haired man beside her confesses a secret, small soap bubbles drifting down through the air. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-tinkerbell` — char: yes

```
A Tinkerbell-like woman with long flowing hair, seemingly the magical life of the party, but with a small grumbling heart visible inside her chest, tired and wanting coffee. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-burn` — char: no

```
A man joyfully burning a pile of his own old artwork in a backyard, small flames and curling drawings, having switched to a new style. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-garage` — char: no

```
A beautiful finished framed painting leaning forgotten and dusty against boxes in a cluttered garage, unseen, waiting for its debut. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-ai` — char: yes

```
The recurring woman holding up a phone showing two side-by-side drawings to a couple of puzzled friends who cannot tell which she drew and which a machine made. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-gaveup` — char: yes

```
The recurring woman around age twenty setting down her paintbrush and palette with a wistful look, gently giving up the dream of painting. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-journal` — char: yes

```
The recurring woman journaling in a notebook, adding small hand-drawn diagrams beside the words for things she could not put into language. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-gratitude` — char: no

```
A journal page filled with tiny simple sketches of small gratitudes — an extra cherry on an ice cream, a braided plait of hair, little everyday joys. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `af-forme` — char: yes

```
The recurring woman quietly delighted, drawing just for herself with no audience, simple imperfect joyful doodles floating around her. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-miracle` — char: yes

```
The recurring woman receiving an unexpected small gift falling gently into her open hands, amazed — a wished-for miracle arriving in a surprising form. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-constellation` — char: yes

```
The recurring woman looking up as scattered stars connect into a glowing constellation picture that seems to sing with meaning. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-fade` — char: no

```
A glowing constellation in the night sky slowly dimming, its connecting lines fading like a beacon receding into the past. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-scattered` — char: yes

```
The recurring woman cupping her hands, finding only crumbling stardust and a few scattered ordinary stars, the connecting lines gone. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-doubt` — char: yes

```
The recurring woman trudging along a gray path, her pockets heavy and sagging with little dark weights of doubt and fear. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-loom` — char: no

```
A simple weaving loom with two sets of strings, one going over and one under, forming a bit of cloth — the warp and the weft. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-shuttle` — char: no

```
A close view of a weaving shuttle lifting one set of loom strings to open a gap for the thread, the strings ready to return seamlessly together. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-innerlight` — char: yes

```
The recurring woman walking through deep darkness carrying a small warm inner light glowing in her chest, guiding her forward. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-theta` — char: yes

```
The recurring woman drifting into a dreamy half-asleep state in bed, imagining her desires as soft floating little wishes above her. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-cake` — char: yes

```
The recurring woman in a living room where two red chairs and two blue couches have been pushed together to block the only exit, as a warm housekeeper family-friend hands her a fork and a slice of cinnamon cake, insisting she eat. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-splinter` — char: yes

```
The recurring woman looking relieved as a stubborn splinter finally works its way out of the bottom of her bare foot after weeks. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-crown` — char: yes

```
The recurring woman on a walk, head tilted back, deliriously happy and laughing, a little glow rising to the crown of her head. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-herbalist` — char: no

```
A friendly herbalist woman arriving at a front door holding a piece of jewelry to be repaired, with bundles of dried herbs in her bag — an unexpected teacher. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-owl` — char: no

```
A snowy white owl swooping down out of a night sky with its wings spread wide toward the viewer — a manifested omen. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-candle` — char: no

```
A dinner candle burned down into a funny lumpy melted shape with a pair of googly craft eyes stuck on it, like a silly biblically-accurate-angel, sitting on a dinner table. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-mascfem` — char: yes

```
The recurring woman looking inward with a calm, curious expression, and within a soft glow around her heart two gentle aspects of herself — one softer and feminine, one stronger and masculine — standing together in balance. A tender moment of self-discovery. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-oldbed` — char: yes

```
An old dark wooden Victorian bed with ornate pointed spikes on the tall headboard, a bit imposing, that the recurring woman stands beside dutifully — a bed she feels obligated to keep. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-alley` — char: yes

```
The recurring woman walking down a narrow alley with a coffee cup in hand on her daily route, passing a bit of discarded curb furniture. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-why` — char: yes

```
The recurring woman sitting at a desk writing, pausing with a puzzled, reflective look — wondering why she had only wished for small childish things. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-forlorn` — char: yes

```
The recurring woman on an evening walk carrying a warm cup of tea, looking sad, forlorn and alone, homesick for a bit of magic. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mf-alibaba` — char: yes

```
The recurring woman glancing reluctantly at her buzzing phone showing an annoying shopping-app notification she does not want to check. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-rituals` — char: no

```
A young girl about ten years old with reddish-brown hair carefully performing strange protective rituals — touching things in a precise order, checking a light switch — anxious and meticulous. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-deepdown` — char: yes

```
The recurring woman with a quiet secret inner certainty glowing softly in her chest — deep down knowing that if anyone had magical powers, it was her. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-customers` — char: yes

```
The recurring woman behind a little counter fielding eager customer questions about love spells, surrounded by crystals and tarot boxes, secretly having never done a reading herself. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-summer` — char: yes

```
The recurring woman through a hot summer, a red cloud of anger singeing hotter and hotter around her as the season drags on. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `oc-heal` — char: yes

```
The recurring woman sitting in a car, sending a gentle beam of healing light toward her mother, mending her mother's blurry vision from afar. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-loft` — char: yes

```
The recurring woman standing in a big whimsical seven-bedroom loft with many doors, a grand quirky airy space. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-nathan` — char: yes

```
The recurring woman and her cheerful roommate, a young man, who is happily handing her the rest of a little cloth bag of mushrooms, unbothered and kind. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-patterns` — char: yes

```
The recurring woman going about an ordinary day while tiny scattered pattern-dots and little observations quietly drift into her mind and collect around her head. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `in-book` — char: no

```
A gentle glowing open book with a soft radiant kind figure on its blank cover, resting on a table — a spiritual channeling book whose idea is that our emotions are our navigation system. Flat house colors, bold outlines, cream space. No text, no letters, no numbers, blank cover.
```

### `in-temptation` — char: yes

```
The recurring woman being gently led forward by a soft glowing hand reaching down from a starry spirit-world sky, coaxing her toward a tempting open doorway. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-teams` — char: no

```
Two people sitting together at a small table doing an exercise, a shared worksheet between them showing a row of blank circles connected by dashed lines — comparing a person's opposite traits together as a pair. Blank worksheet, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-loft-v2` — char: no

```
A group of five or six housemates lounging and passing a joint around a sparse, furniture-less Brooklyn loft; give EACH person clothing with a different pattern or print (stripes, checks, florals, dots) — varied patterns across everyone, not just two of them. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-oneknob` — char: no

```
A simple diagram of a SINGLE control dial/knob with a curved scale beneath it and one arrow sweeping from a low setting on the left to a high setting on the right — just one knob. It represents the mistaken idea of a single 'a little to a lot' slider. Minimal, one clear subject. Flat house colors, bold outlines, generous cream space. No text, no numbers, no letters.
```

### `nd-manydials` — char: no

```
A simple row of about six different upright slider faders side by side, each set to a DIFFERENT height — showing many separate independent controls instead of one. Clean, flat, evenly spaced. Flat house colors, no gradients, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-profiles` — char: no

```
Three simple different people standing side by side; above each person floats a small row of little bars at different heights (a tiny bar-chart profile), and each person's profile pattern is clearly DIFFERENT from the others — each person a unique combination, not a ranking. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-everyone` — char: no

```
Many small simple people standing spread out evenly along a gentle low rounded hill, each at a different spot from one side to the other, with a single soft vertical line near the far right marking a threshold that only a few people stand past. A whole population spread across a range. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-manygenes` — char: no

```
A large scatter of very many tiny dots and specks, most pale and a handful brightly colored, all gently streaming and converging downward toward a single small simple human figure at the bottom — many tiny inherited contributions adding up into one person. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-boxes` — char: no

```
A smooth continuous field evenly scattered with small dots, and a pair of hands drawing rectangular boxes around parts of it with a pencil — but the boxes overlap awkwardly, do not fit the dots, and one is half-erased. Labels being drawn and redrawn on something continuous. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-overlap` — char: no

```
Two large simple overlapping circles (a Venn diagram) laid over a shared field of little upright sliders, the overlapping middle emphasized — two conditions sharing many of the same underlying controls. Two different flat fill colors for the circles, no gradients. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `nd-seed` — char: no

```
A simple sprouting seed growing into a small young plant, with a sun above and a little watering can beside it — the seed is the inherited starting point, the sun and water are the surroundings that shape how it grows. One clear subject. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-conflated` — char: no

```
Two separate differently-colored threads or ribbons tangled and knotted together into one confusing snarl so you cannot tell them apart — two different ideas mistakenly mashed into one. One clear subject, centered. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-twoaxes` — char: no

```
A clean simple diagram of two straight arrows crossing at right angles to form two independent axes — one horizontal arrow and one vertical arrow, like a plus sign with arrowheads on the ends — two clearly separate independent dimensions. Minimal and clear. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-eachspectrum` — char: no

```
Two separate horizontal bars stacked one above the other, each bar divided into several distinct stepped segments of flat solid color from one end to the other (a stepped range, NOT a smooth gradient) — each of two things is a range of many steps, not just two boxes. Flat house colors, absolutely no gradients, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-field` — char: no

```
A simple square field framed by a horizontal axis line and a vertical axis line, filled with many small dots representing people scattered across it: the dots are DENSELY clustered in one corner and thin out but still appear everywhere across the whole square — most people in one region, but every combination present. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-independent` — char: no

```
Four simple different little people standing in a row; above each person, two small separate indicator dots sit at independently-varying positions on two little tracks, so the two indicators clearly vary independently from person to person. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `gx-seed` — char: no

```
A simple seed sprouting into a small plant that leans gently to one side, with a large sun and a watering can nearby taking up much of the scene — a gentle inherited lean, and surroundings doing much of the shaping. One clear subject. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `zc-spell` — char: no

```
A dramatic night scene in a dark alley: in the foreground a girl and a boy fight next to a parked car under a bright overhead spotlight, the girl mid-throw hurling her handbag. Off to the side in deep shadow stands a classic witch in a pointed black hat, NOT lit up (a dark silhouette), calmly pointing her wand toward the couple — only the very TIP of her wand glows bright like a gold star. The spotlight stays on the fighting couple; the witch remains dark. Flat house colors, bold outlines, cream space. No text, no numbers, no letters.
```

### `md-bubble-test` — char: yes

```
The recurring woman gently blowing one big glowing soap bubble from a bubble wand, a fresh idea taking shape inside the shimmering bubble as it grows. A bubble wand, not a pump.
```

### `md-justmeditate` — char: no

```
A couple of cheerful relatives urging a reluctant young woman to just meditate — one sitting cross-legged demonstrating serenely and gesturing at her — while she stands skeptical and a little overwhelmed. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-since` — char: yes

```
The recurring woman with her head full of many small buzzing thoughts she is constantly sorting and managing — a busy mind that has never simply switched off, something she has done since childhood. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-bubble` — char: yes

```
The recurring woman gently blowing one big glowing iridescent soap bubble from a bubble wand, a fresh idea taking shape inside the shimmering bubble as it grows. A bubble wand, not a pump. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-train` — char: no

```
A whimsical little party train of several cars floating inside a big shimmering soap bubble, each car a different playful theme — one witchy, one a jazzy speakeasy, one a leafy tropical lounge — a delightful daydream. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-badthoughts` — char: yes

```
The recurring woman surrounded on all sides by dark cloudy intrusive-thought monsters with grumpy faces crowding in toward her, pressing inward from every direction. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-push` — char: yes

```
The recurring woman bracing and pushing the dark intrusive-thought monsters back with her hands, holding them off one at a time like a busy game of whack-a-mole, determined. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-bigidea` — char: yes

```
The recurring woman standing calmly as one enormous glowing iridescent soap bubble swells so big it crowds all the little dark thought-monsters out to the edges and away. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-meditate` — char: yes

```
The recurring woman sitting cross-legged trying to meditate with an emptied mind, but with no bubble to fill the space the little dark thought-monsters creep back in around her, a small question mark above her head. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-place` — char: yes

```
The recurring woman peacefully arriving in a warm, tidy, cozy inner room full of soft light and plants — a nice inner place to land when she goes quiet, rather than a cluttered garbage dump. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-sauna` — char: yes

```
The recurring woman and her friend Mason sitting together on a bench in a warm wooden sauna. Mason is a gentle poet-philosopher with longish red hair, a red beard, and round glasses; he gestures calmly as if gently saying just meditate. She sits beside him looking stuck and unable to, an empty thought bubble rising from her head.
```

### `md-ballpit` — char: yes

```
The recurring woman flailing and half-drowning in a deep children's ball pit full of little round balls, only her head and one reaching hand above the sea of balls, overwhelmed and sinking.
```

### `md-tunnel` — char: yes

```
The recurring woman trapped upside down inside the curved loop of a curly children's playground slide-tunnel, part of a whole winding obstacle play structure she has to crawl through to get out, disoriented and stuck.
```

### `md-smoke-friends` — char: yes

```
A circle of about five friends sitting cross-legged in a ring on the ground among tall pine trees, relaxed and happy, passing a joint around. The recurring woman is among them in her star-patterned outfit; each of the other friends wears their own different pattern — stripes, dots, checks — all distinct and cheerful.
```

### `md-smoke-dumpster` — char: yes

```
The recurring woman sitting alone inside a grubby metal dumpster smoking a joint, pinching her nose with her free hand because piles of trash and garbage bags surround her.
```

### `md-wake-nice` — char: yes

```
The recurring woman waking up in bed stretching happily in a bright, tidy, cheerful bedroom. On the wall hangs a big friendly poster showing three little pictures of her day: a small figure taking a walk, a small happy figure sitting cross-legged on the floor doing an art project with scissors and colored paper, and a bakery croissant. Bright pastel pinks and yellows. Only little pictures on the poster, no words.
```

### `md-wake-dingy` — char: yes

```
The recurring woman waking up in bed stretching in a messy room strewn with dirty clutter and junk across the floor. IMPORTANT: she and her bed keep soft pastel colors, but everything around her — the clutter, the junk, the walls and floor — is drab, muted and dingy, tinged with gray and black, clearly grimy compared to her.
```

### `mm-twoplanes` — char: no

```
A simple clean diagram of two stacked horizontal planes: a lower plane holding a few ordinary everyday objects, and an upper glowing plane holding a few clean abstract geometric forms — the world of things below, the plane of concepts above. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-teaset` — char: no

```
A matching tea set grouped together on a tray — a teapot and cups all sharing the same pattern and color, clearly belonging together by their shared look. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-firstaid` — char: no

```
An open first-aid kit with unlike items inside — a bandage, small scissors, a bottle of antiseptic, a roll of gauze — nothing alike, yet all belonging together by a shared purpose. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-belong` — char: no

```
A diagram: at the bottom a single point splits into two arrows that rise to two different glowing planes above — one plane holding identical matching shapes, the other holding several different shapes bound together by a small heart. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-pointer` — char: no

```
A diagram of two different concrete objects — an hourglass and a coin — each with a line rising up to meet at a single shared glowing point floating above them, the abstract idea they both point to. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-machine` — char: no

```
A whimsical hand-cranked contraption: small concrete objects go in one side and a single glowing abstract form floats up out of the top — a machine that finds the invisible concept shared by the things fed into it. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-tunein` — char: yes

```
The recurring woman reaching upward with a calm focused expression, tuning in and gently pointing at a glowing abstract form floating on a plane above her, as if locating something that was already there. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-collect` — char: no

```
A few different concrete objects laid together in a row, with a soft glowing shared shape rising up between them — the common essence they all point to becoming visible. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-ladder` — char: yes

```
The recurring woman climbing a tall ladder that rises from the ground-level world of objects up toward a glowing plane of abstract forms floating above — the ladder is only the way up. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-essence` — char: no

```
A single ordinary object resting on a surface with its glowing translucent essence gently rising up out of it like a form — the abstract idea living inside the concrete thing. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-teach` — char: yes

```
The recurring woman warmly handing a few small concrete objects to another person, whose head lights up with a glowing abstract form as they grasp the concept for themselves. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `nd-cluster` — char: no

```
A single large soft blob/cloud outline containing several distinct little symbolic icons floating inside it, grouped as one cluster of separate traits: a thought-bubble with a line slashed through it (not reading minds), a small face covering its ears against jagged loud-noise lines (sensory sensitivity), and a little abacus with a clever small bird beside it (a knack for counting). The blob gathers these different traits together as one cluster. Flat house colors, bold outlines, generous cream space. No text, no letters, no numbers.
```

### `nd-tom` — char: no

```
Two simple people facing each other; above one person floats a thought-bubble that the other cannot see, drawn with a soft slash across it to show it is not being read — one person cannot easily guess what the other is thinking. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-sensory` — char: no

```
A single person wincing and covering both ears with their hands, surrounded by jagged spiky lines and a couple of loud music/noise marks pressing in from all sides — overwhelming sensory sensitivity. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-savant` — char: no

```
A single person happily and effortlessly working a little abacus, with a cheerful swirl of small dots and simple shapes orbiting their head, showing an easy special knack. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-binary` — char: no

```
A simple minimal diagram of just two checkboxes stacked vertically: the top checkbox has a tick mark in it, the bottom checkbox is empty — a strict either/or yes-or-no binary. Nothing else. Flat house colors, bold outlines, generous cream space. No text, no letters, no numbers.
```

### `nd-spectrum` — char: no

```
A single long horizontal line like a ruler with a small slider marker sitting at one point along it, and one little person standing beside the marker pointing to their spot on the line — a single sliding scale from one end to the other. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-clusterdots` — char: no

```
A loose cluster of many small dots in several different flat colors grouped into a soft rounded cloud shape (NOT arranged along a line), with a few faint dotted links between some of the dots — a cluster, not a single scale. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-aha` — char: no

```
A single cheerful cartoon person pointing proudly at their own chest with a big open-mouthed excited expression, as if announcing something about themselves, with an EMPTY speech bubble (no text inside) beside their mouth. Flat house colors, bold outlines, cream space. No letters, no text, no numbers.
```

### `nd-web` — char: no

```
Four large soft overlapping blob shapes clustered together and partly overlapping like an abstract four-way Venn diagram, each blob a different flat translucent color. Scattered across and between them are small simple trait-icon dots connected by thin lines into one shared web, with several icons sitting in the overlap regions shared between blobs — four different conditions that overlap and share many of the same underlying traits. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-tiktok` — char: no

```
A hand holding up a smartphone; out of the phone's screen a pointing finger and a little cartoon face lean out toward the viewer, accusingly and playfully calling the viewer out. A couple of little social-media heart and notification shapes float around the phone. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `nd-helix` — char: no

```
A single clean, simple, iconic DNA double helix standing vertically — two twisting strands connected by short rungs like a spiraling ladder. Minimal and clear, one clear subject. Flat house colors, bold outlines, generous cream space. No text, no letters, no numbers.
```

### `nd-populations` — char: no

```
Two simple overlapping bell-curve humps side by side, each drawn as a smooth rounded hill filled with a different flat solid color, partly overlapping in the middle where they blend into a shared middle zone — two populations whose ranges overlap rather than being separate. Flat solid fills, absolutely no gradients. Bold outlines, cream space. No text, no letters, no numbers.
```

### `hr-toddler` — char: no

```
A small child noticing for the first time that another person nearby has their own separate thought bubble floating above their head — a gentle dawning realization that other minds exist. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-trains` — char: no

```
Two people talking side by side: one leaning in animated and excited with a big empty speech bubble containing only a tiny simple steam-train drawing; the other sitting stiff and glazed-over with a flat bored face and a small thought bubble holding a tiny wilting droopy shape. Empty bubbles, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-ask` — char: yes

```
The recurring woman leaning in warmly and curiously to ask a companion a question; the companion brightens happily, an empty speech bubble beside them holding a single tiny ladybug. No words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-context` — char: yes

```
The recurring woman quietly observing a companion who is fidgeting with their fingers and glancing away toward a doorway; small dotted sight-lines show her noticing the subtle cues. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-why` — char: no

```
A clean simple diagram: a single figure with a soft rounded thought cloud representing an intention, connected by a line to a speech bubble representing an action — intention leading to action. Empty bubbles, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-web` — char: no

```
A diagram of several small empty boxes arranged in a ring, each with a curved arrow pointing inward to a single central point — every action tracing back to one intention at the center. Empty boxes, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-matchbox` — char: no

```
A single humble old-fashioned matchbox, half slid open, resting on a surface — a pattern-collector waiting to be filled. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-tictac` — char: no

```
A hand dropping tiny round tic-tac-like beads one at a time into an open matchbox, collecting little pieces of evidence one by one. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-disagree` — char: yes

```
The recurring woman raising one eyebrow, mildly surprised, tucking a small folded note into a little box — filing away a moment that didn't fit her idea of someone. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-constellation` — char: no

```
Two people sitting across a small table with a little box between them; above them float scattered star-dots not yet connected into a constellation. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-safespace` — char: no

```
Two people sitting across a small candlelit table in a dim warm room, a single candle glowing between them, small folded cards spread on the table, a gentle trusting mood. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-daisy` — char: no

```
A daisy with several petals being plucked one by one and drifting down, with two small matchboxes waiting open beside it to collect the evidence. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-matchboxes` — char: no

```
Two matchboxes side by side like the two pans of a balance scale, each holding a small stack of little blank note-slips, weighed against each other. No words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-traits` — char: no

```
Many small empty action-boxes connected by fine lines that resolve together into the soft outline of a single calm face — scattered actions adding up into one character. Empty boxes, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-venn` — char: no

```
A clean venn diagram of two overlapping circles with a couple of small empty boxes feeding into them and the shared middle gently highlighted — finding what actions have in common. No words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-paradox` — char: no

```
A single stylized figure with many arms flung out pointing in many different directions at once — a person full of contradictions, pointing every way. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-star` — char: no

```
A star-burst of beaded arrows radiating out from and converging on a single central point — a star of paradox, many contradictory threads all pointing back to one center. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-map` — char: no

```
A small framed map showing a single winding path across a simple minimal landscape — a map of a person's inner terrain of values and beliefs. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-forever` — char: yes

```
The recurring woman looking thoughtfully at another person and seeing a steady glowing core of values and beliefs resting inside their chest. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-retro` — char: no

```
A scattered handful of puzzle pieces in mid-air suddenly snapping together into one clear finished picture — a late realization rearranging everything that came before. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-ambiguous` — char: no

```
A single round event drawn like a soft permeable membrane cell, holding a few simple floating shapes inside it — one circle plus a triangle and a square — the several possible interpretations of one event. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-context2` — char: no

```
The same round membrane-cell event with a hand reaching in to select and lift out one shape from among the possible interpretations inside — context choosing the meaning. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-seeds` — char: yes

```
The recurring woman kneeling to plant a small glowing seed in the soil, with a faint future bloom lightly sketched in the air above it — planting an event whose meaning will be revealed later. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-caution` — char: yes

```
The recurring woman holding a small glowing idea gently in her open cupped palms, a light question mark hovering above it — holding a conclusion loosely as a theory, careful not to project. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-scatter` — char: no

```
A person seen from a low angle looking down at a few small scattered pattern-pieces on the ground, reaching to pick one up as if to pocket it, an empty thought bubble above holding a single small collected shape — noticing an example of a pattern to save for later. Empty bubble, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-evidence` — char: no

```
A clean diagram of small blank note-cards arranged in a vertical zig-zag staircase, with a short arrow pointing in toward some cards from the left and toward others from the right — collecting evidence into two competing piles. Empty cards, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-competing` — char: no

```
A clean diagram of three small circles connected in a row by dashed lines, the last dash ending in a solid filled arrowhead pointing forward — three separate examples leading to a single conclusion, a guess or a theory. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-corebeliefs` — char: no

```
A clean diagram of three blank overlapping ovals nested in a small cluster — an innermost oval feeding outward into a middle oval and then an outer oval, actions gathering upward into a lasting character. Empty ovals, no words. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-skeptics2` — char: no

```
One clear tableau: a single UNITED crowd of about eight to ten different people standing together as one group, ALL facing the same direction to the right with hostile, dismissive and fearful expressions aimed at the same target off to the right. Among them: a scientist in a white lab coat holding a blank clipboard shaking his head, a couple of loud men shouting with raised fists, a stern arms-crossed woman, a frowning man pointing accusingly, a fearful onlooker. They are clearly on the SAME side as each other, a mob united against something to the right. Use a WIDER, more varied palette — blues, greens, browns, teal, muted tones, not only pink and orange — so each figure is distinct. NONE of these people wear star patterns. Bold black outlines, flat colors, generous cream space. No text, no letters, no numbers.
```

### `zc-fearmask2` — char: no

```
A single cartoon MAN recoiling backward in fear, wide eyes, hands raised defensively, while his own dark shadow cast on the wall behind rises up bigger as an aggressive shape with a raised clenched fist. Fear turning into aggression. He wears ordinary plain clothes with absolutely NO star patterns. Use a varied palette (blues, greens, browns) so he is distinct. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zw-mirror2` — char: no

```
A calm symmetrical 'as above, so below' scene with one clear horizontal waterline across the middle. TOP half: an unmistakable night SKY in deep blue-black, a scatter of golden stars, a soft crescent moon, and a low silhouette of trees and a hill against the sky. BOTTOM half: an unmistakable still body of WATER (a calm lake) that mirrors the sky and land above it as an upside-down reflection, with a few gentle horizontal ripple lines so it clearly reads as water. Use blues for both the sky and the water so each is obvious. The bottom is a near-mirror of the top. Bold outlines, flat colors, generous cream space. No text, no letters, no numbers.
```

### `zc-fearmask3` — char: no

```
A single MAN recoiling backward in fear, wide eyes, hands raised defensively, while his own dark shadow cast on the wall behind rises up bigger as an aggressive shape with a raised clenched fist — fear turning into aggression. Draw him in the SAME elegant clean flat line-art house style as the reference images (NOT an overly cartoonish or thick comic-strip look). Warm house palette. He wears ordinary plain clothes with absolutely NO star patterns. Bold clean outlines, flat colors, generous cream space. No text, no letters, no numbers.
```

### `zw-skeptics3` — char: no

```
One clear tableau: a single UNITED crowd of eight to ten different people standing together as one group, all facing and gesturing the same direction to the right with hostile, dismissive, fearful expressions aimed at the same target off to the right — among them a lab-coat scientist holding a blank clipboard shaking his head, a couple of loud men shouting with raised fists, a stern arms-crossed woman, a man pointing accusingly. Clearly one mob on the same side. Use ONLY the warm house palette — pink, salmon, orange, gold, terracotta, brown, black, cream — and vary each person's colors within it so they are distinct. Do NOT use blue, green or teal. NONE wear star patterns. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zc-laugh2` — char: no

```
The recurring character (reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants) stands earnestly holding out a small glowing charm in her open hands. Beside her, two other people wave their hands dismissively and laugh at her, brushing it off as frivolous. The two mockers wear plain ordinary clothes with absolutely NO star patterns. Warm house palette. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zc-cantdo2` — char: no

```
A man standing just outside a glowing magic circle where two happy women work magic together with little sparkles and a floating candle. He is shut out and looks SAD and wistfully annoyed that he cannot do it himself — a sulking, left-out, envious expression, NOT angry. Give him interesting stylish clothes (a nicely patterned jacket in warm colors) but NO star patterns. Warm house palette. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zc-reality2` — char: no

```
One clear funny scene at a small restaurant table: now the MAN is the one with a big splat of spaghetti down the front of his shirt, standing up and storming off in a huff with an embarrassed, flustered, angry face; the woman stays seated at the table watching him leave, surprised. Two wine glasses and a messy plate of spaghetti on the table. Warm house palette. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zw-ecliptic2` — char: no

```
A simple side-on diagram of a solar system seen edge-on as one flat plane: a golden sun at the left, and several small MADE-UP planets — plain simple colored circles of different sizes and simple patterns, NOT real recognizable planets, with absolutely NO faces or personalities — strung out along a single straight flat horizontal line receding to the right, every planet on the same flat line. Warm house palette. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zw-gossip3` — char: no

```
One clear playful tableau: two young women on tall high-backed bar stools at a small round bistro table, gabbing over wine and a plate of cheese and crackers. LEFT woman: reddish-brown messy topknot, pink jacket with small black stars, pink-and-orange striped pants, one hand raised in an 'oh my gosh!' gesture. RIGHT woman clearly different: straight black bob, mustard-golden jacket and plain trousers (no stars, no stripes), hand to cheek, surprised. Floating above their heads, a tidy cluster of exactly twelve small round MEDALLIONS, each built as concentric rings: a white center circle holding a different little cartoon face with a different emotion, then a thin gold ring, then a THICK colored ring, then a thin gold ring. IMPORTANT: each of the twelve medallions has its thick ring in a DIFFERENT color — red, orange, yellow, green, teal, blue, purple, magenta, pink, brown, plum, rust — NOT all the same. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zw-twelve2` — char: no

```
A neat grid of exactly twelve simple distinct human portrait busts, three tidy rows of four, evenly spaced. Each is a different person AND shows a DIFFERENT emotion — some angry, some tired, some sad, some bored, some surprised, some annoyed, only a couple happy — clearly NOT all smiling. Varied hairstyles, skin tones and clothing colors. Bold clean line-art. Generous cream space. No text, no letters, no numbers, no symbols.
```

### `zw-spin3` — char: no

```
A single simple planet Earth as a flat round globe with clearly BLUE oceans and GREEN continents (no yellow landmasses at all), and one bold black curved arrow looping around it to show it spinning on its own axis. Centered, generous cream space. Bold outlines, flat colors. No text, no letters, no numbers.
```

### `zc-cell` — char: no

```
A woman standing alone in a modern padded solitary-confinement cell with a small barred window high on the wall, wearing a plain simple gown. She has a soft glow of small golden four-point stars around her head, and looks mildly frightened, small and vulnerable — NOT serene, proud or holier-than-thou. Pale quiet cell, warm house palette on her. Bold outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `nd-phone2-v2` — char: no

```
Two hands holding up a smartphone; the vertical video on the screen shows a person clearly picking their nose — a lighthearted satirical clip casually handing out an ADHD diagnosis. The nose-picking is the joke. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-affirm-v2` — char: yes

```
The recurring woman standing in front of a tall oval mirror, pointing at her own reflection and smiling warmly; the reflection in the mirror correctly mirrors her, also pointing back at her — a private positive affirmation to herself. The mirror truly reflects what she is doing. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-broadcast-v2` — char: yes

```
The recurring woman talking on and on obliviously, over-sharing her private inner story out loud as if it were plain fact, to two companions who look mildly uncomfortable — one raising a finger to his lips as if thinking 'I didn't need to know all that.' A picture of lack of self-awareness. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-project-v2` — char: no

```
A man venting with a big angry spiky speech bubble aimed outward at a small distant figure, while inside his own chest sits a smaller hurt version of HIMSELF — the tender feeling he is really protecting is about himself, projected outward as if it were about the world. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-skeptics-v2` — char: yes

```
A single unified crowd of skeptical people bunched together as one mob, all facing the same direction and scoffing toward one woman doing astrology off to the side — the crowd is united against her, NOT arguing among themselves. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zw-mirror-v2` — char: no

```
The old idea 'as above, so below': the TOP half is a clear night sky full of stars, the BOTTOM half is a still body of water that mirrors the sky back. The bottom clearly reads as water and the top clearly reads as sky, one reflecting the other. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `md-sauna-v5` — char: yes

```
The recurring woman and her friend Mason sitting together on a bench in a warm wooden sauna. She is wrapped in a white towel (sauna clothes) instead of her usual jacket and striped pants; Mason beside her also in a towel. Mason is a gentle poet-philosopher with longish red hair, a red beard, and round glasses; he gestures calmly as if gently saying just meditate. She sits beside him looking stuck and unable to, an empty thought bubble rising from her head.
```

### `cv-affirm` — char: yes

```
The recurring woman standing in front of a tall oval mirror, pointing at her own reflection and smiling warmly, giving herself a private positive affirmation — an inside encouragement just for her. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-gentle` — char: yes

```
The recurring woman with two contrasting speech shapes around her: a spiky harsh speech bubble pointing outward toward others, and a soft rounded gentle thought bubble curling back toward herself — the blunt thing said out loud versus the kind way she speaks to herself inside. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-leeway` — char: yes

```
The recurring woman looking calm and free, a soft glowing private thought inside her chest that is clearly different from a plain flat label a couple of small onlookers see on her outside — and she is at ease with the gap between them. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-project` — char: no

```
A man venting with a big angry spiky speech bubble aimed at a small distant figure, while a smaller soft hurt feeling sits quietly inside his own chest — a protective feeling projected outward as if it were a fact about the world. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-parvati` — char: no

```
A woman joyfully awakened to her spiritual side, sitting cross-legged amid gentle incense smoke and a lotus flower, proudly gesturing as if announcing a brand-new spiritual name for herself, while two family members nearby look on bemused. Warm and comic. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `charlie-shape` — char: no

```
A simple minimal iconic diagram in the house line style: a small tight cluster of five dark charcoal-grey dots (hard events), with a bright golden rounded-rectangle box being drawn around them, and the dots inside the box turned warm gold — the SAME dots, reframed by the box into meaning. A hand drawing the box. Clean and iconic, lots of cream space. Flat colors, bold black outlines. No text, no numbers.
```

### `evan-shape` — char: no

```
A simple minimal iconic diagram in the house line style: two dots — one small, one larger — joined by a single curved arrow that loops backward on itself into a closed ring so it points back to where it began; a small calm open eye rests inside the ring — a connection that runs backward through time. Clean and iconic, lots of cream space. Flat colors, bold black outlines. No text, no numbers.
```

### `nd-aha-v2` — char: yes

```
having a calm, understated moment of quiet recognition about being autistic — a small subtle nod, a faint knowing look, NOT big exaggerated emotion (keep the expression flat and low-key). Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `zc-cell-v2` — char: yes

```
sitting alone looking worried, lost and a little hopeless (NOT terrified), with a soft golden glow around her head and several small four-point stars floating around her that read as quiet magic, not madness. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-age-v2` — char: yes

```
sitting at a restaurant table being handed a folded children's menu that shows little food pictures and a simple maze (NOT animals), being talked down to and read as far younger than she is. She is at a table, not holding a coffee. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-mask-v2` — char: yes

```
a flat mask of her own calm face being lifted away to reveal that the being underneath is a small snake-like / alien creature — clearly NOT an ordinary person. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gd-snake-v2` — char: yes

```
an unrecognized small snake-like self glimpsed softly glowing through her middle, trying to be seen — WITHOUT any gaping hole cut into her chest; her body stays whole and the inner self shows through gently. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-balcony-v2` — char: yes

```
standing on a stranger's rooftop balcony at night looking dismayed and weary (NOT happy), soap bubbles drifting down around her, a long-haired man confiding a secret nearby. Her face shows she'd rather be home. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-corey-v2` — char: yes

```
seated across a DINNER TABLE from her uncle — a distinct older man in interesting patterned clothes telling his life story warmly — while she nods with a slightly annoyed, disappointed expression. Two clearly different people at a set dinner table. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-parvati-v2` — char: no

```
An older woman — the narrator's AUNT, who must NOT look like the recurring young woman (give her distinct grey-streaked hair worn differently and different clothing, NOT a reddish-brown topknot or a pink star jacket) — joyfully announcing a brand-new spiritual name for herself with arms raised, while a couple of family members around her roll their eyes. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `c2-herbalist-v2` — char: no

```
Two clearly DIFFERENT women together: on the left a young woman with reddish-brown hair in a messy topknot and a pink jacket with small black stars; on the right a distinctly OLDER herbalist woman with grey hair and a turban, showing dried herbs and remedies. The herbalist must look clearly older and different, not a copy of the young woman. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `cv-keepout-v2` — char: no

```
A 'private, keep out' scene with NO words: yellow-and-black hazard/caution tape strung across a messy pile of cardboard boxes crammed into a car trunk, with a couple of orange traffic cones beside it. Flat house colors, bold outlines, cream space. No text, no letters, no numbers.
```

### `af-garage-v2` — char: no

```
A large ABSTRACT painting — bold non-representational shapes and marks, clearly abstract art — propped up and slowly rotting in a cluttered, dim garage, unseen by anyone. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `gm-shuttle-v2` — char: no

```
A mechanically accurate weaving loom close-up: a boat shuttle carrying the horizontal weft thread passing through the vertical warp threads, with half of the warp threads lifted and half lowered so the weft correctly goes over-and-under. Show the real weaving mechanism accurately. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `ht-grace-v2` — char: no

```
A small gathering of homeless people saying grace together around a makeshift shared meal, clearly inside a homeless person's living space with belongings and trash scattered around; use a cooler, more muted color scheme distinct from the other cards. Flat colors, bold outlines. No text, no numbers.
```

### `sl-sadlamp-v2` — char: no

```
A bright SAD therapy lamp glowing on a desk in a room where the curtains are pulled shut and daylight is blocked out, so the room is dim and the lamp is clearly the only light source. The drawn curtains make it obvious why the lamp is needed. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `hr-safespace-v2` — char: no

```
A few blank index-style cards that were clearly hand-made — plain white cards with hand-drawn pencil lines and loose scribbles on them — with a couple of pencils lying around, NOT slick pre-printed cards. Homemade and a little messy. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mm-teaset-v2` — char: no

```
A traditional white tea set on a plain background, decorated with simple painted blue or pink daisies — a teapot, two teacups on saucers, plus a sugar bowl and a creamer. Classic and simple, NOT a busy Japanese pattern. Flat house colors, bold outlines. No text, no numbers.
```

### `butterfly-squinch-v2` — char: no

```
A pair of fingers gently pinching / snuffing a small butterfly closed — softly quieting a fluttering thought, a gentle 'mind tool'. The butterfly is being squinched shut, not harmed. Flat house colors, bold outlines, cream space. No text, no numbers.
```

### `mind-tools-flatlay-v2` — char: no

```
A flat-lay bird's-eye view of a neat row of small WHITE 'mind tools' lined up precisely on a cream background, like a surgical instrument set laid out perfectly before an operation — a little butterfly snuffer, a small net, slender tweezers, a tiny brush and a few more invented gentle instruments, evenly spaced. Flat colors, bold outlines. No text, no numbers.
```

### `tupperware-drawer-v2` — char: no

```
An overhead view of someone's hands sorting through an open kitchen drawer of food-storage containers, choosing which one fits — the containers are WHITE or clear/see-through with lids in a few different colors, some with more compartments than others. Flat house colors, bold outlines. No text, no numbers.
```

### `na-onetwo` — char: no

```
A very simple minimal diagram in the house line style: one white rounded rectangle on the left, a dashed arrow leading to the right where it has split into TWO white rounded rectangles — the upper one holding a simple circle, the lower one holding a simple square. One thing becoming two. Clean, minimal, lots of cream space. Flat colors, bold black outlines. No text, no numbers.
```

### `na-youarehere` — char: no

```
A very simple minimal diagram in the house line style: a horizontal strip of five small white rounded rectangles in a row, connected by a thin line; the SECOND rectangle is filled warm gold and has a tiny standing figure inside it marking your position, with a small arrow pointing down at it from above. A little 'you are here' position map. Clean, minimal, cream space. Flat colors, bold black outlines. No text, no numbers.
```

### `zc-reality` — char: no

```
One clear funny scene at a small restaurant table: a young woman standing up mid-storm-out, a splat of spaghetti spilled down the front of her shirt, swinging her handbag through the air, mouth open yelling; across the little table a baffled man leans back with both hands raised, confused and speechless. Two wine glasses and a messy plate of spaghetti on the table. Bold black outlines, flat house colors, generous cream space. No text, no letters, no numbers.
```

### `zc-axes` — char: no

```
A simple cross-shaped diagram: two thin black lines crossing to make a plus sign that divides the space into four equal quadrants. In each of the four corners sits one small cartoon figure reacting differently: a scientist in a white lab coat holding a blank clipboard and shaking his head, a loud sports-fan shaking his fist, a fearful robed priest clutching a cross, and a person laughing and waving dismissively. Clean, evenly spaced. Bold outlines, flat house colors, cream space. No text, no letters, no words, no numbers.
```

### `zc-fearmask` — char: no

```
A single cartoon figure recoiling backward in fear with wide eyes and hands raised defensively, while its own dark shadow cast on the wall behind rises up bigger as an aggressive shape with a raised clenched fist. Fear turning into aggression. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-christian` — char: no

```
Two figures facing off: on the left a robed religious man clutching a cross to his chest and recoiling in alarm; on the right a calm, gentle witch in a pointed hat standing quietly holding a small lit candle, unbothered. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-cantdo` — char: no

```
A man standing outside a glowing magic circle with his arms crossed and a frown, excluded and threatened, while inside the circle two happy women work magic together with little sparkles and a floating candle. He watches from the outside, left out. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-wisewoman` — char: no

```
A single serene wise-woman seated, holding an open glowing book on her lap with soft light rising from its blank pages, bunches of dried herbs and a small bottle beside her, calm and knowing, a faint halo of small four-point stars around her head. Bold outlines, flat house colors, cream space. No text, no letters, no numbers, blank pages.
```

### `zc-trial` — char: no

```
One woman standing alone in the center, small and calm, surrounded by a tight ring of many accusing hands and pointing fingers jabbing toward her from all sides (only arms and pointing hands around the edges). A scene of collective accusation. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-stakeasylum` — char: no

```
A two-panel diptych split down the middle by one thin vertical line. LEFT panel: a woman tied to a tall wooden stake with bundles of kindling at her feet, a stylized historical witch-burning, flat and simple, no visible flames. RIGHT panel: the very same woman in the same upright pose but now standing in a modern padded cell wearing a plain gown, a small barred window behind her. The same containment in two eras. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-crazycage` — char: no

```
A woman standing calmly behind tall vertical prison-style bars, her head glowing with soft light and small four-point stars to show powerful knowing thoughts; the glow of her mind is the very reason she is caged. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-laugh` — char: no

```
A woman standing earnestly, holding out a small glowing charm in her open hands, while two or three people beside her wave their hands dismissively and laugh at her, brushing it off as silly and frivolous. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-scale` — char: no

```
A simple balance scale weighing two things: on the left pan a dull crumpled grey lump, on the right pan a small bright glowing golden star; the scale tips to a wobbly in-between, not settling on either side. Clean and simple. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-star` — char: no

```
Two or three ancient robed astrologer-magi walking at night across a low hill, following one large bright golden star high in the dark starry sky ahead of them, one of them pointing up at it. Calm and reverent. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zc-wandspaghetti` — char: no

```
One funny image: a frustrated man scowling and shaking a magic wand that is drooping and turning into limp spaghetti noodles, a few cooked noodles flopping off the end, a little failed puff of grey smoke. He cannot make the magic work. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-gossip2` — char: no

```
One clear playful tableau: two young women on tall high-backed bar stools at a small round bistro table, gabbing over dinner — two glasses of red wine and a plate of cheese and crackers between them. The woman on the LEFT has reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, and pink-and-orange striped pants; one hand raised in an animated 'oh my gosh!' gesture. The woman on the RIGHT looks clearly DIFFERENT: straight black hair in a neat bob, a mustard-golden jacket and plain solid trousers (NO stars, NO stripes); lively surprised face, hand to cheek. Floating above their heads, a tidy cluster of exactly twelve small round MEDALLIONS, each built as concentric rings: a white center circle holding a different little cartoon face with a different emotion (angry, annoyed, happy, scared, smug, dopey, crying, surprised, and so on), then a THIN gold ring, then a THICK jewel-tone ring (rich emerald green or midnight blue) about eight times thicker than the gold ring, then a THIN gold ring on the outside. Bold black ink outlines, flat colors, cream space. No text, no letters, no numbers.
```

### `zw-skeptics` — char: no

```
One clear tableau of a skeptical crowd of about ten cartoon men who dislike what they see, in two groups. On the left, several loud sports-fan type men shouting and shaking their fists in the air, mouths wide, angry. On the right, several calm scientist type men in white lab coats holding blank clipboards, frowning and shaking their heads 'no'. Bold black outlines, flat house-palette colors, generous cream space. No text, no letters, no numbers, no signs, blank clipboards.
```

### `zw-grammar` — char: no

```
Three simple emblems in a row connected by two small arrows, left to right: first a single little cartoon person (a character), then a theatrical costume with a small mask on a stand, then a small open doorway into a little room. Clean and simple, evenly spaced. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-grid` — char: no

```
A clean simple grid diagram, four columns by three rows, twelve empty tidy cells with thin black grid lines. Each of the four columns is topped by one simple element emblem above it: a little flame, a water droplet, an airy wind-swirl, and a small earth/mountain mound. Bold outlines, flat house colors, cream space. No text, no letters, no numbers, no zodiac symbols.
```

### `zw-ecliptic` — char: no

```
A simple side-on diagram of the solar system seen edge-on as one flat plane: a golden sun at the left and several small planets of different sizes and colors strung out along a single straight flat horizontal track receding to the right, every planet sitting on the very same flat line. Shows the planets all ride one flat plane. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-speeds` — char: no

```
A simple diagram of four or five concentric circular orbit rings around a central golden sun, each ring carrying one small planet, with a curved motion arrow on each ring: the innermost planet has a large bold fast arrow and each ring outward has a progressively smaller slower arrow, like clock hands moving at different speeds. Bold outlines, flat house colors, cream space. No text, no numbers.
```

### `zw-rising` — char: no

```
A circular star-wheel divided into simple wedges, crossed by one clean horizontal horizon line through its middle; at the left/eastern edge a small golden sun is just cresting the horizon and the wedge rising there is gently highlighted as 'coming up'. Soft dawn feel. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-aspects` — char: no

```
A simple circular wheel with several small planet dots spaced around its rim, and clean straight black lines drawn between some of them across the circle to form clear geometric shapes: a triangle connecting three dots and a square right-angle connecting two others, showing the planets linking at angles. Bold outlines, flat house colors, cream space. No text, no numbers.
```

### `zw-retrograde` — char: no

```
A simple flat diagram of two concentric oval race-track lanes around a central golden sun; a small inner planet is overtaking a small outer planet on the next lane over, and near the outer planet a little dashed loop-back arrow shows an apparent backward motion as it gets passed, like a runner overtaken on a track. Bold outlines, flat house colors, cream space. No text, no numbers.
```

### `zw-cast` — char: no

```
A friendly line-up of the classic planets as a row of simple distinct celestial characters standing side by side like a cast: a golden sun with a gentle face, a crescent moon with a face, and several small round planets each a different flat color and size, each with a tiny simple face. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-essenes` — char: no

```
Two or three ancient robed astronomer-scholars at night, gathered around a large old unrolled parchment star-chart that shows only dots and thin connecting lines (no writing), one of them pointing up at the starry sky, a small oil lamp glowing nearby. Calm, scholarly, historical. Bold outlines, flat house colors, cream space. No text, no letters, no numbers — the chart has only dots and lines.
```

### `zw-birth` — char: no

```
A tender quiet scene: a baby's simple cradle outdoors under a dark starry night sky, and directly above the cradle the sky overhead is captured inside a circular wheel of wedges, as if the exact sky at that moment has been frozen into a chart. A golden crescent moon and small four-point stars in the dark sky. Calm and gentle. Bold outlines, flat house colors, cream space. No text, no letters, no numbers.
```

### `zw-gossip` — char: no

```
One clear playful tableau: two young women perched on tall high-backed bar stools at a small round bistro table, gabbing and gossiping over dinner — two glasses of red wine and a little plate of cheese and crackers on the table between them. One woman is turned toward the other with one hand raised in an animated 'oh my gosh!' gesture, mid-gossip; the other reacts with a lively face. Floating in the air just above their heads — the people they are gossiping about — is a tidy cluster of exactly twelve small circles, each circle a DIFFERENT flat solid color, and inside each circle a different little cartoon face showing a different emotion: one angry, one annoyed, one happy, one scared, one smug, one dopey, one crying, one surprised, and so on — all distinct personalities. Bold black ink outlines, flat colors, warm and fun, lots of cream space around the whole scene. Keep the two women and the table in the warm house palette; let the twelve circles be varied flat colors. Absolutely no text, no letters, no numbers, no labels.
```

### `zw-mirror` — char: no

```
A calm, symmetrical landscape reflected in a still pond, illustrating 'as above, so below.' In the TOP half: a few simple shimmering trees and a gentle mountain silhouette under a dark starry night sky sprinkled with small four-point stars. In the BOTTOM half: the exact mirror image of all of it — the same trees, mountain and stars — reflected upside-down in smooth dark water. A single clean horizontal waterline runs across the middle so the top and its reflection read as near-perfect mirrors of each other. Flat, simple, calm, generous cream space at the edges. No text.
```

### `zw-wheels2` — char: no

```
A clean flat diagram of two concentric circular wheels, a larger outer ring and a smaller inner ring. The OUTER wheel is divided into exactly twelve equal pie-slice wedges by twelve thin black spokes. The INNER wheel is also divided into exactly twelve equal wedges, but its dividing spokes are rotated and offset so they do NOT line up with the outer wheel's spokes — the two sets of lines are clearly staggered, showing the two wheels can turn independently. Both wheels have the same count: twelve segments each. A tiny four-point star at the very center. Plain empty wedges only — absolutely no symbols, no glyphs, no numbers, no pictures inside the wedges. One clear centered subject.
```

### `zw-spin2` — char: no

```
A single simple planet Earth drawn as a flat round globe with familiar blue oceans and green-and-golden landmasses so it instantly reads as planet Earth, and one bold black curved arrow looping around it to show it spinning on its own axis. Just the Earth and the one rotation arrow, centered, lots of empty cream space. One clear subject.
```

### `zw-bind2` — char: yes

```
The woman seen from behind, drawn small along the bottom, gazing up at TWO large nested wheels turning in a dark starry night sky above her: the dark sky is broken into pie-slice wedges that resolve into two clean concentric rings of wedges, an outer ring and an inner ring, each divided into equal wedges. Small scattered four-point stars fill the dark night sky. There is NO moon anywhere, and the center of the wheels is empty. She looks calm and wondering. The two nested wheels up in the night sky are the clear main subject.
```

### `zw-wheels` — char: no

```
A clean flat diagram of two nested circular wheels, one wheel inside the other, each wheel divided into twelve equal pie-slice wedges by simple thin black spokes radiating from the center. The outer ring and the inner ring read as two separate concentric wheels that could turn independently. A tiny four-point star sits at the very center. Plain empty wedges only — absolutely no symbols, no glyphs, no zodiac signs, no pictures inside the wedges. One clear centered subject.
```

### `zw-spin` — char: no

```
A single simple planet Earth drawn as a flat round globe with soft golden-yellow continents on a salmon-and-orange sphere, and one bold black curved arrow looping around it to show it spinning on its own axis. Just the Earth and the one rotation arrow, centered, lots of empty cream space. One clear subject.
```

### `zw-orbit` — char: no

```
A simple flat diagram: a golden-yellow sun with a small four-point-star sparkle at its center in the middle, and one small planet Earth traveling along a thin black circular orbit line that loops around the sun, with a single bold arrow on the orbit path showing the direction of travel. Only two objects — the sun in the middle and the little earth on its ring. Centered, generous cream space.
```

### `zw-bind` — char: yes

```
The woman seen from behind, drawn small along the bottom, gazing up at two large nested wheels turning in a dark starry night sky above her: the dark sky is broken into pie-slice wedges that resolve into two clean concentric rings of wedges. A golden crescent moon and small scattered four-point stars fill the dark sky. She looks calm and wondering. The two wheels up in the night sky are the clear main subject.
```

### `zw-twelve` — char: no

```
A neat grid of exactly twelve simple, distinct little human portrait busts, arranged in three tidy rows of four, evenly spaced. Each is a different simple person — varied hairstyles, expressions and skin tones — like a chart of twelve personality types. Flat, clean bold line-art, each figure small and uncluttered. Absolutely no text, no numbers, no zodiac symbols, no labels. Generous cream space around the whole grid. One clear centered subject: the grid of twelve faces.
```

---

## Group 2 — variant

- images: **8** · spec files: artists.json, regen-pastel.json, tricycle.json, tricycle2.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients, playful modern editorial illustration, on a plain white background, soft pastel palette. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `art-trio` — char: no

```
A horizontal row of three simple side-by-side vignettes divided by thin black lines, each showing a pair of human hands doing an artist's process. LEFT: hands power-sanding and tearing back layers of glued-on paper posters on a canvas to reveal colors beneath. MIDDLE: hands layering a precise map/architectural drawing and then sweeping loose gestural ink marks over it. RIGHT: hands feeding a length of linen fabric into a large inkjet printer that lays down streaky black ink. Hands visible in each panel to show a person behind it. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `art-bradford` — char: no

```
A pair of hands power-sanding and tearing back the top layers of many glued-on street posters and paper on a large canvas, exposing bright torn edges and colors underneath — building up and then destroying to see what is revealed. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `art-mehretu` — char: no

```
A pair of hands working on a large canvas that has a precise underlayer of fine architectural lines and maps, sweeping loose energetic gestural ink marks over the top — layering structure and chaos together. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `art-guyton` — char: no

```
A pair of hands feeding a length of linen fabric into a large flatbed inkjet printer; the printer lays down a band of streaky black ink with a visible jam or misprint glitch — letting the machine's accidents make the image. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `meta-trainingwheels-v2` — char: no

```
A normal two-wheeled child's bicycle seen from the side with a pair of small training wheels attached low beside the rear wheel — clearly a bike WITH training wheels, not a tricycle. Orange frame, yellow trim and wheels, pink/orange/yellow streamers on the handlebars. A simple iconic beginner symbol. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `meta-map-v2` — char: no

```
A first-person point-of-view shot: looking down at your own two hands holding open a large fold-out paper road map (folded in thirds), with a winding path visible ahead just beyond the map — as if seen through your own eyes as you walk. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `meta-tricycle-v3` — char: no

```
A classic child's TRICYCLE with three wheels — one larger front wheel with the pedals attached to it, and two smaller wheels at the back — a low, simple kids' trike seen from the side. Orange frame, yellow wheels and trim, pink seat, and pink/orange/yellow streamers off the handlebars. A simple iconic beginner symbol. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `meta-tricycle-v4` — char: no

```
A classic child's TRICYCLE with three wheels, viewed from a three-quarter BACK angle so all three wheels are clearly visible — the two smaller rear wheels spread apart at the back and the single larger front wheel with pedals. A low simple kids' trike. Orange frame, yellow wheels and trim, pink seat, pink/orange/yellow streamers off the handlebars. Bold black outlines, flat pastel colors, no gradients, plain white.
```

---

## Group 3 — variant

- images: **8** · spec files: specA.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where the recurring woman appears keep her consistent: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-bouncer` — char: no

```
A nightclub bouncer in a dark suit standing at a velvet-rope doorway, holding a clipboard and checking it as he decides who gets in. A few small simple symbols (a spiral, a pattern of dots, two contrasting shapes) float above the clipboard as the things he is checking for — hints of hidden meaning. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `na-viewer` — char: yes

```
The recurring woman standing in an art gallery in front of a framed abstract picture on the wall, one hand on her chin, a glowing lightbulb just above her head and a thought bubble beside her holding one small clear abstract symbol — the moment she decides what it means. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `na-campfire` — char: yes

```
The recurring woman sitting cross-legged at a small campfire beside a young man with blonde hair and horn-rimmed glasses; she gazes into the flames, and the fire is just beginning to curl into the shape of a small recognizable form — the mind turning noise into a pattern. A few small stars above them. Bold black outlines, flat pastel colors, warm flame, no gradients, plain white.
```

### `na-widenet` — char: no

```
A person standing on a shore casting a wide fishing net out over the water, the net spreading open to catch as much as possible — casting a wider net. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `na-zoomout5` — char: no

```
A clean minimal diagram: a horizontal row of five small white rectangles each with a bold outline; the second rectangle from the left has a small star drawn inside it and a short arrow pointing down at it from above — a 'you are here', one example among several separate areas. Bold black outlines, flat, minimal, plain white.
```

### `meta-map` — char: yes

```
The recurring woman walking along a winding path, holding open a large fold-out paper road map (the kind that folds into thirds) and looking at it, ready to set off on a journey. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `mm-containers` — char: no

```
A person crouched at an open kitchen drawer full of assorted plastic food-storage containers of different sizes and compartment counts, holding one up and comparing it to find the one that fits — choosing the right container. Bold black outlines, flat pastel colors, no gradients, plain white.
```

### `sc-studio` — char: no

```
A cozy vanity mirror with a shelf beside it lined with little labeled jars and bottles, each holding a soft glow — a self-care studio where feelings and memories are bottled and kept. Bold black outlines, flat pastel colors, no gradients, plain white.
```

---

## Group 4 — variant

- images: **5** · spec files: pastel-redo.json, sauna.json, sauna4.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework and character: bold confident black ink outlines, flat colors with NO gradients, a soft pastel palette (lilac, pastel pink, mint, pale yellow), on a plain WHITE background. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Plenty of empty white space. Absolutely no text, no words, no letters, no numbers.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `md-sauna-v2` — char: yes

```
The recurring woman sitting in a steamy sauna wearing a wrapped white towel (sauna clothes) — NOT her usual jacket and striped pants — relaxed on the wooden bench in the steam. Pastel palette, bold outlines, white background.
```

### `md-tunnel-v2` — char: yes

```
The recurring woman down inside a cozy ball-pit 'place' structure with only her HEAD poking out at the surface and her arms resting down at the top — a simpler, clearer figure, not a confusing tangle of limbs. Pastel palette, bold outlines, white background.
```

### `md-since-v2` — char: yes

```
The recurring woman with a busy mind full of many small buzzing thoughts she is constantly sorting — show the thoughts as small abstract shapes and little sparks around her head, definitely NOT animals or creatures. Pastel palette, bold outlines, white background.
```

### `md-sauna-v3` — char: yes

```
The recurring woman wrapped in a white towel (sauna clothes) sitting in a steamy sauna beside her friend MASON — a man with reddish/ginger hair and a longish red beard, shoulder-length hair, a gentle poet-philosopher — who turns toward her in the steam as if speaking. Two friends relaxing on the wooden sauna bench. Keep her as the recurring woman (reddish-brown topknot). Pastel palette, bold outlines, white background.
```

### `md-sauna-v4` — char: yes

```
The recurring woman and her friend Mason sitting together on a bench in a warm wooden sauna. She is wrapped in a white towel (sauna clothes) instead of her usual jacket and striped pants; Mason beside her also in a towel. Mason is a gentle poet-philosopher with longish red hair, a red beard, and round glasses; he gestures calmly as if gently saying just meditate. She sits beside him looking stuck and unable to, an empty thought bubble rising from her head.
```

---

## Group 5 — variant

- images: **4** · spec files: newideas.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac #C9B6E4, pastel pink #F6C6DA, mint green #B6E5CF and pale yellow, on a plain white background, playful modern editorial illustration. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `grid-imaginary-tag` — char: no

```
A 2x2 grid of four separate simple illustrations, divided by thin black grid lines. Top-left: a person picturing an imagined object inside a thought bubble, with a small blank hanging gift-tag attached to the imagined object. Top-right: the inside of a head holding several floating objects, some with a small hanging tag attached and some with no tag. Bottom-left: those little tags coming loose and getting tangled and mixed up among the objects. Bottom-right: an object that once had a tag now standing solid and real out in the world, its tag gone. Each panel simple and uncluttered.
```

### `mt-butterfly-effect` — char: no

```
A simple clean diagram of the butterfly effect: a butterfly flaps its wings on the left, and a curving dotted line of small ripples travels rightward through a little chain of dominoes, ending in one big consequence on the right — a tiny cause leading to a large effect. Simple and uncluttered.
```

### `mt-snuff` — char: no

```
A candle-snuffer — a small bell on a long handle — descending over a single delicate butterfly to snuff it out, the whole thing resting on a matching dark cast-iron plate with two little side handles; a tidy tool for putting out one unwanted anxious thought. The butterfly is soft pastel; the snuffer and cast-iron plate are dark charcoal. Bold black outlines, flat colors, no gradients, on plain white.
```

### `mt-tools-flatlay` — char: no

```
A neat flatlay of six whimsical little mind-tools arranged in two rows on a plain white surface, each looking like a normal hand tool but recolored in soft pastels: (1) a small wooden hand-saw whose curved serrated blade has a few little beads threaded onto the teeth that can slide along; (2) a waiting-room bead-maze toy with colorful beads sliding on bent wire; (3) a small net cradling a few loose marbles; (4) a tuning fork; (5) a little pair of tweezers pinching a tangled knot; (6) a small funnel with a fine mesh sifter. Tidy overhead flatlay, simple and clean, bold black outlines, flat pastel colors, no gradients.
```

---

## Group 6 — variant

- images: **3** · spec files: extrapolate.json, teacup.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink and mint, on a plain white background, playful modern editorial illustration. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-disentangle` — char: no

```
Two hands pulling apart a single piece of beef jerky, stretching it until the stringy strands separate into two — the idea of disentangling two things that were stuck together. Simple and clear, centered. Bold black outlines, flat pastel colors, no gradients, on plain white.
```

### `na-split` — char: no

```
A clean minimal diagram: on the left one white rectangle with a bold outline; a short dashed line leads rightward to two separate white rectangles; the upper-right rectangle contains a small circle, the lower-right rectangle contains a small square — one thing dividing into two distinct things. Bold black outlines, flat, no gradients, plain white background.
```

### `na-teacup` — char: no

```
A 2x2 grid of four simple panels divided by thin black lines, each showing a teacup viewed from above with tea grounds settled at the bottom. Top-left: loose scattered tea grounds. Top-right: the grounds clumping into a few vague little shapes. Bottom-left: one clump clearly forming a small animal. Bottom-right: another clump clearly forming a little chair. Reading meaning into random tea leaves. Bold black outlines, flat pastel colors, no gradients, plain white.
```

---

## Group 7 — variant

- images: **3** · spec files: white-redo.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients, playful modern editorial illustration, on a plain white background, warm house palette (golden yellow, salmon pink, orange, black) plus small accents. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-checkout-v2` — char: no

```
Grocery items from a checkout counter stacked into a precarious teetering sculpture — cans, produce and packages balanced improbably on top of one another, leaning and about to topple, presented like an art piece. The precarious balancing is the point. Bold black outlines, flat colors, plain white background.
```

### `na-disentangle-v2` — char: no

```
Two hands pulling apart a single tangled mass into two, like pulling apart pulled pork — the tangles are big, thick and deeply intertwined, separating into two distinct clumps. Emphasize the large intertwined strands coming apart. Bold black outlines, flat colors, plain white background.
```

### `na-pipeline-v2` — char: no

```
A red-bearded Viking-ish man (MASON, a poet-philosopher — NOT the recurring woman) operating his noise-art pipeline: he holds a long ORANGE pipe (not pink) with a moppy net handle of colored dots feeding in at the start; the pipe runs through a wider yellow accordion/squeegee section and a teal moppy section, snaking up and around to fit the square, and finally lands on a framed picture HUNG HIGH ON A GALLERY WALL (not near the floor). Keep the tubing simpler and less crazy; small colored polka-dots appear ONLY in the intermediate output, not all along the process. Bold black outlines, flat colors, plain white background.
```

---

## Group 8 — variant

- images: **2** · spec files: cropart.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, mostly a soft pastel palette, on a plain white background, playful modern editorial illustration. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-goldframe` — char: no

```
A single ornate rectangular gold picture frame with decorative baroque scrollwork corners, empty plain-white center, drawn flat with bold black outlines — a reusable decorative 'this is art' frame meant to be stamped onto other images. Gold frame, empty white center, centered on a plain white background. Flat colors, no gradients.
```

### `na-checkout` — char: no

```
A grocery-store checkout conveyor belt seen from the side with a small tidy arrangement of grocery items on it — a piece of fruit, a can, a box, a bottle, an egg carton — placed so it is genuinely ambiguous whether they were arranged to make a pleasing little sculpture of colors and shapes or simply lined up to be bought and eaten. Simple and clear. Bold black outlines, flat pastel colors, no gradients, plain white.
```

---

## Group 9 — variant

- images: **2** · spec files: specB.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: as generated (cream kept)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, playful modern editorial illustration, soft pastel accents. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `grid-neurons-stars-v2` — char: no

```
A 2x2 grid of four panels divided by thin black lines. Top-left: a small cluster of branching neurons inside a soft pastel brain shape on a white background. Top-right: a soft midnight-blue night sky scattered with real five-pointed stars in pale gold and pastel. Bottom-left: several neurons on white connected to one another by thin dashed lines. Bottom-right: five-pointed stars on a midnight-blue sky joined by thin WHITE dashed lines into a clear constellation. Bold black outlines, flat colors, no gradients.
```

### `mem-constellation` — char: no

```
A soft midnight-blue night sky filled with many small five-pointed stars; a handful of them are joined by thin white dashed lines into a constellation, and two or three of the stars hold a tiny memory-scene glowing inside them — the night sky as a memory palace. Bold black outlines, flat colors, no gradients.
```

---

## Group 10 — variant

- images: **1** · spec files: noiseart.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette, on a plain white background, playful modern editorial illustration. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-pipeline` — char: yes

```
Mason holding the start of a long winding Rube-Goldberg pipeline that processes sound into art. He holds a long fuchsia-pink pipe topped with an ambiguous mop-and-net head full of small colored dots (sound bites) feeding in; the dots get suctioned along into a wider pale-yellow accordion/squeegee pipe, then into a teal seafoam-green moppy section where the same dots reappear in slightly different colors; the pipe winds up and around to fit the square with one more iteration, and finally empties onto a small framed picture hanging on a gallery wall. Whimsical, clear left-to-right processing flow. Bold black outlines, flat pastel colors, no gradients, on plain white.
```

---

## Group 11 — variant

- images: **1** · spec files: process.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients, playful modern editorial illustration, on a plain white background, house palette plus red, blue, yellow and lime green accents. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Absolutely no text, no words, no letters, no numbers, no captions.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `na-process` — char: no

```
A vertical S-shaped process diagram snaking down the square: a chain of four simple rounded-rectangle boxes connected by flowing wavy strands, like strands of colored pencil. Loose tangled multicolored strands (yellow, red, blue, beige) representing NOISE and chaos flow into the first box; they emerge from it as neat, evenly-combed, ordered lime-green parallel lines representing ORDER and control; those ordered lines then scatter back into loose tangled colored noise as they flow into the next box, which combs them into order again; the pattern alternates back and forth — noise, then order, then noise, then order — down through the boxes to a final box at the bottom. Clearly show the back-and-forth alternation between the tangled chaotic state and the combed ordered state. Bold black outlines, flat colors, no gradients, plain white background.
```

---

## Group 12 — variant

- images: **1** · spec files: trainingwheels.json
- refs: `witch-school/refs/style-1.png + witch-school/refs/style-2.png`
- background: **whiten** (flood-filled to pure white after generation)

**STYLE (verbatim, always first):**

```
Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, playful modern editorial illustration, one clear simple iconic subject, on a plain white background. 
```

**CHARACTER (verbatim, inserted after STYLE only when the card sets char:true):**

```
Where a woman appears, keep her consistent with the reference: reddish-brown hair in a messy topknot bun, a pink jacket with small black stars, pink-and-orange striped pants; calm and gentle. 
```

**ENDING (verbatim, always last):**

```
 Centered as a small clean icon with empty white space around it. Absolutely no text, no words, no letters, no numbers.
```

**CONTENT per image (verbatim; `char` marks whether the CHARACTER line was inserted):**

### `meta-trainingwheels` — char: no

```
A cheerful little kid's bicycle with training wheels — an orange frame with yellow trim and yellow wheels — with pink, orange and yellow streamers hanging off the handlebars. A simple iconic beginner 'stepping-stool' symbol. Bold black outlines, flat colors, no gradients, plain white background.
```

---

_Total: 352 images across 12 style groups._
