# Hand-drawn markup: what gets marked, and when.
#
# REDONE FROM THE IMAGES, 2026-08-26 (Sophie: "you need to actually look at
# the images and think about where people's attention should be directed. It
# doesn't have to be just circles ... take off all the circles and start
# over"). Every mark below was placed by reading the card art next to the
# narration line it belongs to, and each one starts drawing ON its word —
# beats are Whisper word stamps measured on the finished film's own audio,
# stored here in 1.25x clip time (the render maps them by new/old).
#
#   (kind, geometry, beat, seed, label)
#   circle: (cx, cy, rx, ry)   arrow/line: (x0, y0, x1, y1) — card fractions.
#   line = a plain stroke (an underline, a traced sightline); arrow adds the
#   two-stroke head, so it POINTS — use it where direction is the content.
MARKS = {
 "02-the-mistake-looking.png": [
   # "makes one critical mistake" — the mistake itself, drawn: his stare going
   # STRAIGHT at her (card 3 then corrects it three feet left).
   ("arrow",  (0.385, 0.215, 0.640, 0.245), 2.05, 101, "his stare, straight at her"),
   # "Looking." — the instructor underlines the word as he says it.
   ("line",   (0.330, 0.723, 0.670, 0.723), 4.06, 102, "LOOKING. underlined"),
   # "Once detected" — her knowing side-eye is the detection.
   ("circle", (0.725, 0.235, 0.115, 0.075), 5.75, 103, "she has detected him"),
   # "interested in the ceiling" — an arrow following his gaze UP, at a
   # ceiling that isn't even in the picture (the same gag as card 6's
   # absolutely nothing).
   ("arrow",  (0.810, 0.920, 0.790, 0.790), 9.04, 104, "up at the ceiling"),
 ],
 "03-technique-1-middle-distance.png": [
   # "direct your eyes approximately three feet to the left" — the arrow
   # TRACES the instruction: from his eye down the dashed line to the
   # approved viewing point, head landing on the dot as "three feet" lands.
   ("arrow",  (0.290, 0.315, 0.530, 0.515), 1.76, 105, "eye down to the viewing point"),
   # "maintain a pleasant, unfocused expression" — the expression.
   ("circle", (0.235, 0.335, 0.095, 0.075), 4.75, 106, "the pleasant unfocused face"),
   # (v10: the 30-degree-label circle came off — Sophie: "a couple circles
   # were a little unnecessary". The caption box already says the line.)
 ],
 "04-technique-2-reflective-surfaces.png": [
   # One circle per surface, each on its word: her IN the window, her IN the
   # mirror, her IN the spoon — the reflection is the payoff, not the frame.
   ("circle", (0.700, 0.300, 0.135, 0.105), 4.00, 108, "her in the window"),
   ("circle", (0.345, 0.615, 0.075, 0.062), 6.49, 109, "her in the mirror"),
   ("circle", (0.663, 0.618, 0.052, 0.060), 10.95, 110, "her in the spoon"),
 ],
 "05-technique-3-the-friend.png": [
   # "Your friend will look." — the startled twist, mid-look.
   ("circle", (0.428, 0.285, 0.100, 0.075), 0.18, 111, "the friend, looking"),
 ],
 "06-emergency-1-eye-contact.png": [
   # Sophie, on v5: "[1:07] circle remain calm, not the face" — the WORDS
   # "STEP 1: Remain calm." are circled as Clyde says them; the approved
   # smile is never circled (the camera already points at it).
   ("circle", (0.410, 0.657, 0.110, 0.048), 4.10, 53, "STEP 1: Remain calm."),
   # (v10: the STEP 2 circle came off — the camera's pull-out already shows
   # the step and the object panel together, and the arrow follows seconds
   # later; three marks on one card end was too many.)
   # "You were simply looking at... something else." — into the empty dashed
   # circle, completing right before "something else".
   ("arrow",  (0.610, 0.815, 0.700, 0.735), 14.40, 52, "at absolutely nothing"),
 ],
 "07-certified-people-watcher.png": [
   # The graduation montage: one drama per noun, in the order the camera
   # visits them — the hand-off on "gestures", the theft on "mysteries",
   # the bare feet on "minor dramas".
   ("circle", (0.155, 0.350, 0.080, 0.045), 8.43, 113, "the note, mid-handoff"),
   ("circle", (0.760, 0.362, 0.100, 0.055), 9.79, 114, "the fry theft, in progress"),
   ("circle", (0.135, 0.635, 0.090, 0.050), 11.09, 115, "foot freedom"),
   # (v10: the seal circle came off — the camera is already pushed into it on
   # "interfere with nothing"; the circle was decoration on top of a framing.)
   # "notice things." — the instructor underlines the club motto, last line
   # of the film. The line sits at 0.979: the text runs 0.944-0.974 and the
   # box edge is at 0.982, so this is the only lane where an underline is an
   # underline — at 0.968 it struck THROUGH the words (Sophie caught it).
   ("line",   (0.310, 0.979, 0.690, 0.979), 19.85, 117, "NOTICE THINGS. underlined"),
 ],
}
