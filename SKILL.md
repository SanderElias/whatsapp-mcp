---
name: whatsapp-mcp
description: >
  How to use the whatsapp MCP tools (whatsapp_send, whatsapp_check) available in every Copilot
  CLI session. Use this skill when asked to: send a WhatsApp message, check for WhatsApp replies,
  keep the user posted via WhatsApp, use a session moniker, announce yourself on WA, or communicate
  via [C-XX] monikers. Covers the startup ritual, moniker selection, and reply polling.
---

# WhatsApp ↔ Copilot CLI Messaging

## Available MCP Tools

These tools are available in **every** Copilot CLI session via the global `whatsapp` MCP server:

| Tool | Purpose |
|---|---|
| `whatsapp_send` | Send a WhatsApp message to the homelab owner |
| `whatsapp_check` | Read + clear pending replies for this session's moniker |

---

## Session Startup Ritual

At the start of any session where WhatsApp updates may be useful:

1. **Pick a moniker** — 2–8 alphanumeric chars, abbreviation of the current project:

   | Project | Moniker |
   |---|---|
   | HomeLab | `HL` |
   | Admite | `ADM` |
   | General / unknown | `CPL` |
   | Angular project | `ANG` |
   | Any other project | first 2–4 letters of the project name |

2. **Announce yourself:**
   ```
   whatsapp_send("[Copilot] Starting session on <project>. Reply with [C-HL] to reach me. [C-HL]")
   ```

3. **Check for queued messages** (user may have sent something before this session started):
   ```
   whatsapp_check("HL")
   ```

---

## ⚡ Auto-Poll Rule — MANDATORY

> **Once a moniker has been established in a session (i.e. `whatsapp_send` has been called at least once), call `whatsapp_check("<MONIKER>")` at the beginning of EVERY subsequent user turn — before doing anything else.**

This ensures the user's WhatsApp replies are never missed. The user cannot push messages into the session; Copilot must pull them. If you don't check at the start of each turn, replies sit in the mailbox unread.

```
// Start of every turn after moniker is set:
whatsapp_check("HL")   // always first, before reading the user's message
```

If a reply is waiting, acknowledge it before proceeding with whatever the user asked in the CLI.

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
