#!/usr/bin/env node
/**
 * Ticky Tack — the scenes, with a little more description, as a Compare page.
 *
 * Sophie, 2026-09-10: "put these scenes w a lil more description into a
 * compare page in the chat they came from."
 *
 * "These scenes" = docs/ticky-tack/shot-list.md, every entry of it — the
 * climax, the two beginnings, the must-stays, the secondary keeps and the
 * montage. Every description below is drawn from her own manuscript
 * (docs/ticky-tack/ticky-tack.md); nothing is invented, and the scene names
 * are the shot list's own.
 *
 * It posts a stock DECK (template + data, never hand-rolled html), so the
 * page gets her Decision Deck design, both views (swipe + compare), the
 * ✕ · ? · ♥ per card, a note box per card, and her saved place.
 *
 * pace: 'labored' on purpose — she READS these and changes her mind, so a
 * mark must not step the deck (docs/compare-pages.md, the pace rule).
 *
 * Three notes of hers on the shot-list reply are folded in as captions:
 *   Rite Aid   — "no adam rn"           (Adam and the convertible are out)
 *   Alex+Alex  — "scene 1"              (it leads the climax)
 *   voter man  — "maybe but v short / shot last"
 *
 * Dry by default:  node scripts/ticky-tack-scene-deck.js
 * Post:            node scripts/ticky-tack-scene-deck.js --go
 */

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'tiki-tack-draft-commit';   // the chat the scenes came from
const TITLE = 'Ticky Tack — the scenes v3 (56)';
const SUPERSEDES = '4m7pBOJYkJjcou1UwmSy';   // v2 — posted before the cards
                                             // carried a Footage hand-off

const S = {
  climax: 'Shoot first — the climax',
  begin: 'Shoot next — the two beginnings',
  thomas: 'Five moments with Thomas that must stay',
  hers: 'Hers, must stay',
  second: 'Secondary — recommend keeping',
  montage: 'Montage / can go',
};

