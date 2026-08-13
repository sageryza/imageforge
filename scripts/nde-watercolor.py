#!/usr/bin/env python3
"""Render NDE montage art in Sophie's watercolor style.

The settled Evan recipe (docs/evan-film-style.md): gpt-image-2 EDITS with
refs/sage-sandy-mirror.png attached as a pure style reference, quality medium,
1024x1536 — and NO written style description. Every style block that has been
tested made the result worse; do not reintroduce one.

  python3 nde-watercolor.py jobs.json [outdir]

jobs.json: [{"id": "...", "scene": "...", "refs": [url|path, ...],
             "likeness": "optional sentence naming who the extra refs are"}]

The style reference is attached FIRST automatically; anything in "refs" rides
after it, which is what the character-anchor technique needs. Prints the exact
prompt sent for every job to <outdir>/prompts.json, because the Assets PROMPT
overlay wants the literal text, never a paraphrase.

env: OPENAI_API_KEY, PANEL_QUALITY=low|medium|high (default medium),
     STYLE_REF (default refs/sage-sandy-mirror.png), JOBS=<n> parallel (default 3)
"""
import base64, json, os, sys, time, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["OPENAI_API_KEY"]
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLE_REF = os.environ.get("STYLE_REF", os.path.join(REPO, "refs/sage-sandy-mirror.png"))
QUALITY = os.environ.get("PANEL_QUALITY", "medium")
PARALLEL = int(os.environ.get("JOBS", "3"))

# The settled wording. Only the "attached"/"FIRST attached" swap changes, and only
# because extra character references make "the attached image" ambiguous.
STYLE_ONE = ("Use the attached image as a style reference. Only use its style, not its "
             "content — do not copy anything depicted in it. You do not have to copy its colors.")
STYLE_MANY = ("Use the FIRST attached image as a style reference. Only use its style, not its "
              "content — do not copy anything depicted in it. You do not have to copy its colors.")


def build_prompt(job):
    n_extra = len(job.get("refs") or [])
    # "preamble" lets a job state its own style sentence — needed when it attaches
    # more than one style reference, since the settled wording names ONE image.
    parts = [job.get("preamble") or (STYLE_ONE if not n_extra else STYLE_MANY)]
    if job.get("likeness"):
        parts.append(job["likeness"])
    parts.append("Draw: " + job["scene"])
    return "\n\n".join(parts)


def ref_list(job):
    """Style refs first (the main one, then any extra), then character refs."""
    return [STYLE_REF] + list(job.get("styleRefs") or []) + list(job.get("refs") or [])


def read_ref(src):
    if src.startswith("http"):
        with urllib.request.urlopen(src, timeout=120) as r:
            return r.read()
    with open(src, "rb") as f:
        return f.read()


def mime_for(src):
    low = src.lower().split("?")[0]
    if low.endswith(".png"):
        return "image/png"
    if low.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def generate(prompt, refs, size="1024x1536", quality=None):
    quality = quality or QUALITY
    boundary = uuid.uuid4().hex
    parts = []

    def field(name, val):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; "
                     f"name=\"{name}\"\r\n\r\n{val}\r\n".encode())

    field("model", "gpt-image-2")
    field("prompt", prompt)
    field("size", size)
    field("quality", quality)
    field("output_format", "webp")
    for i, src in enumerate(refs):
        parts.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; "
                      f"filename=\"ref{i}\"\r\nContent-Type: {mime_for(src)}\r\n\r\n").encode()
                     + read_ref(src) + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/edits", data=b"".join(parts),
        headers={"Authorization": f"Bearer {KEY}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}"})
    d = json.load(urllib.request.urlopen(req, timeout=600))
    if d.get("error"):
        raise RuntimeError(d["error"]["message"])
    return base64.b64decode(d["data"][0]["b64_json"])


def is_refusal(msg):
    m = msg.lower()
    return "safety" in m or "moderation" in m or "rejected" in m


def run(job, outdir):
    prompt = build_prompt(job)
    refs = ref_list(job)
    dest = os.path.join(outdir, job["id"] + ".webp")
    size = job.get("size", "1024x1536")
    quality = job.get("quality", QUALITY)
    for attempt in range(3):
        try:
            img = generate(prompt, refs, size, quality)
            with open(dest, "wb") as f:
                f.write(img)
            print(f"  OK  {job['id']}: {len(img)//1024} KB")
            return {"id": job["id"], "file": dest, "prompt": prompt, "refs": refs,
                    "quality": quality, "size": size, "split": job.get("split")}
        except Exception as e:
            msg = str(e)[:200]
            # A safety refusal is deterministic — retrying only burns time (CLAUDE.md).
            if is_refusal(msg) or attempt == 2:
                print(f"  ERR {job['id']}: {msg}")
                return {"id": job["id"], "error": msg, "prompt": prompt}
            time.sleep(4 * (attempt + 1))


def main():
    jobs = json.load(open(sys.argv[1]))
    outdir = sys.argv[2] if len(sys.argv) > 2 else "/home/user/out/nde-watercolor"
    os.makedirs(outdir, exist_ok=True)
    print(f"{len(jobs)} images · quality={QUALITY} · style={os.path.basename(STYLE_REF)} "
          f"· ~${len(jobs) * (0.02 if QUALITY == 'low' else 0.06 if QUALITY == 'medium' else 0.25):.2f}\n")
    with ThreadPoolExecutor(max_workers=PARALLEL) as pool:
        results = list(pool.map(lambda j: run(j, outdir), jobs))
    with open(os.path.join(outdir, "prompts.json"), "w") as f:
        json.dump(results, f, indent=1)
    ok = sum(1 for r in results if r.get("file"))
    print(f"\n{ok}/{len(jobs)} → {outdir}")


if __name__ == "__main__":
    main()
