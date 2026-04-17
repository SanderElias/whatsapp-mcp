#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * WhatsApp MCP Server (stdio)
 *
 * Exposes two tools for any Copilot CLI session:
 *   whatsapp_send       — send a WhatsApp message via copilot-wa
 *   whatsapp_check      — read + clear pending mailbox messages for a moniker
 *
 * Configured via env vars (or defaults):
 *   COPILOT_WA_URL      — base URL of the copilot-wa service (default: https://copilot-wa.home.local)
 *   WHATSAPP_OWNER_JID  — default recipient JID (default: 31624771946@c.us)
 */

const COPILOT_WA_URL = Deno.env.get('COPILOT_WA_URL') ?? 'https://copilot-wa.home.local';
const OWNER_JID = Deno.env.get('WHATSAPP_OWNER_JID') ?? '31624771946@c.us';

const TOOLS = [
  {
    name: 'whatsapp_send',
    description:
      'Send a WhatsApp message to the homelab owner. ' +
      'Always prefix the message with "[Copilot] " so the user knows it comes from a Copilot session. ' +
      'Always append the session moniker (e.g. "[C-HL]") at the end so the user can reply to this session.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message text to send. Should start with "[Copilot] " and end with "[C-<MONIKER>]".',
        },
        to: {
          type: 'string',
          description: `WhatsApp JID to send to. Defaults to the homelab owner (${OWNER_JID}).`,
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'whatsapp_check',
    description:
      'Check for pending WhatsApp replies addressed to this Copilot session. ' +
      'Returns all messages the user sent containing the session moniker (e.g. "[C-HL]") and clears the mailbox. ' +
      'Call this to read replies from the user.',
    inputSchema: {
      type: 'object',
      properties: {
        moniker: {
          type: 'string',
          description: 'The session moniker (2-8 alphanumeric chars, e.g. "HL" for HomeLab). Case-insensitive.',
        },
      },
      required: ['moniker'],
    },
  },
];

async function handleToolCall(name: string, args: Record<string, string>): Promise<string> {
  if (name === 'whatsapp_send') {
    const to = args.to ?? OWNER_JID;
    const res = await fetch(`${COPILOT_WA_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message: args.message }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Send failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return `Message sent. ID: ${data.messageId ?? 'unknown'}`;
  }

  if (name === 'whatsapp_check') {
    const moniker = args.moniker.toLowerCase();
    const res = await fetch(`${COPILOT_WA_URL}/mailbox/${encodeURIComponent(moniker)}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mailbox check failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (data.count === 0) return 'No pending messages.';
    const lines = data.messages.map((m: { from: string; message: string; timestamp: string }) =>
      `[${m.timestamp}] ${m.from}: ${m.message}`
    );
    return `${data.count} message(s):\n${lines.join('\n')}`;
  }

  throw new Error(`Unknown tool: ${name}`);
}

// MCP stdio transport — read newline-delimited JSON-RPC from stdin, write to stdout
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function send(obj: unknown) {
  Deno.stdout.writeSync(encoder.encode(JSON.stringify(obj) + '\n'));
}

async function main() {
  let buf = '';
  const input = Deno.stdin.readable.getReader();

  while (true) {
    const { value, done } = await input.read();
    if (done) break;
    buf += decoder.decode(value);

    let newline: number;
    while ((newline = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, newline).trim();
      buf = buf.slice(newline + 1);
      if (!line) continue;

      let req: { jsonrpc: string; id?: number | string; method: string; params?: Record<string, unknown> };
      try {
        req = JSON.parse(line);
      } catch {
        continue;
      }

      const { id, method, params } = req;

      if (method === 'initialize') {
        send({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'whatsapp-mcp', version: '1.0.0' },
            capabilities: { tools: {} },
          },
        });
        // Send initialized notification
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        continue;
      }

      if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
        continue;
      }

      if (method === 'tools/call') {
        const toolName = (params as { name: string; arguments: Record<string, string> }).name;
        const toolArgs = (params as { name: string; arguments: Record<string, string> }).arguments ?? {};
        try {
          const result = await handleToolCall(toolName, toolArgs);
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result }] } });
        } catch (err) {
          send({
            jsonrpc: '2.0', id,
            error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
          });
        }
        continue;
      }

      if (method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
        continue;
      }

      // Unknown method — respond with method not found
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  }
}

main();
