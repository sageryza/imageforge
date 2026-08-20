/* THE COMMERCIAL SURVEY — every dream-app commercial idea this workspace has
 * produced, in two decks (Aug 2026, Sophie: "survey what commercials we've
 * come up with in every chat … and everything I personally said about them
 * behind a question button and put them all into a compare Tinder page
 * thingy. And then do the same for these ChatGPT ideas").
 *
 * The ideas were gathered by scanning all 9,342 messages in forge-chat-feed;
 * `said` on every card is HER OWN WORDS, verbatim from that scan, never a
 * paraphrase — which is the whole point of the "?".
 *
 *   node scripts/dream-commercials/decks.js [--dry]
 */
const C = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercials/covers/';
const S = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/openai/';
const F = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/reels/';
const D = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/';

// ---- DECK 1: ours ---------------------------------------------------------
const ours = [
  { id: 'boys', who: 'The boys — before / after', eyebrow: 'SHOT · v2 · 0:44',
    text: 'A gym-bro group chat. Bicep selfies, a pile of protein, "246g today". Then: BEFORE THE DREAM APP / AFTER. "I think Tyler\'s going through a lot, because he dreamt of french fries falling on the floor last night." Tyler: "there were so many fries 😔"',
    img: C + 'groupchat.webp',
    sections: [{ label: 'Where it stands', text: 'Rendered twice. v2 is real iPhone-13 proportions, light mode, the fries dream in the chat. Your open note: the images should pop up with texting sounds.' }],
    said: [
      { when: 'Aug 19', text: 'Basically it\'s like a group chat for the boys and it has them talking about stupid guy things like lifting weights and eating protein so the first messages it shows are a literal picture of someone\'s bicep. maybe even a boomerang of someone kissing their own bicep and it says like "look at the gains boys" … And then it says something like "before the dream" And then after the dream app. And then it says stuff like "I think Tyler\'s going through a lot, because he dreamt of french fries falling on the floor last night." And then Tyler says "there were so many fries 😔"' },
      { when: 'Aug 19', text: 'I\'m thinking of adding a part in the Boy group chat where it\'s something like says like Melanie is a bitch because she won\'t sleep with me or something. And then the after version is like Melanie has intimacy issues and then the boys are like how do you know and then it just show a picture of her being tangled in a bunch of balls of yarn but it\'s an image from the app and the boys were like oh damn.' },
      { when: 'Aug 19', text: 'I was kind of hoping the protein would literally be in like a pile maybe even against a white background like a product shot so it\'s extremely comical but the one you made is way more realistic so let\'s stay with that one for now and I like the kissing the arm selfie that is perfect Jim, bro. The yarn one is OK, for some reason it looks a little bit too detailed or grainy.' },
      { when: 'Aug 19', text: 'I\'d like to see the fries dream in the group chat. Also, it could say Tyler\'s going through a lot and then show the picture and then have Tyler speak. Also, the text messaging is really small … It doesn\'t really look like an iPhone. Also, can you make the background white not black?' },
      { when: 'Aug 19', text: 'didn\'t I include images for the phone screen? All we need is to make it look like the images are popping up and add like texting sounds' },
    ] },

  { id: 'bird', who: 'The bird costume', eyebrow: 'SHOT · 0:41',
    text: 'She texts him: you were in my dream last night. He asks what happened. She won\'t say — so he opens the app and reads it: they kissed, then he turned into a bird and flew off. "come over." He shows up in a bird costume.',
    img: C + 'birdcostume.webp',
    said: [
      { when: 'Aug 16', text: 'Basically there\'s this cute girl and she\'s like texting this boy and she\'s like hey guess what you\'re in my dream last night and then the boy\'s like oh really what happened and she\'s like I\'m not telling and then he\'s like oh wait I can just use the dream app and so he looks at her dream on the dream app and she sees that they kissed and then he turned into a bird and flew off … and then the punchline is that he shows up at her house wearing like a bird costume because he thinks that they\'re like really recreating the dream but she was under the impression that they were just like gonna kiss so that\'s why it\'s funny.' },
      { when: 'Aug 16', text: 'I don\'t think he should have flowers because the bird costume is kind of a visual gag, and the flowers would be a little distracting to that.' },
    ] },

  { id: 'everydream', who: 'Every night', eyebrow: 'SHOT · v3 · 0:59 · the sad piano appeal',
    text: 'The pharma-appeal grammar turned on dreaming itself. Black and white: she surfaces out of sleep grabbing at the air for something already gone. Statistics read across the footage. Then colour, and the app holding the dream still.',
    img: C + 'everydream2.webp',
    sections: [{ label: 'Where it stands', text: 'Three cuts. Your notes on v2 are folded in — the rise-from-bed grab, the statistics as voiceover over footage, real app screens. Still open: the whale scene animated at higher quality, a caption under the dream, someone coming through the empty door.' }],
    said: [
      { when: 'Aug 18', text: 'I think I like the sad piano one at the moment … I am excited about the sad piano one and I have some notes one I think you already did this, but the part at the beginning should be in black-and-white. We can combine it with the pill troupe. Also, I was thinking we could add like statistics saying like one and five dreams is remembered and then forgotten before breakfast or something but word it more scientifically.' },
      { when: 'Aug 18', text: 'actually, I just watched the sad piano one and I really like it. I like the dream you picked I like almost all the footage. Now that we have the actual dream site pretty much done … You could do actual video shots of it and show more dreams like the one you illustrated.' },
      { when: 'Aug 18', text: 'I think the statistics could just be VoiceOver across the footage. I think the one where she wakes up she should start in bed and then rise suddenly from bed grasping the air like she just woke up and is trying to remember her dream. I\'m not sure if her laughing at the end is appropriate or more like breathing a sigh of relief.' },
      { when: 'Aug 18', text: 'The flying, but never landed statistic is actually really funny but I think we could use a more common rope of like running away but you never get there … I like the empty door dream. That\'s really good. I\'m wondering if you wanted to add a caption text underneath the dream … I think it would make sense for a person to come through the door or drop in or start in and leave through the door. Also be careful because the image reference likes to use that green tank top girl and it\'s better not to use her too much.' },
    ] },

  { id: 'reverie', who: 'Rêverie', eyebrow: 'SHOT · v3 · 0:27 · the gorgeous nonsense',
    text: 'Fifteen seconds of dream logic played straight and beautiful — a horse whose reflection is a swan, a woman upside down in her own water. No joke, no explanation. Then the app.',
    img: C + 'reverie3.webp',
    said: [
      { when: 'Aug 18', text: 'I had a dream about the beautiful nonsense commercial you mentioned so I want you to shoot it.' },
      { when: 'Aug 18', text: 'I looked at the dream one that was interesting but honestly, I think that it could be a bit weirder less perfume add more like well that\'s a strange dream but still kind of elegant and attractive. I think it would actually help if the images were high-quality.' },
      { when: 'Aug 18', text: 'The other one needs to be weirder like really weird people morphing into each other stuff like that houses that go on forever always gone forever. I don\'t know. It might actually be good to illustrate using the illustration technique that we have set up for the pipeline.' },
    ] },

  { id: 'song', who: 'The song spot', eyebrow: 'SHOT · v4 · 0:13',
    text: 'Grainy black-and-white close-ups cut to the song — a fist wound into hair, a hand on a knee. Then the app, the dream drawn from the lyric verbatim, and: "now it doesn\'t have to be a secret."',
    img: C + 'song.webp',
    said: [
      { when: 'Aug 19', text: '"now it doesn\'t have to be a secret" / "you were in my dreams" / and then just a person clicking "share dream" or something' },
      { when: 'Aug 19', text: 'if you\'re gonna make a new image, wouldn\'t you want to use the lyrics to the song: could you find the exact lyrics? I think there\'s something like pulling my hair touching me right?' },
      { when: 'Aug 19', text: 'what I wanted at the beginning was probably black-and-white footage of sort of grainy close-up, confusing shots of someone getting their hair pulled and just like hand on leg or thigh and one more shot.' },
      { when: 'Aug 19', text: 'can u also remake the illustration image where the dream text is literally just the lyrics verbatim. try with the end being: "touching me right" and then maybe a longer version with a few more lines of lyrics' },
    ] },

  { id: 'birdstory', who: 'The bird, told as a story', eyebrow: 'SHOT · v2 · 0:41',
    text: 'The same premise drawn rather than texted — the whole thing in the app\'s own pencil style, a hand holding the phone with HER DREAM open on it, the kiss and the bird inside the card.',
    img: C + 'birdstory.webp',
    sections: [{ label: 'Note', text: 'This one was rendered on the other account and never came back into a chat here — it is on the shelf and you may not have seen it.' }] },

  { id: 'somnivex', who: 'Somnivex®', eyebrow: 'STORYBOARDED · 6 frames · never shot',
    text: 'A prescription pill that puts you in the dreams of someone you miss. "One tablet before bed, and you appear — gently — in the dreams of someone you miss. Tell her the news. Ask her the recipe. Stay as long as the REM cycle allows."',
    img: S + '1787116898774-amd6bf.webp',
    sections: [{ label: 'The side-effects crawl', text: '"Do not take Somnivex if you are unsure the other person misses you back. Appearing in the wrong person\'s dream occurs in one in eight users; apologize and exit through any door. Do not operate heavy machinery inside someone else\'s dream."' },
      { label: 'Where it stands', text: 'Six frames drawn at gpt-image-2 · medium. The whole board is in the fictional-pill-commercial chat\'s Compare tab. You said you didn\'t like it at the time — you flagged it today as maybe being a dream-app commercial after all.' }],
    caption: 'Somnivex. Be there. Ask your doctor if being missed is right for you.',
    said: [{ when: 'Aug 19', text: 'OK of those I think I like somnivex, placebo Rex I like them too actually I like all also, OBLIVANE so write the script for those three and make the images and I\'ll look at them before you animate them.' }] },

  { id: 'evaporation', who: 'The Evaporation', eyebrow: 'WRITTEN · you hearted it',
    text: 'A dream dissolving like wet paper the second the alarm goes — until her half-asleep mumble into the phone freezes it, and it comes back at noon as one square painting.',
    said: [{ when: 'Aug 18', text: 'OK, I like the evaporation and night gallery.' }] },

  { id: 'gallery', who: 'Night Gallery', eyebrow: 'WRITTEN · you hearted it',
    text: 'A museum hall hung with your own dreams, walked in silence like any gallery. "You painted all of this in your sleep."',
    said: [{ when: 'Aug 18', text: 'OK, I like the evaporation and night gallery.' }] },

  { id: 'morph', who: 'It Was Still You', eyebrow: 'WRITTEN · your idea · two takes',
    text: 'The face changes but the person doesn\'t. Funny take: "You were my dentist. Then my mom. Then a lighthouse. But it was you the whole time" — and the painting settles it, a lighthouse in her exact green scarf. Straight take: one continuous walk, the companion swapping faces mid-blink, and she never reacts, because in the dream that\'s normal.',
    said: [{ when: 'Aug 18', text: 'I also think we could do something interesting with the idea of you know how in dreams when you see someone you know, but then later it turns into a different person but somehow they\'re like the same person.' }] },

  { id: 'yourvoice', who: 'Your own dream, in your own voice', eyebrow: 'WRITTEN · your idea · six candidates picked',
    text: 'One real dream off your own recordings, narrated by you, illustrated as five frames in the app\'s style — framed, no panels. 138 of your dreams have your original audio; six were shortlisted.',
    sections: [{ label: 'The shortlist', text: 'The Fish and the Cucumbers (top pick — a whole story, "I forgot I\'m poor") · the broomstick realization ("that\'s how witches fly… they use the wind") · Skiing Through Time and Apples · the glass elevator over Las Vegas · Claude\'s Tiny Spaceship · and one more.' }],
    said: [{ when: 'Aug 19', text: 'I wanna make a commercial for my dream app basically will take one of my dreams that I said out loud and there\'s lots of options in my Voice Memos area and then will illustrate like an actual dream sequence so we\'ll pick the part that\'s most interesting and have me narrate it with my own voice and then draw like five or so images using the dream app style. They\'ll have a frame but no panels and text is actually fine. For the finished version will have to use whisper to cut it at the right exact points.' }] },

  { id: 'youwereinit', who: 'You were in it', eyebrow: 'WRITTEN',
    text: 'Three people, three days, each saying "you were in my dream last night" and then fumbling to describe it. The third one just hands over the phone. "Stop describing it. Show them."' },

  { id: 'whose', who: 'Whose dream is this?', eyebrow: 'WRITTEN',
    text: 'The anonymous feed staged as a diner interrogation — a table of friends reading one dream aloud and working out who posted it. "…that\'s Dana." Dana says nothing.' },

  { id: 'sixohfour', who: '6:04 AM', eyebrow: 'WRITTEN · the quiet one',
    text: 'No joke. Eyes still closed, thumb finding the mic button by feel, a mumble. Then noon: the painting, with hearts already on it.' },

  { id: 'thirdmissing', who: 'The Missing Third', eyebrow: 'WRITTEN',
    text: 'The group chat beside the dream feed. Everything that happened to your friends is in one of them — and a third of their lives never made the group chat.' },

  { id: 'asiwas', who: 'As I Was Saying', eyebrow: 'WRITTEN',
    text: 'Years of badly describing the same recurring dream to the same unconvinced people. Then, finally, evidence. The stairs do go sideways.' },

  { id: 'ninemore', who: 'Nine more for the boys', eyebrow: 'WRITTEN · same format, banked',
    text: 'If the group chat one works, it is a format rather than a single spot — the joke reloads with a new dream every time.',
    sections: [
      { label: 'The teeth', text: 'Fantasy football trash talk → "Derek dreamt his teeth fell out again. Third week straight." / "it\'s about loss of control man"' },
      { label: 'The gorilla', text: 'The 100-men-vs-1-gorilla argument → "Kyle dreamt the gorilla just wanted to be held" / "the gorilla was you, Kyle"' },
      { label: 'The vending machine', text: 'A 2am "u up" screenshot → "Jake dreamt his ex was a vending machine that ate his dollar" / "the machine owes you NOTHING"' },
      { label: 'The bees', text: 'Crypto rockets → "Tyler dreamt his money turned into bees" / "did they sting you?" / "no. they just left"' },
      { label: 'And five others', text: 'The lighthouse · the passenger seat · the childhood dog · plus two more, full dialogue in the doc.' },
    ] },
];