const items = [
  // ---------------------------------------------------------------- climax
  {
    id: 'c-alex-and-alex',
    eyebrow: S.climax,
    who: 'Alex and Alex',
    text: 'At the top of the stairs, five plain brown doors — two on each side and one straight ahead. She presses the last one and it turns and opens politely. She shuts herself into a closet full of soft, fluffy clothes hung neatly on hangers, then decides it is better to be seen: a small girl is not menacing. "I was raped," she says, over and over like an unpleasant little mantra, and a woman with a kind face walks in and says "It\'s ok. It\'s ok." A man and a woman live there and both of them are called Alex. He makes her tea; she sits with her in the bedroom urging her to pet the chihuahua, says she is a crisis counsellor, says rape is never the fault of the victim. On the bed is a bright pink Victoria\'s Secret postcard: "You\'ve reached the next level." She knows what it really means. It means she has won. They drive her home in a small silver car.',
    caption: 'Your note: scene 1.',
  },
  {
    id: 'c-rite-aid',
    eyebrow: S.climax,
    who: 'The Rite Aid',
    text: 'She makes herself as small and unassuming as possible, a sliver of a person, walking sideways down the aisles so the three attendants will not see her. She cannot find the box, and this is the one errand she cannot ask for help with. It is high on a shelf, hidden among the Tylenol — the last one of its kind, an ugly pink packaging that looks too much like candy. It is not candy. She takes it to the water fountain at the back, tears at it with her hands and then her teeth, and a girl in a grey vest walks through the doorless threshold. The pill sits on the tip of her tongue behind the wall of her mouth; all she has to do is swallow. Something stops her — the billboard, "god takes back he who disobeys," and the second one about abortion. Then the girl says "Hey! What are you doing here?" and she is distracted just long enough to act without thinking, and swallows it dry. The scene at the counter is small and their anger surprises her: she hands over all the bills she has collected, about eighteen dollars, with one last longing look at the bag of Cheetos.',
    caption: 'Your note: no adam rn — so the convertible is out of this one.',
  },
  {
    id: 'c-bus-stop',
    eyebrow: S.climax,
    who: 'The bus stop',
    text: 'There is a bus stop almost directly outside the store. Two men wait with her, one with a large bearish dog, and they tell her McDonald\'s is giving away free fries today. The place is brimming with people; a free deal is almost impossible to refuse and feels designed for her, but something says not to go in and for once she listens. On the bus she cannot settle — she hovers over a seat, jostles her leg, moves forward, pets a golden retriever halfheartedly, and finally sits near the driver. Sirens in the distance. The bus stops where there is no stop, and four policemen board in unison, night sticks clanging. "We\'re looking for… a criminal?" She is in the first seat and gets up. "She\'s wearing a red dress." She glides out of the door as he sees her for the first time — "And… that\'s her" — and she is already gone, tan coat flying out behind her like wings. She flings the coat down in the middle of the sidewalk without stopping to wish it farewell, and springs across the gravel towards an apartment complex with rickety wooden scaffolding.',
  },
  {
    id: 'c-home',
    eyebrow: S.climax,
    who: 'Home — the blue room',
    text: 'While she was gone the roommates moved everything into the tiny room that is all blue, the one nobody wanted because it was too blue. Her mattress is gone, replaced by a large foam slab folded twice and cinched with a string; she collapses onto it with all her clothes on, shoes included, too tired to untie anything. Downstairs Jon is having a party, wine glasses held unsteadily by the tips of fingers, and he only murmurs "where have you been?" She lies there under soft blue-flowered wallpaper thinking: I do not belong in this room, my home is outside amid the dust and the cobwebs. Then Thomas. She hears sirens and is sure this time they are not for her — but what if they are for him? Slowly, eyes still closed, not daring to think about what she is doing, she drags herself off the foam and steals out the back door.',
  },
  {
    id: 'c-reunion',
    eyebrow: S.climax,
    who: 'The reunion',
    text: 'Seven stops, each one a chance to get lost again, and she grits her teeth and blocks everything out but her destination. On the seventh she sees him through the glass. Thomas is hunched in the alcove outside Whole Foods, paler and frailer, all but the whites of his eyes blending into the shadow, flitting back and forth across the brick path, and he looks cold. "Thomas!" — his eyes open wide but he looks at her as though she is part of a dream. "Oh hi," he says, in a high, deadened tone. She reaches for his fingertips and doesn\'t quite take them, pulling him along on a string they are both imagining, and slings one of his black bags over her shoulder: heavier than she could have imagined. On the porch he stops. "This… is where you live?" Jon\'s friends look up with sudden interest; the Carolina-looking girl beams: "Oh, are you guys friends of Jon\'s?" Upstairs they lie on the rug under the window and he pulls the tired cardboard out of his bag and spreads it over both of them. A sliver of moonlight sits over one of his eyes.',
    caption: 'Ends on: "And we take the 44 bus going the right way."',
  },

  // ------------------------------------------------------------ beginnings
  {
    id: 'b-wrong-way',
    eyebrow: S.begin,
    who: 'The very beginning — the 44 the wrong way',
    text: 'The 44 goes down Ainsworth, two blocks from her house; taken the other way it leads to a freeway and up a winding road of wet foliage that turns black at night. A couple of people get off with her and melt one by one into the brush, and she is left alone under two ugly fluorescents, waiting for a bus that never comes. No one, nothing, no way to measure the time. So she runs — twelve miles is just two times six, easy peasy, and it would be nice to feel wind in her hair and quiet the chatter. Fields roam up on all sides, she runs parallel to the freeway, and then the billboard: strong legs of steel, faded yellow lettering. "god takes back he who disobeys." It feels placed for her, sunk straight into her veins — and behind it, the memory she keeps in her highest-security vault: the cleaning-supplies closet, the blue bottle that was not water, the dare. Two metres on, a second billboard about abortion, which she cannot make sense of at all.',
  },
  {
    id: 'b-meeting-thomas',
    eyebrow: S.begin,
    who: 'Meeting Thomas',
    text: 'A silhouette so pale he looks almost white against the night sky — small from lack of food, not from age, hair as dishevelled as hers, two bags, one canvas and one leather, both black. "Can I use your phone?" — flat, too polite for this hour, daring her to refuse. "No," she says, because she has not got one. He stands up, face alight: "Not one goddamn person can you believe that? Not one. Goddamn. Person." Then, backing into the hedge, almost a snarl: "I\'ve been thinking of ending things." She falls into step behind him, arm an inch from his clenched fist, and says it too quietly for him to hear — "Me too. Me too. Me too" — until it is a buzzing on her lips. At the intersection the lights turn red to green and back and he does not move, and she knows he has nowhere to go either. When the ranting becomes too much she feels her way backwards to a metal power box and shuts her eyes and will not open them until he stops. He stops mid-sentence and lays a gentle hand on her arm — a silent apology, no, an invitation, nay, a valentine. She sinks to her knees and pulls him into the gnarled bark of the tree, watching stars through the branches, and whispers into his hair: "I love you."',
  },

  // ---------------------------------------------------- five with Thomas
  {
    id: 't-morning-after',
    eyebrow: S.thomas,
    who: 'The morning after',
    text: 'They wake dewy-eyed on the cement outside somebody\'s house, and she watches a man stroll out his front door, glance at them, pull a phone from his suit pocket and drive off to an evidently important job. Soon after, a police car pulls up serenely alongside the curb — flashing lights, no sirens. The policeman stands towering over them, and before he can get a word out she is tugging Thomas up off the ground and tossing her hair behind her shoulder. He looks from her defiant face to the boy\'s stricken one and slowly back again. "Come on," she says, and they walk away holding hands, hair dishevelled, heads held high. "Homeless people are lazy," the policeman spits at their backs.',
  },
  {
    id: 't-five-dollar-dress',
    eyebrow: S.thomas,
    who: 'The $5 dress',
    text: 'On Belmont, Thomas bends over a metal trash can with edges pointed up into spikes, pulls out a coffee cup and swishes the liquid left in it. A tall woman in a long dress stops to watch, hands them a crisp $5 bill — "Buy yourselves a fresh coffee" — and walks on, eyes twinkling. They debate it (he wants cigarettes; she does not like the idea) until they find the bin outside a shop, garments hanging limp over the side, $5 on a piece of plain paper. A black dress, thin cotton, not scratchy but not soft, and they go in to try it on, the two shop women very excited to see them. She had assumed she would be the one to wear it. She had been foolish. Thomas pulls it over his head the moment they are out the door, and his pale shoulders shine milky white in the sun, then turn light pink as the day trudges on. He holds his nose higher; his words come out slightly British.',
  },
  {
    id: 't-ducks',
    eyebrow: S.thomas,
    who: 'The ducks',
    text: 'His face crumples unexpectedly and he confesses he is upset because he has not eaten. Without discussing it they take a long rest at a park where ducks float serenely round a pond, and they sit for a long moment watching them quack in circles. Looking out at the sometimes-still water she can see her own mind travelling calmly forth and back like the waves, not churning. The day is dull and dim and she does not mind. As the dark starts to close in she realises she feels, for once, mostly at peace. "You seem to be… picking up on… all the signs you\'re given," he finally says.',
    caption: 'Her favourite moment of the day, of the year, perhaps ever.',
  },
  {
    id: 't-ticky-tack',
    eyebrow: S.thomas,
    who: 'Ticky Tack',
    text: 'She goes behind a metal box and he does not disturb her there — and finally, she pees. From the other side comes a low song under his breath. "What are you singing?" she asks when she comes out, and he ignores the question: "And they\'re all made out of ticky tack" — what was ticky tack? — "little boxes, all the same." She likes how his voice goes up on "ticky tack." She starts singing along even though she does not know the words, and they stand looking at the houses high on the hill. And she starts to understand: he and she do not live in that world. Their house is the dirty pavement and it changes every day. Each house up there is a box with tiny people in it, fulfilling some vague purpose. None of their own days are the same, and — strangest of all — there is no purpose to anything they are doing. She kind of likes the path they have inadvertently taken. Perhaps it was not completely by accident.',
    caption: 'The title, and the thesis.',
  },
  {
    id: 't-christmas-morning',
    eyebrow: S.thomas,
    who: 'Christmas morning',
    text: 'After the green van, after she has run and come back, he is leaning against a construction fence with distaste in his large eyes. He says he has thought of something disturbing — can he tell her? She says no immediately; she is not even curious. He carries on anyway in his bored drawl, apathy turning aggressive. He has imagined waking early on Christmas morning and going downstairs to sit under the tree with all the presents arranged and displayed. Your mother and father appear at the top of the stairs, smiling, waiting to watch you open them. And you say "look mom and dad," and shove a gun down your throat and shoot your head off. The shock on their faces would be tinged with the Christmas lights; the smell of pine needles would rise up and mask the smoke and the blood. It is not particularly compelling to imagine, but the image has taken hold of him and now it takes hold of her, and the shimmering grey afternoon turns into an opaque grey evening.',
  },

  // ------------------------------------------------------------------ hers
  {
    id: 'h-choke',
    eyebrow: S.hers,
    who: 'The choke',
    text: 'His arms are like sick things and they wrap around her often — not because she gets them to, but as though they are surging back to where they belong. He wraps his wrists delicately around her throat and says "imagine this." But he does not squeeze; the choke is in the time that passes. "What if?" the would-be choke says to both of them, and that is how the time passes. It is so sticky, so hot; they languish on the cement, sticking to each other and to the street. A man comes by and hands Thomas a round orange, and they sit in front of a young white-hot wall while he presses each piece into his mouth without offering her one. After all, the man handed it to him.',
    caption: 'Short.',
  },
  {
    id: 'h-powells',
    eyebrow: S.hers,
    who: "Powell's",
    text: 'Powell\'s is calm and cool, sun oozing in through the window, walls a beige sort of tan, mountains of books and people quiet as if in a temple. They find a bench and resume their most common pastime — simply sitting — sinking into each other until neither is clearly vertical, like something sticky oozing slowly downward. In the bathroom mirror her open mouth and wide eyes are the expression of a large realistic doll, and wasn\'t it true, that she was controlling herself like a doll, her limbs moving regardless of what she wanted. She gets the idea that she should sign the bottom of her foot, so that when they find her body they will know she had been art. Back at the bench, sure they have travelled past time and space, it comes as a surprise when a man in a black vest comes and tells them, not in dulcet tones, to leave. They collect their belongings slowly, like the non-solid creatures they have become.',
    caption: 'Short but shot.',
  },
  {
    id: 'h-car-accident',
    eyebrow: S.hers,
    who: 'The car accident',
    text: 'On the road to People\'s Co-op there is the discarded contents of a yard sale on a lawn — shirts, pants, two plastic jugs with stale water, a tangled mess of string that might have been a fishing line. Wasn\'t possession exactly the thing missing from this life? She gathers as much as she can carry, wedges a shirt between her knees, shoves a rolled-up carpet under one arm, and can barely walk. Two blocks on she capsizes at a low wall. Thomas is talking, as usual, but this time every word stings like nails on a chalkboard, because he is talking about her — about the task she has not carried out, the white bathroom tiles, the reading nook, the question of dying at the right time. His ranting reaches a crescendo, an infernal buzzing becoming a screech. And just then, on that silent street, a car accident happens: a clunk of metal on metal, a screech of tires that is real and not imaginary. A chubby teenager gets out of one car, an aging couple out of the other, and they chide her with a parental tenor and exchange names purely out of custom. The idea that she caused it is preposterous — and yet it happened at the exact moment her mind began to collapse from the inside. She feels suddenly powerful, and the shock lets her part with almost everything: the string, the half-coiled rug, the assorted clothes, left there on the low wall.',
  },
  {
    id: 'h-raw-egg',
    eyebrow: S.hers,
    who: 'The raw egg',
    text: 'A car parks right in front of where they are perched outside the organic grocery, and a middle-aged man in jeans gets out carrying a carton of eggs, positively delighted about something. After a few moments of pleasant chatter — the sun, the morning, the bright day ahead — he plucks one egg out of the carton. "You can eat them raw, you know," he says conversationally, and sits it in her hand. "Go ahead and eat it," laughing, and walks into the store, leaving her alone with this latest instruction. Why did it feel like one of her many dares, in another\'s voice? She turns to Thomas hoping he will tell her it is poison, and instead his eyes widen as he lists the myriad benefits of raw eggs. Just as the man re-emerges, she does it — choking on the god-awful slime, gurgling the white, gnashing the yellow, then letting it fall partway back into the shell so threads of white and yellow drip down her arms and her clothes. He rewards her bravery with a barrette he brings out of the store, and a lucky penny. She feels good, and kind of proud. She had been given a challenge, and she had prevailed.',
  },
  {
    id: 'h-orange-trail',
    eyebrow: S.hers,
    who: 'The orange trail',
    text: 'A man in an orange vest is directing traffic and she cannot cross for a long while, staring at crows on their leisurely flight across the sky. She crosses, then signals the crossing guard to stop traffic again so she can cross back — and now the crows are going in all directions, north and west, blurring with the telephone wires. She cannot go in all directions. Somehow she manages to change the colour she is following from black to orange: there are no orange birds, and there is black everywhere. She follows orange priuses up one long street and down another, then a man running in orange shorts, then a woman in bright orange socks turning up a dead-silent cul-de-sac. What if the orange ends here? And then she sees them: ten or so bright orange flags standing erect in a square of lawn that belongs to no house. She steps past the bright yellow caution tape protecting the flags, protecting the finish line. She had never won before. She stands a while in her little orange enclosure thinking triumphant thoughts.',
    caption: '"I had won."',
  },
  {
    id: 'h-red-dress',
    eyebrow: S.hers,
    who: 'The red dress',
    text: 'She goes into one of those bougie stores she has always loved and lately avoided for fear of sideways glances. Inside, Lana Del Rey is playing — "I got my red dress on tonight, dancing in the dark, in the pale moonlight" — and an eerie, creepy feeling strikes her when she realises she is, in fact, wearing a red dress. She cannot even remember where she got it: plain cotton, a blue belt, and she feels like a whole different person in it, not stylish but at least like she is trying to look nice. So what is going to happen tonight? "Nothin scares me anymore." Well, that answers that question — she had always been much too scared to carry out this plan she had not made, and if she is not scared then it cannot be that bad. The song reverberates across the store as she looks at herself suspiciously over the pointy sunglasses she is trying on, in the too-tiny mirror she can barely see into on tiptoe, and plots her own demise. In the brilliant sunshine she cannot be too bothered. She is cool and calm as she tries on the glasses.',
  },
  {
    id: 'h-train',
    eyebrow: S.hers,
    who: 'The train',
    text: 'When it gets dark things go very grainy, and the little disconnected pieces of thought are out and about, floating in the air like sick things. The whole sky is the hazy grey of the cement, speckled with unknown sparkles. She steps onto one of those old above-ground trains whose too-loud rattling has always sent her thoughts into a dizzying panic. The tracks and the telephone lines mix so that everything is upside down for a second, and by the time she can right everything, she cannot. It stays that way as the sun dies silently in the sky. She finds new companions almost at once — a blonde goofy-looking boy, another boy, and a girl whose knobby knees stick out from under her skirt, pigtails expanding into waterfalls. Their destination becomes hers without any thought at all. Their mood is effervescent, a little mad, as they discuss something they have recently procured. "The Black," they call it, simply.',
  },
  {
    id: 'h-the-black',
    eyebrow: S.hers,
    who: 'The Black',
    text: 'They walk down a grassy knoll past tall metallic structures to a park bathroom with a shiny metal toilet that does not bother to have a cover. The two boys go up the hill to make preparations with plastic bags and little metal things, and she is left with the girl, who sinks to the ground as though melting and lets out a low sob, knobby knees rattling. There is an electric fence around her; she can only hover and murmur. The boy leads her into the bathroom and lays their clothes out in a human-sized bed by the door. His will is stronger than hers, so even if she could have made up her mind the ending would have been the same. Afterwards he comes back with some of "the black" he has saved from his friends, ties a black band round her bicep — "trust me, you\'ll like this" — and pricks her arm below the joint. She jerks her forearm away. Again. Again, until the fourteenth time, when she lets the silver needle jab in and the tiny inky dot travel into her blood. And it is good; the little voice that comes every five seconds does not come. When she finally opens the door, their backs are already retreating into the distance. Later, on the side of a busy street in her red dress, she steps off the curb one uncertain step at a time — and stumbles back on, and turns around, and thinks that these most recent breaths would feel like heaven. A young man in a hat says he knows them and will take her to them, never quite kind, never smiling, every question an accusation. He leaves her in an outside hallway with a large warm fan blowing on her, says he has to get something inside, and does not come back. Later, in the pitch black, the thought arrives like an arrow in the back of the neck: the consequence of this could be a seed.',
  },
  {
    id: 'h-slap',
    eyebrow: S.hers,
    who: 'The slap',
    text: 'A part of her brain she has not used in weeks snaps to attention and she begins to think: there are pills you can buy. $40. She dares to have a plan. She starts collecting funds on the main street — the first people say they have no money, the next do not look at her, the ones after wear a glazed expression. Then two boys around her age, average looking, coming back from a bar with their clothes sticky and the smell of alcohol on them. This sight is familiar and glorious: they will want something from her, and she has played this game so often that the shy glances and abashed flattery are rehearsed. She rounds on them without pretense. The first boy is silent as she explains her plight, body still half turned to the door. Then a low chuckle, and his hand swings round, and he slaps her roundly across the face. She sees now that she is not a prize but a sea creature glimpsed through a round window at the bottom of a ship. The second boy looks sorry, and gives her the full contents of his wallet — three one-dollar bills — before following his friend through the glass doors.',
  },
  {
    id: 'h-wheelchair',
    eyebrow: S.hers,
    who: 'The wheelchair',
    text: 'Dumped by the side of the freeway, she walks slowly, enjoying the cool calm of night and at the same time remembering she is in the midst of a crisis. She begins to pass wheelchairs strewn across the sidewalk like loose horses — an omen — and then St. John\'s hospital, the plastic chairs and colored lights beeping crazily, all that white, the clicks of shiny metal instruments. She walks quickly by holding her breath like she is passing a graveyard. Something pulls her back and it feels only natural to seep into one of the loose wheelchairs, a metal body with two weak pieces of black vinyl holding it together. It complements her dress. Her legs dangle low like a child\'s, not touching the floor, kicking out aimlessly as she wheels herself — slower than walking, faster than sitting still — friends with the moon, rocking herself to sleep, wheeling herself into oblivion. She passes a little library shaped elegantly like a tiny cathedral and takes the largest book, a gilded scrapbook with different trim on every page, so beautiful she feels strange carrying it away. She starts writing down the things she thinks she has done wrong. "Sophie\'s book of mistakes." She loves that in a deeply sad way. In the morning she parks the chair by the tall silver pole of the crosswalk outside Planned Parenthood, poised to cross at any moment, and watches two women unlock the door — and stays put. Then she thinks about fried chicken, and biscuits. She leaves.',
  },

  // ------------------------------------------------------------- secondary
  {
    id: 's-hotel',
    eyebrow: S.second,
    who: 'The hotel',
    text: 'Across the street from where they get off the bus is a large red hotel, high glass above the doors showing a great hall. They have things in common with the people milling in the foyer: they are carrying luggage, or what appears to be luggage — except Tom\'s milieu of possessions is crushed soda cans and paper bags with pipe residue. And they need a place to sleep, and what are hotels if not a place to sleep when you are not at home. Inside the grand stone entryway they wander unsurely toward the elevators and are stopped by a guard. She gives a fake room number she makes up on the spot: she did belong here, they would be sorry — and then she remembers they had slept outside the night before. They are told to sit tight on the black frozen couches that feel more like decorations than furniture. The manager walks away, and there is nothing to do but turn around and walk back out of the wide hall with the arched ceiling, taking their luggage with them.',
  },
  {
    id: 's-voter-man',
    eyebrow: S.second,
    who: 'The voter man on the train',
    text: 'A man comes down the aisle with a pile of papers and a clipboard, asking whether they are registered to vote or would like to be. She is surprised they have not stepped so far out of society as to be beyond the reach of solicitors — and more surprised when Thomas sits forward, jostling her head, and asks what steps are necessary to register. She has scarcely seen him interact with anyone who is not her; was he not an imaginary friend she dreamed up on that black night? He writes it down on the paper the man hands him, and that is how she learns his name. Perhaps she is surprised to find that he has one. They had not met, had not exchanged a purpose for travelling. She pushes both names, the first and the last, deep into her memory.',
    caption: 'Your note: maybe but v short / shot last.',
  },
  {
    id: 's-winning-spot',
    eyebrow: S.second,
    who: 'The Winning Spot',
    text: 'She has been collecting things along the trail — a straw with a red line on one side and a blue one on the other, to make a merry-go-round whose horses would represent paradoxes. Then "Wait!" — The Winning Spot, a dive bar across the street, is calling out to her. She feels sure she is meant to go in. To win. Inside: two dingy pool tables, a man pouring shots, a few men in jeans looking up from their beer, an old-fashioned juke box by the door. "umm…" she says at the counter, hoping someone will finish her sentence. "Yess?" the man says, polishing a glass without really looking up. "Could I possibly get…" — her voice reaching an impossibly high crescendo. "Come back when you have money," says the bartender with a cruel smile. Outside, Thomas is clutching his legs so that he resembles, as closely as possible, a ball, and says in a high, detached voice: "I\'m feeling extremely anxious." Then a woman comes out of the wooden door holding a crumpled $5 bill between two fingers and extends it triumphantly: "This is for you. I saw you, and I thought you needed it." The love in her eyes melts insides that a moment ago had felt like diamond mines.',
  },
  {
    id: 's-free-pizza',
    eyebrow: S.second,
    who: 'The free pizza',
    text: 'Red light streams out of a refurbished pool hall and a girl coming out says they are giving away free pizza and soda. At the desk they want to take their things; Tom is very reluctant to give up his black bags. "We won\'t look through your stuff." "You\'re going to look through our stuff?" "No, I said we won\'t." They get little white tags attached with white strings. She takes one piece of vegetable and one of pepperoni, and a coke, and then there are too many people and too many lights. Thomas takes the cheese off his slice, says in a slightly English voice that he does not normally eat pizza. She is distracted by a long pad of paper at the back edge of the table: "To Do List." She uncaps a pink pen and writes down about treating herself like a doll, about signing her name on her foot, about the trail of items on the way to the Winning Spot. A voice over the loudspeaker says "excellent job everyone" and she feels hopeful and proud. Outside she sets the coke atop a cement pillar in the lot — and then cannot decide: go back for it, throw the pizza away, return to the group activity, or walk briskly out without looking back. None of the options sound right. She kneels down in the middle of the sidewalk, bag listless on her shoulder, and stares at the low horizon and the patches of grass.',
  },
  {
    id: 's-night-she-floats',
    eyebrow: S.second,
    who: 'The night she floats',
    text: 'Tom sleeps with his arm across her chest under the house of his leather coat. When he shifts and lifts the arm, a sudden lightness takes her and she springs up, leaping across the street like a ghost. She had been trapped there only by her own imagination. She walks pacelessly up the street and the world seems to be made out of crystal; the doors are no longer doors but wood and bone and memory, and the street is a flat black expanse. Then a man and his friend, laughing and jostling, claim one of the tall houses as their own and stop in their tracks like they have seen a ghost. Their voices go harsh — defenders of their turf — and they order her away. Suddenly and unspeakably frightened, she craves his woolen arms and hurries back across the street, the night no longer crystal. Half awake, he spreads the blanket over them instead of under, and drags her into his little den of comfort, and her mind is blessedly empty.',
  },
  {
    id: 's-coffee',
    eyebrow: S.second,
    who: 'The coffee',
    text: 'In the morning a woman sees them huddled under the cool fog and hands her a tall McDonald\'s coffee. She has never drunk coffee before but this seems like a good time to start: "I wake up, I have to have my coffee," she says to herself, and the words feel right. By a parking meter he finds stale rolls covered in ants and a slightly congealed pasta salad; she nibbles a roll, positioning her teeth carefully between the ants. She hands him the cup — tall and lean, the coffee beginning to leak through the paper at the bottom. He takes two paces and, with an absentminded jerk of his hand, turns it over into the bushes. But he liked coffee. She had gotten it for him. She cannot stand him. "We have to get out of town," she says suddenly, and they start walking west, planning a new life, and it does not occur to either of them to take a bus or a train — perhaps because they know they are not really going anywhere.',
  },
  {
    id: 's-bus-dare',
    eyebrow: S.second,
    who: 'The bus dare',
    text: 'Night, and a strip of bars: men and women meeting for a drink, red and blue light on their loud talkative faces. She bounces from table to table across the invisible lines where one bar ends and another begins, taking a sip from enough drinks to simulate one full drink. Everything falls quickly into place; every two seconds is a perfect decision, no moment of hesitation, like a video game or a race — sip from that empty table, look up into the face of the giant bearded man, out into the street. And here is a bus barrelling towards her, and she is instructed not to move. Her legs lock. For a terrifying moment she considers staying there, letting it smash into her, smithering her guts across all the lovely restaurant patrons who would later tell their loved ones they would rather not talk about it. It is still half a block away when her instincts kick in and she finishes crossing, collapsing into a pile of wet leaves by a chain link fence. Shame and disgust tug at the hem of her shirt; relief is an afterthought. Thomas comes barrelling across after her, completely unaware, and she realises he thought she was running off again.',
  },
  {
    id: 's-leaving-catching',
    eyebrow: S.second,
    who: 'The leaving and the catching',
    text: 'She has the urge to get away from him — an urge she had never even considered before, and now strong enough to act on. She starts walking away, leaving him on the curb with his two black bags and the thin frail cardboard underneath him, and he stares after her, head cocked to one side, and lets her go at first. The day turns cold and dreary; under the bridge it feels like she is the only person in the world. Then he catches up and clasps on for dear life, his grip suffocating, and she cannot bring herself to struggle very hard at all. He takes her to the train track and tells her she is special, she was made for him, she is the one, that he has never felt this before. But while he sleeps she creeps out to the house where she first lived in Portland. On the bright turquoise porch next door are brimming boxes of discarded possessions, and hanging out of the nearest is a pair of orange and pink underwear with little flowers, belonging to the girl who once told her about her Minecraft missions. She takes it, and a pair of socks, and changes behind a low wall on the way back.',
  },
  {
    id: 's-have-a-baby',
    eyebrow: S.second,
    who: '"Have a baby?" / "have sex?"',
    text: 'It is on some sort of furniture — a yellow plush thing that is neither clearly a bed nor a couch — that Thomas struggles with his words. She is used to his rants, verbose, trudging forward like a train with never a moment of hesitation. This is unlike him. "Do you ever think that… that we… could…" She has an inkling what he means and jumps in to save him from his floundering, and she is wrong. "Have a baby?" he finishes, at the same moment she supplies "have sex?" So alike, and yet so different. In a way they are the same. They both cringe with embarrassment, and the conversation, having built to a crescendo of awkwardness that cannot seriously be addressed, dies down and turns into ashes. It is also the first place they have rested that might be considered comfortable.',
  },
  {
    id: 's-juice',
    eyebrow: S.second,
    who: 'The juice',
    text: 'They wander into a juice shop, and while the one employee is in the back room she fiddles inside the cabinet and, without planning it, takes a juice in one of those square containers and puts it in her pocket. They walk one block, come back, and go in again to ask for a phone. "You guys took the juice that was here," says the man, now behind the counter, in a stern voice they both instinctively shrink from, staggering backwards through the door. Thomas walks so fast on the cement that she has to run to catch up, and he scrambles up a short hill that seems to be made of trash. "It was worth it, though," he says when she reaches him, eyes staring vaguely at the sun, his whole body tense, a pillar on that hill. "That juice was good." Something is strange about the statement, and it takes her a second: it is not like them to acknowledge that one decision could be better than another. To acknowledge one is to regret the others.',
  },
  {
    id: 's-split',
    eyebrow: S.second,
    who: 'The split',
    text: 'Back downtown they pass a homeless shelter and Thomas tells her about the rules — in by 11, out by 7, rivalries, feuds, best to keep to yourself — and looks longingly at the clusters gathered round tin foil and crack pipes while she holds his hand tightly to keep his mind in check. At a trendy bar with tables meant for the seven dwarves he starts on Mein Kampf again, trying to engage the other patrons, saying Hitler had been a dictator but a genius. "Tom. I don\'t think anyone wants to talk about that book." His words pass over hers like a waterfall over rapids, and every sentence deepens the lines on her forehead. Outside, a man offers to read her fortune from a crate with a dishcloth over an air vent, a crystal ball and tarot cards on top. "No thank you." "Wait" — did she want weed instead. Weed scares her, with its ability to muss up the careful categories she has established. But Tom goes over eagerly, elbows on the precarious surface, ready to have his fortune read or whatever it takes. And she does not wait for him. She backs away up the dirty sidewalk, getting emptier and emptier, and hurries into a parking garage as its metal grate is coming down. She comes back out with a pair of red-handled scissors in her hand — she had meant to cut up magazines, to make valentines — and a policeman starts following her, so she sits down at the outskirts of a group of hoodlums under the awning, who do not even look at her. They are talking about something black. Or was it simply "the black"? Then she sleeps in a permanently lit-up alcove, waking every five minutes imagining someone is coming.',
    caption: 'This is how Part III starts and cannot be cut.',
  },
  {
    id: 's-two-toms',
    eyebrow: S.second,
    who: 'The two Toms',
    text: 'Of course he would be in the peanut butter aisle — why hadn\'t she known this before? The peanut butter aisle is a symbol of hope to both of them; it is where they found protein, despite. She takes the most circuitous route through the store, past the prepackaged meats and the chunked cheeses and the chocolate sold by the pound, because once she sees he is not there she will have lost him all over again. There is no Thomas. She can see him so clearly — the disheveled hair, the waffle weave shirt, the black pants two sizes too large — and he is not there. Outside, a man in a white apron comes out of a side door for a cigarette. "Are you a chef?" "Not a chef," he sighs. "Just a sous-chef," with a look of defeat, though he would like to go to cooking school. She subsides into the role of consoler, happy to be talked to like a normal person. And as they sit together on the picnic table, Thomas materialises at her side. A minute ago she had no Tom; now she has two. She holds them tight, one in the crook of each arm, and they both seem kind of confused. Then fake Tom wanders off. And she adopts an air of aloofness: "I\'ll see you tomorrow." "But where will I see you?" he asks, cocking his head back to see her.',
  },
  {
    id: 's-taxi',
    eyebrow: S.second,
    who: 'The taxi',
    text: 'She remembers the place she has never dared to go — Planned Parenthood, where it is free — and decides she will try to get a ride there. Back on the main street a lone taxi runs by and she holds up her hand just in the nick of time. She slides into the back and feels the soft leather beneath her, an unnecessary luxury; she would have been satisfied with standing room, but this is a special ride, and she leaves the window cracked so she can gaze at the moon. His gruff demeanour is not the saviour she had been imagining. She spends the ride bargaining with him to take her a little further, a constant stream of bargaining, though he has already agreed to take her where she wants to go — and the trouble is she does not know where that is. The grit of the debate leaves her overwhelmed and unable to think, and her destination gets jammed. In the end she is her own worst enemy, and she can feel his voice growing harder until he dumps her on the cool cement by the side of a freeway when he gets another ride.',
  },

  // --------------------------------------------------------------- montage
  {
    id: 'm-bridge-bench',
    eyebrow: S.montage,
    who: 'The bridge bench',
    text: 'She had never thought to cross the bridge on foot. A quarter of the way across there is a bench, ready and waiting for when they immediately grow tired of the journey. She leans on him and he leans against the grey cold slats — and though he is willing to be leaned on, he is not committed to staying upright, so they fall, slowly, together. He tells her his plan to go to Africa and take ayahuasca in a sacred ritual; people are cured of drug problems that way, the drug loosening the mind, making it malleable for a time. Could she cure herself of this disease that has eaten away at her free will? It is hard to imagine them making that journey when they cannot successfully get across a bridge. Eventually one of them gets hungry and it seems the only sensible thing to do is to make their way back across the part of the bridge they managed to cross.',
  },
  {
    id: 'm-fries-and-the-call',
    eyebrow: S.montage,
    who: 'French fries; the call to his mother',
    text: 'All their nickels and dimes are enough for one small boat of fries, and they eat them silently sitting against a painted wall of bricks. Someone passes and Thomas uses their phone to call his mother. The call is strangely normal — no sense of urgency, at least none she can detect from the other end. She asks if he will be home for dinner, and suddenly her impression of him changes. He says he will not be home for dinner, and carries on with a few pleasantries before hanging up.',
  },
  {
    id: 'm-flag-fabric-pens',
    eyebrow: S.montage,
    who: 'The flag, the fabric store, the pens, the pigeons',
    text: 'On the train she unrolls a crumpled piece of fabric on her lap — a small American flag without a handle — and stuffs it into her bag. Later, in the grey glow of the afternoon, she sees a giant American flag gleaming on a pole beside a fabric store, and it matches. "This fabric store — I once wanted to go in — but I couldn\'t. Let\'s get off here?" Halfway across the crosswalk she sees three pens on the ground — a sharpie, a highlighter, and a broken one with half the plastic missing — her chance to write all the words she has been thinking of. "Wait. We need to go back the other way." He conveys his annoyance and pulls her down by the hand: "Can we stop here?" They sit on the curb with their legs touching, and she makes a game: if none of the crows remain on the building, things will be difficult for her. The pigeons cloud up into a black metal sky and there are none left, so she gets worried — and then one pigeon stands up from its hiding place in the gutter, so it is alright.',
  },
  {
    id: 'm-nice-dream',
    eyebrow: S.montage,
    who: '"Nice Dream"',
    text: 'He hums the low bars of a song, beginning. "Nice dream…" his voice warbles. "Nice dream… If you think that you\'re strong enough…" She knows that song; she remembers her brother playing it on the stereo in their car. She does not know if she is allowed, but she knows the lyrics, so how could she not. "If you think you belong enough! Nice dream! Nice dream. Nice dream." He is walking a few paces ahead and she wonders if he can hear her humming quietly — like the first moments they met, when she muttered "me too" to herself till her heart exploded, while he led her on.',
  },
  {
    id: 'm-blankets-and-tree',
    eyebrow: S.montage,
    who: 'The man about blankets; the tree as a time machine',
    text: 'They collapse in a heap under a tree in a park that appears suddenly beside them. His leather jacket feels like a boulder but she has resolved not to move because she does not want to wake him. Then she discovers a man standing over her, nested in the slight dark the trees make, saying something she cannot understand about blankets he has seen — finally, that there are blankets nearby, up the street and to the right. "I think if we lay on top of each other we\'ll be warmer," he tells her, as if sharing a secret he has discovered. In the morning the tree above them is a mesh net with sunshine pouring through the uneven branches, and she recognises the moment for what it is: a memory. She is nostalgic for it as though it has already passed. A time machine. If only she could take Thomas with her — make him aware that they are living in the past.',
  },
  {
    id: 'm-transfer-men-dancer',
    eyebrow: S.montage,
    who: 'The transfer men; the dancing woman',
    text: 'On the bus, held close in his arms as though in her own private viewing room, she watches two men undertake a logistical feat: one gesturing wildly at the driver, holding the rail and stopping every few seconds to steady himself; the other half standing, half sitting, both of them bouncing and checking their phones for the bus they need to transfer to. She follows every up and down of it. Later, while Tom sleeps under his leather coat, a woman approaches dancing an insane dance to music that is not playing, and she enters the woman\'s consciousness so wholly that she can hear the music too. Two suited men try to pass on her right, steps suddenly nervous, making themselves as narrow as possible and side-stepping awkwardly — in their own way, they have joined the performance.',
  },
  {
    id: 'm-noodles-bananas',
    eyebrow: S.montage,
    who: 'The unclaimed noodles; the truck of bananas',
    text: 'A Chinese restaurant across the street beams at her, changing colours as she watches so it stands out from the drab buildings beside it. When they walk in, a waiter with straight black hair falling into his eyes meets them with a strange grin and tells them a meal is waiting — then his face changes and he says it is cold. It had been hot before, apparently, and she knows without thinking about it that it had been at peak temperature the first time they walked by. It is a to-go order that has gone unclaimed, and he sits them at a two-person table with a stiff pink tablecloth. Later, away from the meat of the city, a dusty blue truck sits on a patch of gravel turned yellow and hot by the sun, its trunk thrust open on a heaping mound of slightly overripe bananas. The man explains his situation, and hands them a box he already has ready, as though he had been waiting for two such people to arrive. When they do not load them fast enough, he thunks them into the box himself.',
  },
  {
    id: 'm-pee-attempts',
    eyebrow: S.montage,
    who: 'The pee attempts',
    text: 'She crosses the street with the banana box so she can pee without him watching — and in a moment Thomas is beside her again, having come running the instant she disappeared behind the tree. Did he think she would leave without warning? She picks one of those manicured bushes, a perfect rectangle, entirely unnatural, and then a man comes down the road driving a truck. In another neighbourhood she pushes him on a swing and then gives in and tells him the plan, pulling her pants down so nothing shows, and he does not notice because he is talking — and a man with a lawn mower comes by blowing grass every which way. She feels as though she lives in a dream where you cannot pee because your body moves too slowly. She cannot believe she still has not peed.',
  },
  {
    id: 'm-chemicals',
    eyebrow: S.montage,
    who: 'The chemicals rants',
    text: 'Along with his constant barrage of vaguely directed negativity about the state of the world, Thomas likes to talk about chemicals. Words she cannot begin to parse swarm his mouth. He asks offhandedly, as if asking her thoughts on milk chocolate over dark: "Have you ever mixed ammonium with nitric acid?" And she has to find a way to say no that sounds like it is the sort of thing she would consider. "hmm, no I don\'t believe I have tried that," as though mentally thumbing through the list of chemicals she is intimately familiar with. "Yes," he continues, not paying attention to anything but her inflection, "I think I\'d like to mix those." And then: "And what about nightshade? Have you ever studied the interaction between nightshade and sulfur?" She likes the semblance of normalcy it creates — that a passer-by might think they were discussing the weather, or what their dogs had been up to.',
    caption: 'A running sound rather than a scene.',
  },
  {
    id: 'm-statue-cart-van',
    eyebrow: S.montage,
    who: 'The statue gold; the food cart; the green van',
    text: 'At a roundabout with a giant statue of a man on a horse, Thomas suggests they try to shave some of the gold off it. "To eat," he says — there is a chemical compound in gold that is very good for your stomach. She nods along, privately thinking that if they could manage the scraping they might as well use it as gold. Later, as the day turns to deeper hues, they come upon a cart parked in the middle of the street, completely packed with food, none of it even in bags, as though teleported out of a supermarket mid shopping trip: quinoa burgers, lentil soup, cookie butter she wants to dip her finger into, and does. After scraps, it feels odd to be having such a feast, and they consume the presents they had not known they deserved in silence. Then she sees it — a green van, an ugly forest green, the same ugly van her roommate has — and chases it, a flat-out sprint, feeling sillier than she has in her life. Thomas has given up chasing her, and she comes back to find him leaning against a construction fence with distaste in his large eyes.',
  },
  {
    id: 'm-peanut-butter-spoons',
    eyebrow: S.montage,
    who: 'Peanut butter samples; the taped spoons; red and blue money',
    text: 'She is practising speed reading, committing things to memory — a book about memory tricks from the little library. All the floaty bits in her brain, shoved into one place, so she would not have to use half her brain keeping things from falling out. She reads it while she spoons peanut butter and honey into her mouth, until an awful woman with a lilting voice tattles on her and they throw away one of the containers. Outside she sits cross-legged on the brick wall and dumps out what she has collected: the little wooden sample spoons that look like shovels, a styrofoam cup, masking tape, paper napkins, coffee stirrers — and starts taping the spoons to each other and around the rim of the cup. And Thomas starts talking about red and blue money: money is fake, and he would like to make red and blue money and mix it in with normal dollars, to see if anyone noticed. She thinks that is a nice idea; not exactly inspired, but still quite a nice one.',
  },
  {
    id: 'm-jeep-tarp',
    eyebrow: S.montage,
    who: 'The jeep and the books; the tarp and the three women',
    text: 'They find a jeep that is simply open, and books piled in a doorway, and bring the books into the jeep to read them. She tries the Bhagavad Gita but it is too dense and too packed with battles, and settles for letting her eyes glaze over, turning pages when it feels like the right time — sometimes two, or three — wondering if Thomas thinks she is a very fast reader indeed. He is absorbed in political commentary and she envies for a second the way his eyes travel smoothly from line to line. They sleep under a tree instead, and in the night it rains, and in the morning Tom\'s face reflects colour through blue plastic: someone has covered them with a tarp while they slept. Then a car pulls up and three women get out, talking and laughing, and she wishes there were a graceful way to pop out from under a tarp. She tears it off with a flourish, and the woman who opens the door on her side registers shock to find the contents was not lumber but two human beings, and is instantly apologetic — and apologises again when she comes back from her errand and they are still lying there, lazing in bed.',
    caption: 'Hers: montage.',
  },
  {
    id: 'm-golf-bag',
    eyebrow: S.montage,
    who: 'The golf bag',
    text: 'In a dim cafe with mahogany tables and matching velvet armchairs, Thomas goes to the bathroom, and in his absence her mind races to distract itself from the night before. There is a heavy leather valise by one of the tables, too heavy to pick up completely, so she settles for dragging it by one of the straps — closer and closer to the door. A lady has been glaring at her with hawk-like eyes since she walked in, face a comical pantomime of disapproval. She is almost out the door when the lady stands up and tells on her: "That girl — she\'s trying to steal your golf bag!" But the man whose bag it is is not upset. On the contrary, he seems to think she is doing him a favour, and he had been about to leave and must think she knew that too. He thanks her with a polite smile and takes the bag out of her hand, which is something of a relief, and then they both glare at the woman who told on her.',
  },
  {
    id: 'm-froot-loops',
    eyebrow: S.montage,
    who: 'Froot loops',
    text: 'On a street corner next to an immature tree is a box of food with a few kinds of cereal in it, and Thomas pulls out the froot loops and starts spooning handfuls into his mouth, talking about how it had been his favourite cereal. They lean against a wall, he silently grabbing handfuls. He gets to his feet and hands her the box — but they are not meant for her, they are his. She takes a yellow one out, and he tells her it is his favourite cereal, and that she could have other things, staring pointedly at the peanut butter flavoured cereal still in the box. She does not mind so much. But she thinks it is a strange distinction. And why would he need to have each and every one of those coloured balls?',
  },
  {
    id: 'm-jerky-cat',
    eyebrow: S.montage,
    who: 'The beef jerky and the cat',
    text: 'In the little atrium off a restaurant\'s main entrance is a magnificent selection of beef jerky hung on hooks, and she grabs one of the bags — so large it takes both hands to hold. She has a conversation with the male hostess in black pants and a short apron, who either does not notice or is too stunned to say anything about it. The jerky is dry and hard to chew and satisfies none of her cravings, and worse, each piece is oblong and has its own identity so she cannot decide which one to pick. A cat slinks heavily across the grass and settles comfortably into Thomas\'s lap while he lies diagonal across the grass with the cat perched on his stomach. She chews up a piece of jerky and dangles it over his open mouth and lets it fall in. For a second he chews it pensively before dragging it out, stunned, and out of his mouth comes a torrent of high-pitched justifications for breaking his one vow of not eating animals. He fails to blame her, and for that she feels guilty.',
  },
  {
    id: 'm-you-two-sure-are-lazy',
    eyebrow: S.montage,
    who: '"You two sure are lazy"',
    text: 'A woman in an old Buick pulls up alongside them as they rest on the curb. "You two sure are lazy, huh?" she hollers, glaring out her open window. Thinking defiantly that she has no idea who they are or what she is talking about, she looks down — and cannot quite come up with an argument against it. They are seated, as usual, on a curb. And they have dispersed their many things, among them, themselves, into the pavement. She was right, she supposed. Lazy or paralysed with anxiety — it amounted to much the same thing. She wonders why she had felt the need to tell them.',
  },
  {
    id: 'm-car-colours',
    eyebrow: S.montage,
    who: 'The car colours on the curb',
    text: 'They make a home on the curb; it is starting to give them room to think. She looks at each of the cars and tries to predict the colour, then watches to see, as it comes rushing by, whether it is the colour she had been thinking it would be — and whether that means what she had been thinking at the moment of the guess was true. She plans to write something and hide it underneath the stop sign, dig a hole so they would uncover it in fifty years, and she would know it was there the whole time and would not have to worry about losing it. She explains to him that if the colours in her mind are the same as the ones in life, then it means life is a joke, and life is a mystery. He is wearing the torn sweater she found hanging over a fence for him, and she has left a few cigarette butts by the drain as a peace offering.',
  },
  {
    id: 'm-festival',
    eyebrow: S.montage,
    who: 'The festival',
    text: 'There is a festival outside the People\'s Co-op the next day, on that cobbled street that felt in some ways like their first home. People all brightly coloured, perhaps the theme of it, and tables set up with food; the street closed off at either end by a long string, ropes or ribbons or something. They come to the end, marked by a small fence with a sign, turn one block, and sit down to rest — in fact they simply lie down where they are. And when a friend she once knew comes back to ask why they cannot talk any more, it is because they are lying there in the middle of the cement. A man with a beard steps over them, gingerly avoiding their many limbs, and gives a slight smile, as if to say sorry for disturbing you.',
  },
  {
    id: 'm-fries-pantomime',
    eyebrow: S.montage,
    who: 'The fries pantomime',
    text: 'A fast food chain looms alongside the road with barely a sidewalk, wild brambles of blackberry threatening to sting her as she passes. While he goes to the bathroom she waits studiously in line, a little anxious rounding the bend of the band. When it is her turn she asks for fries, trying to sound confident, and then: "I could\'ve sworn I had it somewhere." Out of her coat pocket come silver buttons, bits of string, discoloured bus passes, some peels of a tangerine, a little yellow figurine of a horse — all spilling onto the counter as she continues the performance. Finally the man who has been lingering by the counter carefully choosing his sauces gets fed up. "I\'ll pay for it," in a tone of annoyance rather than benevolence, as if this Mary Poppins-esque show were an affront to his most basest sensibilities. Tom emerges from the bathroom hallway looking bewildered at the transaction; she had been hoping he would be impressed. But there are the fries — hot and crispy, each one a resounding rebellion against the cold air of the night.',
  },
  {
    id: 'm-sauerkraut-fence',
    eyebrow: S.montage,
    who: 'The sauerkraut fence',
    text: 'He holds the clump of sauerkraut above the wooden gate and she grabs it, hesitates, then mans up and puts it in her mouth, wincing as the sour taste hits her tongue. It is alright, and she understands why people like the stuff, though the taste is a little strong for her present enjoyment. She uses her feet to climb up the fence but perches at the top not knowing how to get down. He stands beneath her with his arms out and says he can catch her. She jumps. As she walks away from him afterwards she decides she knows now what would happen if she tried to jump and have him catch her.',
  },
  {
    id: 'm-crystal',
    eyebrow: S.montage,
    who: 'The crystal',
    text: 'They have ventured into an industrial complex, perhaps walked too far in one direction — only tall buildings with faceless suited people walking efficiently up and down the stone steps. She sees something shiny and stoops to pick it up, next to a tiny leaf: the size of a blackberry, glass, eight facets. She hands it to Thomas and he takes it and drops it into his pocket with only a cursory glance, and says he wants some actual crystal meth. The sun starts swooping low and she leans away from him, then winces and turns back long enough to say in a high-pitched, out-of-breath voice: "Isn\'t that crystal cool?" Then she leans away again. Thankfully he reconsiders and pulls it back out of his pocket: "where did you get it?" And then he wants to know what she would do if she were on crystal meth, and she says she does not know and does not want to think about it, and they lie down in a part of the shade while he considers what he would do if he had some.',
  },
];

