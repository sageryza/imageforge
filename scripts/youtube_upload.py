#!/usr/bin/env python3
"""Upload a video to YouTube as a draft (private by default).

Reads OAuth credentials from the environment (no files, no external deps):
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  YOUTUBE_REFRESH_TOKEN   # the durable key — mints fresh access tokens forever

The refresh token was minted once via an OAuth "Desktop app" client with the
scope https://www.googleapis.com/auth/youtube.upload (upload-only: it can post
to the channel but cannot read it, so a channels.list call will 403 — expected).

Usage (CLI):
  python3 scripts/youtube_upload.py VIDEO.mp4 \
      --title "..." --description "..." --tags "a,b,c" \
      [--privacy private|unlisted|public] [--category 26] [--short]

Prints the new video id + a Studio edit link. Videos land PRIVATE by default so
Sophie reviews in YouTube Studio and taps Publish. A vertical (9:16) clip that is
short is auto-classified by YouTube as a Short; pass --short to append #Shorts.

Importable too:
  from youtube_upload import upload
  upload("clip.mp4", "Title", description="...", tags=[...], short=True)
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = ("https://www.googleapis.com/upload/youtube/v3/videos"
              "?uploadType=resumable&part=snippet,status")


def _env(key):
    val = os.environ.get(key)
    if not val:
        sys.exit(f"Missing required env var: {key}")
    return val


def access_token():
    """Exchange the stored refresh token for a fresh access token."""
    data = urllib.parse.urlencode({
        "client_id": _env("GOOGLE_CLIENT_ID"),
        "client_secret": _env("GOOGLE_CLIENT_SECRET"),
        "refresh_token": _env("YOUTUBE_REFRESH_TOKEN"),
        "grant_type": "refresh_token",
    }).encode()
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data)))
    except urllib.error.HTTPError as e:
        sys.exit(f"Token refresh failed ({e.code}): {e.read().decode()[:300]}")
    return r["access_token"]


def upload(path, title, description="", tags=None, privacy="private",
           category="26", made_for_kids=False, short=False, token=None):
    """Resumable-upload a video file. Returns the created video resource (dict)."""
    token = token or access_token()
    if short and "#shorts" not in (title + description).lower():
        description = (description + "\n\n#Shorts").strip()
    meta = {
        "snippet": {
            "title": title[:100],
            "description": description,
            "tags": tags or [],
            "categoryId": str(category),
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": bool(made_for_kids),
        },
    }
    size = os.path.getsize(path)
    init = urllib.request.Request(
        UPLOAD_URL, data=json.dumps(meta).encode(),
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/*",
            "X-Upload-Content-Length": str(size),
        })
    try:
        session = urllib.request.urlopen(init)
    except urllib.error.HTTPError as e:
        sys.exit(f"Upload init failed ({e.code}): {e.read().decode()[:300]}")
    upload_url = session.headers["Location"]
    put = urllib.request.Request(
        upload_url, data=open(path, "rb").read(), method="PUT",
        headers={"Authorization": "Bearer " + token, "Content-Type": "video/*"})
    try:
        return json.load(urllib.request.urlopen(put))
    except urllib.error.HTTPError as e:
        sys.exit(f"Upload failed ({e.code}): {e.read().decode()[:300]}")


def main():
    ap = argparse.ArgumentParser(description="Upload a video to YouTube as a draft.")
    ap.add_argument("video")
    ap.add_argument("--title", required=True)
    ap.add_argument("--description", default="")
    ap.add_argument("--tags", default="", help="comma-separated")
    ap.add_argument("--privacy", default="private",
                    choices=["private", "unlisted", "public"])
    ap.add_argument("--category", default="26", help="YouTube categoryId (26 = Howto & Style)")
    ap.add_argument("--made-for-kids", action="store_true")
    ap.add_argument("--short", action="store_true", help="append #Shorts to the description")
    a = ap.parse_args()
    tags = [t.strip() for t in a.tags.split(",") if t.strip()]
    res = upload(a.video, a.title, a.description, tags, a.privacy,
                 a.category, a.made_for_kids, a.short)
    vid = res.get("id")
    st = res.get("status", {})
    print("video_id:", vid)
    print("status:", st.get("privacyStatus"), "/", st.get("uploadStatus"))
    print("review:", f"https://studio.youtube.com/video/{vid}/edit")


if __name__ == "__main__":
    main()