// ---- DECK 2: ChatGPT's ----------------------------------------------------
// HER words are not on these — she pasted the thread today and has said
// nothing about them yet. So the "?" is plain and ChatGPT's own note (where
// it gave one) rides the caption line instead, labelled as ChatGPT's, never
// as hers.
const gpt = [
  { id: 'g-eighthours', who: 'Eight hours somewhere else', eyebrow: "CHATGPT'S OWN FAVOURITE",
    text: 'Black screen. "Your friends spent eight hours somewhere else last night." Beat. "Want to see where?" Then the app.',
    caption: 'It makes the concept feel much bigger and stranger than simply "a dream journal."', captionLabel: "ChatGPT's note" },
  { id: 'g-whatdid', who: 'What did your friends dream last night?', eyebrow: 'CHATGPT',
    text: 'Quick cuts of ordinary people waking up, then flashes of the completely insane things their friends dreamed — someone marrying a dolphin, a childhood house floating in space, a boss with six arms. End on the app showing the dreams.' },
  { id: 'g-whileyouwere', who: 'While You Were Sleeping', eyebrow: 'CHATGPT',
    text: 'Alarm. Phone. Instead of notifications: "Maya was president of France." "Ben had a second family of raccoons." "Your sister killed you. Sorry." Then: what did your friends dream last night?' },
  { id: 'g-antifeed', who: 'The Anti-Feed', eyebrow: 'CHATGPT',
    text: 'Split screen. Left: the morning doomscroll — ragebait, disasters, ads, arguments. Right: dreams — someone flying over their hometown, an enormous shrimp at a wedding, a childhood bedroom underwater. "You get to choose what goes into your head first."' },
  { id: 'g-weirdos', who: 'Good Morning, Weirdos', eyebrow: 'CHATGPT · a brand voice',
    text: 'The dream feed read like the morning newspaper. Coffee, toast, bathrobe, someone reading it out entirely seriously. TODAY\'S DREAMS: Emma accidentally joins the Navy. Dad can breathe underwater. Josh dreams about Rachel again.',
    caption: 'This could establish a really fun brand voice.', captionLabel: "ChatGPT's note" },
  { id: 'g-missedit', who: 'You already missed it', eyebrow: 'CHATGPT',
    text: '"Last night, your best friend robbed a bank. Your ex gave birth to a horse. Your sister met God in a CVS. And you slept through all of it." Then: see what your friends dreamed last night.' },
  { id: 'g-groupchat', who: 'The Group Chat Before Anyone\'s Awake', eyebrow: 'CHATGPT',
    text: '6:43 AM. Nobody has texted yet — but their dreams are already there. You are catching up with your friends before your friends have started their day. "Your friends had a whole night without you."' },
  { id: 'g-gossip', who: 'Dream Gossip', eyebrow: 'CHATGPT · pitched twice',
    text: 'Dreams as the juiciest social feed imaginable. "Wait. You dreamed WHAT about Daniel?" / "Why was I there?" / "You guys both dreamed about the ocean?" Second version: "Did you see what Chloe dreamed about Sam?" / "NO." / "She posted it." Suddenly everyone is looking.' },
  { id: 'g-couldbe', who: 'You Could Be Looking at This', eyebrow: 'CHATGPT',
    text: 'Someone scrolling something incredibly depressing. Abrupt cut: "Meanwhile, your best friend dreamed she gave birth to a rotisserie chicken." Show the dream. "You could be looking at this instead."' },
  { id: 'g-ritual', who: 'Morning ritual', eyebrow: 'CHATGPT',
    text: 'Alarm → coffee → check texts → check what everyone dreamed. Positioned as a new little morning habit rather than as an app.' },
  { id: 'g-question', who: 'The Morning Question', eyebrow: 'CHATGPT · the pretty one',
    text: 'Different people waking up in different bedrooms. Over each: Where did you go last night? Who did you see? What happened to you? Then finally: what did your friends dream last night?' },
];

module.exports = { ours, gpt, C, S, F, D };
