#!/usr/bin/env python3
"""Build + bank an audio montage for every substantive theme. Per theme:
extract ≤12 clips (≤2 per person) → anchor phrases → FINISH audio-only cut →
upload mp3 to Firebase. Writes a manifest of {theme, clips, dur, url}."""
import json, os, subprocess

BASE = "/home/user/imageforge"
DATA = json.load(open("/home/user/theme-candidates.json"))
DONE = {"telepathy", "colors", "realer-than-real", "universal-knowledge", "music-sound"}

# theme → focus line for phrase extraction. Only substantive themes.
THEMES = {
    "being-presence": "encountering a BEING or PRESENCE of light — a guide or luminous divine figure",
    "sent-back": "being told or realizing they MUST return to their body — 'you have to go back', 'it's not your time'",
    "out-of-body": "seeing their OWN physical body or the scene from outside or above it",
    "love-peace": "an OVERWHELMING all-encompassing unconditional love or peace beyond any earthly feeling",
    "reluctance": "NOT wanting to come back — wanting to stay, being upset to return to the body",
    "oneness": "a sense that EVERYTHING IS CONNECTED / all is one / merging into everything",
    "life-review": "REVIEWING scenes of their life, re-living them or feeling what others felt",
    "deceased": "meeting a specific DECEASED loved one, relative, friend, or pet",
    "timelessness": "TIME not existing there — no time, everything happening at once",
    "welcomed-home": "a profound feeling of being HOME — of return and belonging, 'I was finally home'",
    "tunnel": "moving through a TUNNEL or passage toward the light",
    "life-purpose-message": "being given a message about their LIFE'S PURPOSE or a mission to fulfill",
    "shown-the-future": "being SHOWN THE FUTURE — events or scenes to come",
}

def cap(cands, n=12, per=2):
    seen, out = {}, []
    for c in cands:
        k = c.get("experiencer", "")
        if seen.get(k, 0) >= per:
            continue
        seen[k] = seen.get(k, 0) + 1
        out.append(c)
        if len(out) >= n:
            break
    return out

manifest = []
for theme, focus in THEMES.items():
    if theme in DONE:
        continue
    out = cap(DATA.get(theme, []))
    if len(out) < 3:
        print(f"skip {theme}: only {len(out)} clips"); continue
    cj, tj = f"/home/user/{theme}-cands.json", f"/home/user/{theme}-tight.json"
    json.dump(out, open(cj, "w"), ensure_ascii=False, indent=2)
    try:
        subprocess.run(["python3", f"{BASE}/scripts/nde-phrases.py", cj, tj, focus],
                       check=True, cwd=BASE, stdout=subprocess.DEVNULL)
        mp3 = f"/home/user/out/theme-{theme}.mp3"
        env = dict(os.environ, FINISH="1", MAX_FINISH="16", AUDIO_ONLY="1")
        subprocess.run(["python3", f"{BASE}/scripts/nde-supercut-precise.py", tj,
                        theme.upper().replace("-", " "), mp3], env=env, cwd=BASE,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip()
        up = subprocess.run(["node", "/home/user/out/upload.js", mp3, f"nde-supercuts/{theme}.mp3"],
                            env=dict(os.environ, NODE_PATH=f"{BASE}/node_modules"),
                            capture_output=True, text=True)
        url = up.stdout.strip().splitlines()[-1] if up.returncode == 0 else "UPLOAD_FAILED"
        manifest.append({"theme": theme, "clips": len(out), "dur": dur, "url": url})
        print(f"  {theme}: {len(out)} clips, {dur}s → {url}")
    except Exception as e:
        print(f"  {theme}: ERROR {str(e)[:120]}")
    json.dump(manifest, open("/home/user/out/themes-manifest.json", "w"), indent=2)

print(f"\nDONE — {len(manifest)} themes banked")
