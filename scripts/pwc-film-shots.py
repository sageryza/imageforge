# The camera plan (v5 — Clyde's read, with Sophie's note corrections).
#
# (x0, y0, x1, y1, beat, label) — rect in fractions of the CARD, `beat` the
# second WITHIN that card's narration clip at which the camera should have
# ARRIVED. Beats are Whisper word/segment stamps measured on the RENDERED
# narration, so they need no rescaling.
#
# Her notes on v4, applied here:
#  · "make sure to zoom in on what you're talking about and include the whole
#    thing" — rects widened where the shot showed only half of what the line
#    was about (card 3's three feet is about HIM and the subject, not the gap).
#  · [0:28] "it should hold for a beat on the zoom out" — every pull-out arrives
#    ~1.9s before its card ends instead of landing on the cut.
#  · [1:15] "when it says NOW ... that's when you should zoom out and it should
#    show what you're actually talking about" — card 6's "now redirect" is a
#    pull-out onto the whole bottom band, and only then into the panel.
FULL = (0.0, 0.0, 1.0, 1.0)
# card file, vo clip, lead, tail, shots
CARDS = [
 ("01-title-how-to-look-without-looking.png", "01-title", 0.30, 0.50, [
   (*FULL, -0.50, "title — slow push"),
 ]),
 ("02-the-mistake-looking.png", "02-mistake", 0.50, 1.00, [
   (*FULL,                  -0.50, "establish THE MISTAKE"),
   (0.05,0.075,0.95,0.505,   1.00, "him staring — the mistake"),
   (0.13,0.600,0.89,0.755,   4.50, "LOOKING."),
   (0.40,0.070,0.99,0.525,   5.54, "she notices"),
   (0.34,0.690,0.96,0.975,   9.20, "the ceiling inset"),
   (*FULL,                  11.40, "pull out — and hold"),
 ]),
 ("03-technique-1-middle-distance.png", "03-t1", 0.50, 1.00, [
   (*FULL,                  -0.50, "establish THE MIDDLE DISTANCE"),
   # the line is about him AND the subject AND the gap — show all three
   (0.02,0.200,1.00,0.620,   1.10, "the sightline and the three feet"),
   (0.00,0.150,0.58,0.540,   4.40, "his unfocused face"),
   (0.02,0.575,0.98,0.810,   7.52, "the 30-degree diagram"),
 ]),
 ("04-technique-2-reflective-surfaces.png", "04-t2", 0.50, 1.00, [
   (*FULL,                  -0.50, "establish REFLECTIVE SURFACES"),
   (0.02,0.165,0.98,0.515,   1.20, "the window scene"),
   (0.30,0.180,0.99,0.510,   3.64, "WINDOW - BEGINNER"),
   (0.02,0.495,0.53,0.855,   6.04, "MIRROR - INTERMEDIATE"),
   (0.47,0.495,0.99,0.855,   9.60, "BACK OF SPOON - ADVANCED"),
 ]),
 ("05-technique-3-the-friend.png", "05b-friend", 3.60, 1.10, [
   (*FULL,                  -3.60, "establish THE FRIEND"),
   (0.01,0.165,0.53,0.585,  -2.30, "the whisper + bubble"),
   (0.21,0.175,0.77,0.605,   0.00, "the friend twists round"),
   (0.34,0.510,1.00,0.850,   1.84, "FAIL"),
 ]),
 ("06-emergency-1-eye-contact.png", "06-eyecontact", 0.50, 1.00, [
   (*FULL,                  -0.50, "establish EYE CONTACT"),
   (0.02,0.175,0.98,0.505,   1.20, "DO NOT PANIC"),
   (0.16,0.575,0.76,0.725,   3.92, "STEP 1 remain calm"),
   (0.00,0.575,0.46,0.865,   5.56, "the approved smile"),
   # her note: on "NOW" it pulls OUT and shows the thing being described
   (0.02,0.570,0.98,0.875,   9.80, "now — the step AND the object"),
   (0.49,0.578,0.99,0.850,  13.96, "ABSOLUTELY NOTHING"),
 ]),
 ("07-certified-people-watcher.png", "07-graduation", 0.50, 1.30, [
   (0.03,0.035,0.97,0.215,  -0.50, "CONGRATULATIONS!"),
   (0.17,0.595,0.87,0.915,   2.04, "the certificate"),
   (0.19,0.195,0.76,0.605,   6.98, "the hero, mid-café"),
   (0.00,0.195,0.48,0.605,   8.38, "left dramas — note + argument"),
   (0.49,0.195,1.00,0.655,   9.80, "right dramas — fry theft + waiter"),
   (0.00,0.445,0.47,0.805,  11.08, "foot freedom"),
   (0.00,0.655,0.45,0.945,  14.22, "observe, don't intervene"),
   (0.25,0.725,0.77,0.965,  15.70, "we don't interfere"),
   (*FULL,                  17.96, "pull out — and hold"),
   (0.16,0.908,0.84,0.980,  19.90, "NOTICE THINGS."),
 ]),
]
BEAT_TEMPO = 1.25   # beats above were measured on the rendered (1.25x) narration
