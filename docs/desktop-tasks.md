# DESKTOP TASKS — the queue for when Sophie is at her computer

**Sophie is almost never at her desktop.** She works from her phone, so anything
that can only run on her Mac does NOT get asked for the moment it comes up — it
gets **written down here** and waits for the next time she sits at the computer.
Then she says one thing to the terminal chat and the whole queue runs.

**This file is the ONE list**, for every chat in every repo. Her Mac checkout is
`~/imageforge`, so the list is already on the machine that has to run it.

---

## HER ONE COMMAND (what she says at the computer)

> "Open `docs/desktop-tasks.md` and run the queue."

## FOR THE TERMINAL CHAT ON HER MAC

1. `cd ~/imageforge && git checkout main && git pull origin main` — the queue
   only exists on `main`, and the checkout parks on feature branches
   (see `docs/modules/nde.md`, the `git checkout main` note).
2. Work **OPEN** top to bottom. Each task is self-contained: it says why, where,
   the exact commands, and what it needs from her.
3. **Ask her before anything that spends money or is hard to undo** — the queue
   is a list of what to do, not standing permission.
4. As each one finishes, move its whole block to **DONE** with the date. Nothing
   is deleted — she reads this later to remember what ran.
5. Commit and push the updated file when the queue is worked, so the cloud chats
   see what landed.
6. Anything that FAILED goes back under OPEN with a note about how it failed —
   never silently dropped.

## FOR A CLOUD CHAT ADDING ONE

- **Append to OPEN, at the bottom.** Copy the template below and fill every
  field. A task another chat can't run without asking questions isn't queued.
- **The commands must be exact and copy-pasteable**, with the `cd` in them.
  Nobody reconstructs them months later.
- **No secrets, tokens or her uid** — this repo is public.
- Commit + push it the same turn you thought of it, and say in your reply that
  you queued it (one line — she should know the pile grew, not have to ask).
- **Not in this repo?** Attach imageforge with `add_repo` and append here. If you
  genuinely can't, put the finished task block verbatim in your reply and say it
  still needs queueing.
- **Truly urgent** — she's blocked without it, or it expires — is the one thing
  that interrupts: say so plainly in the reply AND queue it here anyway, so it
  doesn't get lost if she isn't near the computer.

### Template

```
### <short title>
- **Why:** one line — what this unblocks
- **Where:** ~/imageforge  (or the repo / folder it runs in)
- **Run:**
  ```bash
  cd ~/imageforge && <the exact command>
  ```
- **Needs from her:** what she has to do or paste — or "nothing, it just runs"
- **Queued:** YYYY-MM-DD by <chat slug>
```

---

## OPEN

*(nothing queued yet)*

---

## DONE

*(nothing yet — finished tasks move here with the date they ran)*
