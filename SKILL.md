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

## 🔁 Continuous Polling Loop — for tasks where user may reply via WA

When the user asks to be kept informed and steps away, Copilot runs a **self-driven polling loop** — it never goes idle, it just sleeps cheaply between checks. The LLM only does real work when a message arrives or a task step runs.

### Starting the loop

Send an opening message so the user knows the moniker, then enter the loop:

```
whatsapp_send("[Copilot] Starting <task>. Reply [C-HL] to send instructions. [C-HL]")
```

### The loop pattern

Use `wa-watch` in async mode — it polls via `curl` in the shell, **zero MCP/LLM cost** during the wait. The LLM only activates when a message actually arrives.

```
loop:
  1. Do next task step (or nothing if waiting for input)
  2. bash(mode="async", "wa-watch HL 20 600") → save shellId
     ↓ shell polls every 20s via curl — LLM does nothing during this
     ↓ wa-watch exits when message arrives OR after 600s timeout
  3. (notified on exit) read_bash(shellId, delay=1) → parse JSON
  4. If count > 0 → process message, reply on WA
     If timeout    → restart loop (no message, keep watching)
  5. Go to 1
```

- `wa-watch <MONIKER> [interval_seconds] [timeout_seconds]` — installed at `~/.local/bin/wa-watch`
- **No task step pending?** Start wa-watch and wait. Loop until a WA message tells you what to do.
- **Task complete?** Tell the user via WA, then keep looping (waiting for next instruction).
- **User types in the CLI?** `stop_bash(shellId)` to kill the watcher, then handle the CLI input.

This means Copilot stays "alive" the whole time — it just costs one small MCP call every 20 seconds during quiet periods, negligible token cost.

### Stopping the loop

Stop when:
- The user types something in the CLI (handle it, ask if they want the loop restarted)
- The user sends `[C-HL] stop` or `[C-HL] done` via WA
- An unrecoverable error occurs

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