// EVERY CARD CARRIES A FOOTAGE HAND-OFF (2026-09-10, Sophie: "can u add a
// 'footage' button that sends those words to footage module"). The scene's
// own words become the prompt on /footage, with the scene name as the title.
//
// Deliberately NO model, seconds, resolution or shape: /footage remembers the
// model and the shape she last used and opens seconds and resolution at the
// MINIMUM, and a hand-off that names them would silently override her own
// settings. Nothing is sent either way — the button fills the box and the
// star is still her tap.
for (const it of items) {
  it.footage = { prompt: it.text, title: it.who, from: 'Ticky Tack' };
}

const data = {
  items,
  voice: true,
  pace: 'labored',           // she reads these and changes her mind
  note: 'small',
};

async function main() {
  const go = process.argv.includes('--go');
  const body = { chat: CHAT, title: TITLE, template: 'deck', data };

  if (!go) {
    console.log(`DRY — would post to chat "${CHAT}"`);
    console.log(`title: ${TITLE}`);
    console.log(`${items.length} cards:`);
    let sec = '';
    for (const it of items) {
      if (it.eyebrow !== sec) { sec = it.eyebrow; console.log(`\n  ${sec}`); }
      console.log(`    ${it.who}  (${it.text.length} chars)${it.caption ? '  [note]' : ''}`);
    }
    console.log('\nRun with --go to post.');
    return;
  }

  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('FAILED', r.status, j); process.exit(1); }
  console.log('posted:', j.id || j);
  if (j.warnings && j.warnings.length) console.log('WARNINGS:', j.warnings);
  console.log(`page: ${BASE}/api/chatfeed/page/${j.id}`);
  if (SUPERSEDES) {
    const sr = await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDES}/supersede`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ superseded: true }),
    });
    console.log('superseded', SUPERSEDES, sr.status);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
