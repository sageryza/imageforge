# Hand-drawn markup: what gets circled, and when.
# (kind, card-fraction geometry, beat in the clip, seed)
#   circle: (cx, cy, rx, ry)     arrow: (x0, y0, x1, y1)  — all card fractions
MARKS = {
 "02-the-mistake-looking.png": [
   ("circle", (0.720, 0.232, 0.115, 0.075), 5.90, 11, "she notices"),
   ("circle", (0.700, 0.815, 0.105, 0.070), 9.60, 12, "the ceiling"),
 ],
 "03-technique-1-middle-distance.png": [
   ("circle", (0.530, 0.462, 0.075, 0.045), 1.70, 21, "approved viewing point"),
   ("circle", (0.220, 0.272, 0.090, 0.048), 4.80, 22, "his unfocused eyes"),
 ],
 "04-technique-2-reflective-surfaces.png": [
   ("circle", (0.700, 0.300, 0.135, 0.105), 4.05, 31, "her in the window"),
   ("circle", (0.290, 0.622, 0.095, 0.070), 6.45, 32, "the mirror"),
   ("circle", (0.655, 0.578, 0.055, 0.055), 10.00, 33, "the spoon"),
 ],
 "05-technique-3-the-friend.png": [
   ("circle", (0.420, 0.268, 0.100, 0.075), 0.40, 41, "the friend looks"),
 ],
 "06-emergency-1-eye-contact.png": [
   ("circle", (0.155, 0.700, 0.090, 0.068), 5.96, 51, "the approved smile"),
   ("arrow",  (0.610, 0.815, 0.700, 0.735), 14.40, 52, "at absolutely nothing"),
 ],
 "07-certified-people-watcher.png": [
   ("circle", (0.155, 0.300, 0.095, 0.060), 8.78, 61, "secret note"),
   ("circle", (0.720, 0.335, 0.080, 0.058), 10.20, 62, "fry theft"),
   ("circle", (0.150, 0.660, 0.095, 0.050), 11.48, 63, "foot freedom"),
 ],
}
