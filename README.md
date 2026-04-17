# whatsapp-mcp

A minimal [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets any Copilot CLI session send and receive WhatsApp messages via a [`copilot-wa`](https://github.com/SanderElias/HomeLab) bridge service.

## Tools

| Tool | Description |
|---|---|
| `whatsapp_send` | Send a WhatsApp message to the homelab owner |
| `whatsapp_check` | Read + clear pending replies for a session moniker |

## Requirements

- [Deno](https://deno.land/) 2.x
- A running [`copilot-wa`](https://github.com/SanderElias/HomeLab/tree/main/copilot-wa) service (part of the HomeLab stack)

## Installation

### Option A — Run directly with Deno (no compile)

Add to your `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "type": "local",
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-env",
               "/path/to/whatsapp-mcp/server.ts"],
      "env": {
        "COPILOT_WA_URL": "https://copilot-wa.home.local",
        "WHATSAPP_OWNER_JID": "31624771946@c.us"
      },
      "tools": ["*"]
    }
  }
}
```

### Option B — Compile to binary

```bash
deno compile --allow-net --allow-env --output ~/.local/bin/whatsapp-mcp server.ts
```

Then in `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "type": "local",
      "command": "/home/youruser/.local/bin/whatsapp-mcp",
      "args": [],
      "env": {
        "COPILOT_WA_URL": "https://copilot-wa.home.local",
        "WHATSAPP_OWNER_JID": "31XXXXXXXXX@c.us"
      },
      "tools": ["*"]
    }
  }
}
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `COPILOT_WA_URL` | `https://copilot-wa.home.local` | Base URL of the copilot-wa service |
| `WHATSAPP_OWNER_JID` | `31624771946@c.us` | Default recipient WhatsApp JID |
| `DENO_CERT` | _(unset)_ | Path to a custom CA certificate (required for self-signed/local TLS, e.g. Caddy local CA) |

## Usage pattern

When starting a session, Copilot should:

1. Pick a short project moniker (e.g. `HL` for HomeLab, `API` for an API project)
2. Announce itself: `whatsapp_send("[Copilot] Starting session on <project>. Reply with [C-HL] to reach me. [C-HL]")`
3. Poll for replies with: `whatsapp_check("HL")`

Messages containing `[C-<moniker>]` (case-insensitive) are automatically routed to the correct session mailbox by the copilot-wa service.

## Architecture

```
Copilot CLI
  └─ whatsapp-mcp (this, stdio MCP)
       └─ copilot-wa REST API  (https://copilot-wa.home.local)
            └─ chatbridge SSE  (WhatsApp bridge)
                 └─ WhatsApp ↔ User phone
```

## License

MIT
