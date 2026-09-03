# Similitude — screenshot play-through v1 (2026-09-02)

Sophie is cutting the commercial in ChatGPT; this is the screenshot movie with a voiceover she asked for ("a screenshot movie play through w voiceover — the triset dominoes chat has a prototype you could screenshot"). Frames are the REAL `/triset` prototype driven headless at iPhone 13 size (390x844 @3x), with a chosen hand seeded through the page's own saved-table localStorage (`triset.table`) so the set is visible on screen. Chromium in this container cannot reach the site through the proxy, so a local mirror served `public/triset.html` with the live card list and images fetched by curl; the `Draw it!` tap went to the LIVE `/api/triset/found` (one real card, ~2c). Frames are in the chat's Assets tab and on the Compare page `Similitude — screenshot play-through v1`.

Her verdicts on the concept deck the same day: the before/after domino-table ad and "Dominoes for creative people" hearted; the deck-grows angle crossed out ("physical version, no new cards"); "slices of life" wanted as a shot inside a plotted ad; "silence isn't a selling point". So the drawn-card beats (5-7) are framed as the app's half, and the physical game is sold on naming the match yourself.

## Shots and voiceover

1. **Play-through 1 — the deal: sunflower, jam jar, candle**  
   VO: What do a sunflower, a jar of jam and a candle have in common?  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/01-dealt.png
2. **Play-through 2 — tap the jam jar to swap it**  
   VO: Nothing yet. So you swap one.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/02-pick-jam.png
3. **Play-through 3 — the redwood comes in from your hand**  
   VO: The redwood comes in from your hand. Sunflower. Redwood. Candle.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/03-swapped-redwood.png
4. **Play-through 4 — you write what they share in the middle**  
   VO: You see it. One tall thing, straight up the middle. Nobody told you that. You write it in.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/04-written.png
5. **Play-through 5 — Set! claimed, the cards outlined in gold**  
   VO: That is a set. In Similitude the dots are not printed on the cards. You make them up.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/05-claimed.png
6. **Play-through 6 — the middle card is being drawn**  
   VO: And in the app, the game draws what you just said.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/06-drawing.png
7. **Play-through 7 — the made card: a tower, upside down in the middle**  
   VO: One tall thing, up the middle. A card that did not exist a minute ago, made from your idea. It joins the deck.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/07-made.png
8. **Play-through 8 — Each different: comet, candle, lightning around the sun**  
   VO: Or play it the other way. A comet, a candle, a lightning bolt. Each one shares something different with the sun. Similitude. Dominoes for creative people.  
   https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/similitude/playthrough-v1/08-venn.png

## Screen recordings (2026-09-02, her ask: "can't you do a screen record video")

**Making cards is OUT — the commercial is for the PHYSICAL game** (Sophie, the same hour). So the recordings end on the Set! claim (the gold outline) and never tap Draw it; the button's `~2¢` and the generate star are hidden by injected CSS for the recording, and the word is held at "Set!". Two clips, Playwright `recordVideo` against the local mirror, viewport 1080x2340 with `document.documentElement.style.zoom` = 1080/390 so the phone layout renders crisp at 1080 wide (Chromium's standardized zoom: `getBoundingClientRect` and `clientX` are already in viewport pixels, so taps are NOT multiplied — the first take multiplied them and every tap landed off-page). A tap ripple is injected on `pointerdown`; typing is `keyboard.type` at 75ms a character. Cropped to 1080x1920 from the top (the page's lower 40% is empty cream), 30fps H.264.

- `commercials/similitude/screenrec-v1/similitude-screenrec-a-all-the-same-v1.mp4` (0:16) — sunflower · jam · candle, swap the jam for the redwood, type "one tall thing up the middle", Set!
- `commercials/similitude/screenrec-v1/similitude-screenrec-b-each-different-v1.mp4` (0:21) — comet · poppies · lightning, swap the poppies for the candle, "the sun" in the middle, "a tail of light" / "a flame" / "from the sky" on the sides, Set!

Silent on purpose — she is laying the voiceover in ChatGPT. A different hand is three card ids in the recording script's `table(...)` call.
