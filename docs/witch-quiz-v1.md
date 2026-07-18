# "Are you secretly a witch?" quiz — VERSION 1 (saved on request)

Sophie's v1: an inline Home card, 5 media questions with a yes/sort-of/no
funnel, all on one card, then a result. She kept this to fall back to, but
moved to v2 (a full-screen "own little app": real questions → a reveal screen
with the image + explanation per sign, ~10 screens). This file preserves v1.

## Home card HTML (was in the Home tab)

```html
<div class="card" id="quiz-card">
  <div class="cards-title">Are you secretly a witch?</div>
  <div id="quiz-intro">
    <p class="hint" style="text-align:center;">Five signs. Answer honestly — you already know the truth.</p>
    <button class="btn" id="quiz-start"><svg …sparkles…></svg> Take the quiz</button>
  </div>
  <div id="quiz-body" style="display:none;"></div>
  <div id="quiz-result" style="display:none;"></div>
</div>
```

## Quiz data + renderers (JS)

```js
const QUIZ_ASSETS = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/witch-quiz/assets/';
const QUIZ = [
  { q: 'Have you ever just *known* something was about to happen — and then it did?',
    media: { type: 'video', url: QUIZ_ASSETS + 'intuition.mp4' },
    a: ['Yes — more than once', 'Once or twice', "…now that you mention it"] },
  { q: 'Has something strange ever happened around you when your emotions ran high?',
    media: { type: 'video', url: QUIZ_ASSETS + 'strong-emotion.mp4' },
    a: ['Yes — and it unsettled me', 'Maybe a coincidence', "I've always wondered"] },
  { q: 'Does the natural world seem to… respond to you?',
    media: { type: 'video', url: QUIZ_ASSETS + 'nature.mp4' },
    a: ['Always has', 'Sometimes', "I'm most myself outside"] },
  { q: "Do the same numbers or signs keep finding you, like they're meant for you?",
    media: { type: 'image', url: QUIZ_ASSETS + 'synchronicity.png' },
    a: ['Constantly', 'Here and there', '11:11, every time'] },
  { q: 'For as long as you can remember — have you felt different from everyone else?',
    media: { type: 'none' },
    a: ['My whole life', 'Deep down, yes', "I never fit the mold"] },
];
// renderQuizQuestion: prog + media + question + option buttons (any option advances)
// showQuizResult: "The power has always been within you" + can-do list + shop CTA + retake
```

Result copy (kept in v2 too):
- Title: **The power has always been within you**
- Body: "There was never any doubt. You're a witch — you always have been. That
  prickle at the back of your neck, the way a room shifts when you walk in, the
  dreams that come true a little too often? That's the craft, awake in you."
- Can-do list: read a room before you step into it / feel the weather turn in
  your bones / tell when someone isn't being honest / turn a whole bad day with
  one lit candle / find what's lost by going quiet.
- CTA: "Gather your tools" → shop.

Assets (Firebase Storage, deckfactory-43176):
`witch-quiz/assets/{intuition.mp4, strong-emotion.mp4, nature.mp4, synchronicity.png}`
