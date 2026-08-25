# The camera plan. Each shot: (x0, y0, x1, y1, end-time-within-card, label)
# Rect in fractions of the card. A shot keeps its OWN aspect and is fitted into
# the 1080x1800 box over the same blurred card, so a wide band ("LOOKING.",
# "NOTICE THINGS.") can actually be isolated — a fixed card-aspect crop cannot,
# and it cut every headline mid-word.
# End times come from Whisper's word/segment stamps on the narration, so each
# cut lands ON the word. MAX_UP in the renderer widens anything too tight.
FULL = (0.0, 0.0, 1.0, 1.0)
CARDS = [
 ("01-title-how-to-look-without-looking.png", 7.99, [
   (*FULL, 7.99, "title — slow push"),
 ]),
 ("02-the-mistake-looking.png", 16.63, [
   (*FULL,                          1.60, "establish THE MISTAKE"),
   (0.05,0.075,0.95,0.505,          5.14, "him staring — the mistake"),
   (0.15,0.630,0.87,0.740,          6.86, "LOOKING."),
   (0.42,0.075,0.99,0.520,         10.50, "she notices"),
   (0.36,0.700,0.95,0.970,         13.78, "the ceiling inset"),
   (*FULL,                         16.63, "pull out"),
 ]),
 ("03-technique-1-middle-distance.png", 13.05, [
   (*FULL,                          1.70, "establish THE MIDDLE DISTANCE"),
   (0.34,0.335,1.00,0.600,          5.38, "approved viewing point / 3 FEET"),
   (0.00,0.160,0.56,0.530,          8.74, "his unfocused face"),
   (0.03,0.585,0.97,0.800,         13.05, "the 30-degree diagram"),
 ]),
 ("04-technique-2-reflective-surfaces.png", 15.30, [
   (*FULL,                          1.90, "establish REFLECTIVE SURFACES"),
   (0.02,0.170,0.98,0.510,          4.68, "the window scene"),
   (0.38,0.190,0.99,0.500,          7.50, "WINDOW - BEGINNER"),
   (0.02,0.500,0.52,0.850,         11.64, "MIRROR - INTERMEDIATE"),
   (0.48,0.500,0.98,0.850,         15.30, "BACK OF SPOON - ADVANCED"),
 ]),
 ("05-technique-3-the-friend.png", 8.50, [
   (*FULL,                          1.40, "establish THE FRIEND"),
   (0.01,0.170,0.52,0.580,          3.94, "the whisper + bubble"),
   (0.22,0.180,0.76,0.600,          5.94, "the friend twists round"),
   (0.36,0.520,1.00,0.840,          8.50, "FAIL"),
 ]),
 ("06-emergency-1-eye-contact.png", 20.39, [
   (*FULL,                          1.80, "establish EYE CONTACT"),
   (0.02,0.180,0.98,0.500,          5.28, "DO NOT PANIC"),
   (0.18,0.585,0.75,0.720,          6.96, "STEP 1 remain calm"),
   (0.00,0.580,0.45,0.860,         11.76, "the approved smile"),
   (0.18,0.685,0.75,0.830,         16.12, "STEP 2 the object behind"),
   (0.50,0.585,0.99,0.840,         20.39, "ABSOLUTELY NOTHING"),
 ]),
 ("07-certified-people-watcher.png", 24.48, [
   (0.03,0.040,0.97,0.210,          2.72, "CONGRATULATIONS!"),
   (0.18,0.600,0.86,0.910,          8.36, "the certificate"),
   (0.20,0.200,0.75,0.600,          9.46, "the hero, mid-café"),
   (0.01,0.200,0.44,0.450,         10.52, "secret note passage"),
   (0.00,0.340,0.47,0.600,         11.44, "silent argument"),
   (0.50,0.200,1.00,0.470,         12.84, "fry theft"),
   (0.55,0.350,1.00,0.650,         14.20, "waiter training"),
   (0.00,0.500,0.46,0.750,         16.18, "foot freedom"),
   (0.00,0.660,0.44,0.940,         18.30, "observe, don't intervene"),
   (0.26,0.730,0.76,0.960,         20.46, "we don't interfere"),
   (*FULL,                         22.24, "pull out"),
   (0.17,0.912,0.83,0.978,         24.48, "NOTICE THINGS."),
 ]),
]
