#!/bin/bash
# Install the Voice Memos auto-push on Sophie's Mac: a launchd agent that runs
# scripts/push-memos.mjs at login and once a day, so new recordings reach the
# archive without her ever opening Terminal.
#
# Served by the app (GET /install-memo-autopush.sh) so it runs without a clone,
# exactly like push-memos.mjs itself. Safe to re-run — it rewrites and reloads
# the agent in place. macOS only.
#
# What it installs:
#   ~/Library/Application Support/ImageForge/run-push-memos.sh   (the runner)
#   ~/Library/LaunchAgents/com.imageforge.push-memos.plist       (the schedule)
#   ~/Library/Logs/imageforge-push-memos.log                     (every run)
#
# The runner downloads the CURRENT push-memos.mjs from the server on every run
# (falling back to its last cached copy when offline), so the push logic is
# never frozen at install time — the server's copy is the one that runs.
#
# Uninstall:
#   launchctl bootout gui/$(id -u)/com.imageforge.push-memos
#   rm ~/Library/LaunchAgents/com.imageforge.push-memos.plist
set -euo pipefail

BASE="${FORGE_BASE:-https://imageforge-q125.onrender.com}"
LABEL="com.imageforge.push-memos"

# AUTOPUSH_TEST_HOME: test harness only (Linux CI has no launchd) — redirects
# every write under a scratch HOME and skips the launchctl half.
TEST="${AUTOPUSH_TEST_HOME:-}"
HOME_DIR="${TEST:-$HOME}"
if [ -z "$TEST" ] && [ "$(uname)" != "Darwin" ]; then
  echo "This installs a macOS launchd agent — run it on the Mac." >&2
  exit 1
fi

# launchd starts jobs with a bare PATH, so the node binary's absolute path is
# baked into the runner at install time.
NODE="$(command -v node || true)"
for p in /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -z "$NODE" ] && [ -x "$p" ] && NODE="$p"
done
if [ -z "$NODE" ]; then
  echo "node was not found — install it first (brew install node), then re-run this." >&2
  exit 1
fi

DIR="$HOME_DIR/Library/Application Support/ImageForge"
LOG="$HOME_DIR/Library/Logs/imageforge-push-memos.log"
PLIST="$HOME_DIR/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$DIR" "$HOME_DIR/Library/LaunchAgents" "$HOME_DIR/Library/Logs"

# The runner. Unquoted heredoc on purpose: $DIR/$BASE/$NODE freeze at install
# time; the escaped \$ ones stay live for the run.
cat > "$DIR/run-push-memos.sh" <<RUNNER
#!/bin/bash
# Written by install-memo-autopush.sh — edits here are overwritten on reinstall.
CACHE="$DIR/push-memos.mjs"
echo ""
echo "── voice-memo auto-push \$(date '+%Y-%m-%d %H:%M') ──"
# Fresh copy each run so the server's current push logic is the one that runs;
# a failed download (offline, server asleep) falls back to the cached copy.
if curl -fsSL --retry 5 --retry-delay 15 "$BASE/push-memos.mjs" -o "\$CACHE.new" 2>/dev/null; then
  mv "\$CACHE.new" "\$CACHE"
fi
if [ ! -f "\$CACHE" ]; then
  echo "no cached push-memos.mjs and the download failed — nothing pushed"
  exit 1
fi
exec "$NODE" "\$CACHE"
RUNNER
chmod +x "$DIR/run-push-memos.sh"

# RunAtLoad = every login/boot; StartCalendarInterval = daily at noon (a job
# missed while the Mac sleeps runs on the next wake). Both firing close
# together is harmless — the push skips everything already archived.
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/run-push-memos.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>12</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

if [ -n "$TEST" ]; then
  echo "test mode: wrote runner + plist under $HOME_DIR, skipping launchctl"
  exit 0
fi

# Reload the agent (bootout of a job that isn't loaded is a normal first-install
# miss, not an error). RunAtLoad makes bootstrap itself kick off the first run.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed. First push is running now — giving it a moment…"
sleep 12
echo ""
echo "── the log so far ($LOG) ──"
tail -n 25 "$LOG" 2>/dev/null || echo "(no log yet — check it in a minute)"

# The one macOS trap: launchd jobs don't inherit Terminal's Full Disk Access,
# so the Voice Memos database can be readable in Terminal yet invisible to the
# agent. The push script prints one specific line in that case — catch it and
# say exactly what to click.
if tail -n 25 "$LOG" 2>/dev/null | grep -q "No Voice Memos database"; then
  cat <<HELP

⚠️  The scheduled run can't see the Voice Memos database (Terminal can, but a
   background job needs its own permission). One-time fix:
   1. System Settings → Privacy & Security → Full Disk Access
   2. Click +, press Cmd-Shift-G, paste this path, and add it:
        $NODE
   3. Then re-run this installer once more.
HELP
fi
