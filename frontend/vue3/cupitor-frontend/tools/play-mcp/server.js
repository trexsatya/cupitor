#!/usr/bin/env node
// MCP server for writing play.html animations. It opens play.html in a
// Chromium window and lets an MCP client (Claude, Cursor, VS Code, ...) run
// script lines there, look at the result and save the script.
//
//   node server.js                 stdio (what most MCP clients launch)
//   node server.js --http 3337     Streamable HTTP at http://127.0.0.1:3337/mcp
//   --headless                     no visible browser window
//   --public <dir>                 the folder holding play.html (default: ../../public)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { PlayPage, parseScriptFile } from './page-driver.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const opts = { http: null, headless: false, publicDir: path.resolve(here, '../../public') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--http') opts.http = Number(argv[++i]) || 3337;
    else if (argv[i] === '--headless') opts.headless = true;
    else if (argv[i] === '--public') opts.publicDir = path.resolve(argv[++i]);
  }
  if (process.env.PLAY_MCP_HEADLESS === '1') opts.headless = true;
  return opts;
}

// The function reference the page's "? Functions" popup shows
// (public/script-functions.js), as [group, [[signature, description, options], ...]].
export function loadFunctions(publicDir) {
  const code = fs.readFileSync(path.join(publicDir, 'script-functions.js'), 'utf8');
  return vm.runInNewContext(code + '\n;SCRIPT_FUNCTIONS', {});
}

export function formatFunctions(groups, filter) {
  const q = (filter || '').trim().toLowerCase();
  const out = [];
  groups.forEach(([group, items]) => {
    const shown = items.filter(([sig, desc, opts]) => !q ||
      [sig, desc, ...(opts || []).flat()].join(' ').toLowerCase().includes(q));
    if (!shown.length) return;
    out.push(`## ${group}`);
    shown.forEach(([sig, desc, opts]) => {
      out.push(`- ${sig} — ${desc}`);
      (opts || []).forEach(([key, meaning]) => out.push(`    - ${key}: ${meaning}`));
    });
  });
  return out.join('\n') || 'No function matches.';
}

const INSTRUCTIONS = `Writes animations for play.html, a Fabric.js whiteboard with a script player.
A script is a list of JavaScript lines run in order in the page. Each line runs after the previous one:
lines starting with animate, Promise, connectObjects, reveal or drawOutline are waited for; other lines are followed by a ~1 s pause.
Lines starting with // are comments (a /* ... */ can span lines): kept in the script, skipped when it plays; use them to label scenes.
Objects have uids (e.g. "R1", "T2"); pass {uid: "..."} when creating objects so later lines can refer to them.
Coordinates are canvas pixels (top-left 0,0; the visible canvas is about 1400x800 at zoom 1).
Workflow: list_functions to see what is available and its options; run_script_lines to add and play lines;
list_objects / screenshot to check the result; replay_script to watch the whole thing from the start;
save_script_file to keep it (the page's Import button loads such files).`;

