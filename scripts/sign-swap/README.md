# Sign swap — replace lettering on a sign inside a generated clip

2026-09-11, Sophie: the mansion walkthrough take 4 (Atlas Mini job
`960043fb43df46328aa68143a83286ff`, 15s 9:16 480p) drew the "signs marking it
for destruction" line of her prompt as a Chinese sign on the gate post. She
asked for an English one over it, and to be able to change the words later.

No model call anywhere — OpenCV + ffmpeg in a container, free.

1. `track.py` — ECC homography from a hand-read reference quad (frame 48),
   chained frame to frame through the shot (frames 16–65, found by the
   frame-diff cut detector in the script). Holds from 30 onward.
2. `track-fast.py` — the fast tilt-up frames 16–29 move 15–25px a frame and
   ECC alone fails; a template match on the board gives the translation first,
   then ECC refines. Writes `track.json` (the four corners per frame).
3. `sign.py WORD1 "WORD 2" …` — per frame: rectify the board to a 4x canvas,
   inpaint the original strokes (reference mask ∪ that frame's dark pixels, so
   motion-blur smears go too), draw the words in FreeSans Bold with a
   weathered alpha, sample the ink colour off that frame's own strokes, warp
   back under a feathered inset mask. Encodes libx264 crf 15 and muxes the
   original audio. Changing the words is a re-run with new arguments; the
   tracking is banked in `mansion-take4.track.json`.

Known soft spot: two motion-blurred frames (22, 34) keep a faint ghost of the
original's bottom line below the board's inset mask.

v1 lives at `footage/signs/mansion-take4-condemned-v1.mp4` and on the Compare
page "Mansion take 4 — English sign v1" in `lumafusion-fullscreen-monitoring`.
