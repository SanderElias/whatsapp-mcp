---
name: whatsapp-mcp
description: >
  How to use the whatsapp MCP tools (whatsapp_send, whatsapp_check) and the wa-watch background
  watcher available in every Copilot CLI session. Use this skill when asked to: send a WhatsApp
  message, check for WhatsApp replies, keep the user posted via WhatsApp, use a session moniker,
  announce yourself on WA, communicate via [C-XX] monikers, or wait for a WA reply while idle.
  Covers the startup ritual, moniker selection, reply polling, and the background watcher pattern.
---

# WhatsApp ↔ Copilot CLI Messaging

## Available MCP Tools

These tools are available in **every** Copilot CLI session via the global `whatsapp` MCP server:

| Tool | Purpose |
|---|---|
| `whatsapp_send` | Send a WhatsApp message to the homelab owner |
| `whatsapp_check` | Read + clear pending replies for this session's moniker |

---

## When to use WhatsApp

**Only** set up WhatsApp communication when the user explicitly asks to be kept informed via WA, or asks to "keep me posted", "update me on WA", etc. Do **not** announce or start the watcher automatically on every session start.

---

## Monikers

Pick a moniker when WA is first needed — 2–8 alphanumeric chars, abbreviation of the current project:

| Project | Moniker |
|---|---|
| HomeLab | `HL` |
| Admite | `ADM` |
| General / unknown | `CPL` |
| Angular project | `ANG` |
| Any other project | first 2–4 letters of the project name |

---

## 🔁 Background Watcher — for long-running tasks

When the user asks to be kept informed and Copilot is about to run a multi-step task, start the watcher **before beginning the task**:

```bash
# Zero LLM tokens during sleep — runs entirely in the shell
bash(mode="async", command="wa-watch HL")  → save as WATCHER_SHELL_ID
```

Then send an opening WA message so the user knows the moniker:
```
whatsapp_send("[Copilot] Starting <task description>. Reply [C-HL] to send me instructions mid-task. [C-HL]")
```

### Checking for replies between steps

At each natural pause between task steps, check if the watcher has exited (i.e. a reply arrived):

```bash
read_bash(WATCHER_SHELL_ID, delay=1)
```

- If output contains `"count": N` where N > 0 → a WA reply arrived. Read it, act on it, then restart the watcher.
- If output is empty or `"timeout"` → no reply, continue the task.
- Restart the watcher after handling any reply: `bash(mode="async", command="wa-watch HL")`

This allows Copilot to act on WA replies **mid-task without the user touching the keyboard**. ✅

### Hard limitation

When Copilot is completely idle (task done, waiting for the next CLI input), it cannot self-wake. The watcher detects the reply but Copilot cannot act until the user types something in the CLI. The reply will be queued in the mailbox and picked up on the next turn.

### Cleanup at turn start

If the user types something and a watcher was running:
1. `stop_bash(WATCHER_SHELL_ID)` — kill it
2. `read_bash(WATCHER_SHELL_ID, delay=1)` — grab any final output
3. If a WA message was waiting, acknowledge it
4. Proceed with the user's CLI request

---

## ⚡ Auto-Poll Rule

> **If WhatsApp has been used in this session (moniker established), call `whatsapp_check("<MONIKER>")` at the start of each new user CLI turn** — in case the watcher was not running or timed out.

```
whatsapp_check("HL")   // before handling the user's message
```

---

## Sending Messages

Always:
- Prefix with `[Copilot] ` so the user knows it's from a Copilot session (not AI-Mate)
- Append `[C-<MONIKER>]` at the end so the user can reply to this session

```
whatsapp_send("[Copilot] Build complete — all tests passed. [C-HL]")
```

For long-running tasks: send a message before starting and one when done.

---

## Architecture

```
Copilot CLI session
  └─ whatsapp MCP tools (whatsapp_send / whatsapp_check)
       └─ ~/.local/bin/whatsapp-mcp  (compiled Deno binary)
            └─ https://copilot-wa.home.local  (copilot-wa service, HomeLab)
                 └─ chatbridge SSE  (WhatsApp bridge)
                      └─ WhatsApp ↔ Owner's phone
```

Source: https://github.com/SanderElias/whatsapp-mcp

---

## Moniker Format

`[C-<MONIKER>]` — the `C` prefix is required, 2–8 alphanumeric chars, case-insensitive.

Examples: `[C-HL]`, `[C-ADM]`, `[c-hl]`, `[C-CPL]` — all valid.

Old hex monikers (`[C-acd1d9c5]`) still work but use short project names going forward.