export function createServer(page, publicDir) {
  const server = new McpServer({ name: 'play-animations', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  const text = t => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
  const report = r => {
    const lines = [`Played ${r.played} line(s) in ${r.ms} ms.`];
    r.lineErrors.forEach(e => lines.push(`Line ${e.line} failed: ${e.message}`));
    r.pageErrors.forEach(e => lines.push(`Page error: ${e}`));
    if (!r.lineErrors.length && !r.pageErrors.length) lines.push('No errors.');
    return lines.join('\n');
  };

  server.registerTool('list_functions', {
    description: 'Functions a play.html script can call, with their options. Optionally filter by a word (e.g. "tree", "text", "reveal").',
    inputSchema: { filter: z.string().optional() }
  }, async ({ filter }) => text(formatFunctions(loadFunctions(publicDir), filter)));

  server.registerTool('run_script_lines', {
    description: 'Add script lines to the recorded script and play them in the page (each line waits as the player does). Returns failures per line.',
    inputSchema: {
      lines: z.array(z.string()).min(1).describe('JavaScript lines, one statement each, e.g. addRect(100,100,120,60,{"uid":"R1","fill":"#90caf9"})'),
      record: z.boolean().optional().describe('Add them to the recorded script (default true). False just tries them.')
    }
  }, async ({ lines, record }) => text(report(await page.play(lines, { record: record !== false }))));

  server.registerTool('list_objects', {
    description: 'Objects on the canvas (including inside groups): uid, type, bounding box, angle, visibility, colours, text, tree children and connectors.',
    inputSchema: { uid: z.string().optional().describe('Only this object') }
  }, async ({ uid }) => text(await page.objects(uid)));

  server.registerTool('screenshot', {
    description: 'PNG of the canvas, or of one object with a margin around it.',
    inputSchema: { uid: z.string().optional(), margin: z.number().optional() }
  }, async ({ uid, margin }) => {
    const png = await page.screenshot(uid, margin);
    return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
  });

  server.registerTool('get_script', {
    description: 'The recorded script: every line so far, in order (1-based line numbers).'
  }, async () => {
    const lines = await page.script();
    return text(lines.map((l, i) => `${i + 1}: ${l}`).join('\n') || '(empty)');
  });

  server.registerTool('replace_script', {
    description: 'Replace the whole recorded script (e.g. to edit or delete lines). Use replay_script to see the result.',
    inputSchema: { lines: z.array(z.string()) }
  }, async ({ lines }) => { await page.setScript(lines); return text(`Script has ${lines.length} line(s).`); });

  server.registerTool('replay_script', {
    description: 'Clear the canvas and play the whole recorded script from the start. Returns failures per line.',
    inputSchema: { clear: z.boolean().optional().describe('Clear the canvas first (default true)') }
  }, async ({ clear }) => text(report(await page.play(null, { clearFirst: clear !== false }))));

  server.registerTool('load_script_file', {
    description: 'Load a script file (plain lines, or a play.html Export) as the recorded script and replay it.',
    inputSchema: { path: z.string() }
  }, async ({ path: file }) => {
    const lines = parseScriptFile(fs.readFileSync(path.resolve(file), 'utf8'));
    await page.setScript(lines);
    return text(report(await page.play(null, { clearFirst: true })));
  });

  server.registerTool('save_script_file', {
    description: "Save the recorded script to a file: 'lines' (one line per row, as the script editor shows) or 'export' (what the page's Export button writes). Both load with the page's Import button.",
    inputSchema: { path: z.string(), format: z.enum(['lines', 'export']).optional() }
  }, async ({ path: file, format }) => {
    const lines = await page.script();
    const body = format === 'export'
      ? JSON.stringify(await page.evaluate(() => buildScriptExecutables()))
      : lines.join('\n') + '\n';
    fs.writeFileSync(path.resolve(file), body);
    return text(`Saved ${lines.length} line(s) to ${path.resolve(file)}.`);
  });

  server.registerTool('reset_page', {
    description: 'Reload play.html: empty canvas and empty recorded script.'
  }, async () => { await page.reset(); return text('Page reloaded.'); });

  return server;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const page = new PlayPage({ publicDir: opts.publicDir, headless: opts.headless });
  const shutdown = async () => { await page.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (!opts.http) {
    await createServer(page, opts.publicDir).connect(new StdioServerTransport());
    return;
  }
  // Stateless Streamable HTTP: a fresh server per request, one shared page.
  http.createServer(async (req, res) => {
    if (!req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const server = createServer(page, opts.publicDir);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => { transport.close(); server.close(); });
        await server.connect(transport);
        await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      } catch (e) {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(e.message || e) }, id: null }));
      }
    });
  }).listen(opts.http, '127.0.0.1', () => {
    console.error(`play-animations MCP server on http://127.0.0.1:${opts.http}/mcp`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
