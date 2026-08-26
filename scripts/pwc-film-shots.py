# The camera plan (v4 — a MOVING camera, not cuts).
#
# Each shot is (x0, y0, x1, y1, beat, label). The rect is in fractions of the
# CARD; `beat` is the second WITHIN that card's narration clip at which the
# camera should have ARRIVED there, measured off Whisper's own word/segment
# stamps. A negative beat means "before the narration starts" — the opening
# wide. Storing beats in clip time rather than card time is what lets the
# narration tempo change without re-cutting the camera by hand.
FULL = (0.0, 0.0, 1.0, 1.0)
# card file, vo clip, lead (VO offset inside the card), tail, shots
CARDS = [
 ("01-title-how-to-look-without-looking.png", "01-title", 0.50, 0.80, [
   (*FULL, -0.50, "title — slow push"),
 ]),
 ("02-the-mistake-looking.png", "02-mistake", 0.50, 0.90, [
   (*FULL,                  -0.50, "establish THE MISTAKE"),
   (0.05,0.075,0.95,0.505,   1.10, "him staring — the mistake"),
   (0.15,0.630,0.87,0.740,   4.64, "LOOKING."),
   (0.42,0.075,0.99,0.520,   6.36, "she notices"),
   (0.36,0.700,0.95,0.970,  10.00, "the ceiling inset"),
   (*FULL,                  13.28, "pull out"),
 ]),
 ("03-technique-1-middle-distance.png", "03-t1", 0.50, 0.90, [
   (*FULL,                  -0.50, "establish THE MIDDLE DISTANCE"),
   (0.34,0.335,1.00,0.600,   1.20, "approved viewing point / 3 FEET"),
   (0.00,0.160,0.56,0.530,   4.88, "his unfocused face"),
   (0.03,0.585,0.97,0.800,   8.24, "the 30-degree diagram"),
 ]),
 ("04-technique-2-reflective-surfaces.png", "04-t2", 0.50, 0.90, [
   (*FULL,                  -0.50, "establish REFLECTIVE SURFACES"),
   (0.02,0.170,0.98,0.510,   1.40, "the window scene"),
   (0.38,0.190,0.99,0.500,   4.18, "WINDOW - BEGINNER"),
   (0.02,0.500,0.52,0.850,   7.00, "MIRROR - INTERMEDIATE"),
   (0.48,0.500,0.98,0.850,  11.14, "BACK OF SPOON - ADVANCED"),
 ]),
 # the friend card: VO is the whisper at `lead`, then the narrator at lead+2.54
 ("05-technique-3-the-friend.png", "05b-friend", 3.94, 0.90, [
   (*FULL,                  -3.94, "establish THE FRIEND"),
   (0.01,0.170,0.52,0.580,  -2.54, "the whisper + bubble"),
   (0.22,0.180,0.76,0.600,   0.00, "the friend twists round"),
   (0.36,0.520,1.00,0.840,   2.00, "FAIL"),
 ]),
 ("06-emergency-1-eye-contact.png", "06-eyecontact", 0.50, 0.90, [
   (*FULL,                  -0.50, "establish EYE CONTACT"),
   (0.02,0.180,0.98,0.500,   1.30, "DO NOT PANIC"),
   (0.18,0.585,0.75,0.720,   4.78, "STEP 1 remain calm"),
   (0.00,0.580,0.45,0.860,   6.46, "the approved smile"),
   (0.18,0.685,0.75,0.830,  11.26, "STEP 2 the object behind"),
   (0.50,0.585,0.99,0.840,  15.62, "ABSOLUTELY NOTHING"),
 ]),
 ("07-certified-people-watcher.png", "07-graduation", 0.50, 1.20, [
   (0.03,0.040,0.97,0.210,  -0.50, "CONGRATULATIONS!"),
   (0.18,0.600,0.86,0.910,   2.22, "the certificate"),
   (0.20,0.200,0.75,0.600,   7.86, "the hero, mid-café"),
   # the four nouns were four separate stops and it read as constant motion with
   # nothing held — three stops, each with room to land
   (0.00,0.200,0.47,0.600,   8.96, "left dramas — note + argument"),
   (0.50,0.200,1.00,0.650,  10.94, "right dramas — fry theft + waiter"),
   (0.00,0.450,0.46,0.800,  12.34, "foot freedom"),
   (0.00,0.660,0.44,0.940,  15.68, "observe, don't intervene"),
   (0.26,0.730,0.76,0.960,  17.80, "we don't interfere"),
   (*FULL,                  19.96, "pull out"),
   (0.17,0.912,0.83,0.978,  21.74, "NOTICE THINGS."),
 ]),
]
# beats above were measured on the 1.12x narration; the builder rescales them
BEAT_TEMPO = 1.12
