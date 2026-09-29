# play-animations MCP server

An [MCP](https://modelcontextprotocol.io) server for writing play.html animations. It opens
`public/play.html` in a Chromium window and lets any MCP client (Claude Code, Claude Desktop,
Cursor, VS Code, Windsurf, …) add script lines, play them, look at the result and save the script.
Lines run through the page's own player, so they behave exactly like a recorded script and the
saved file loads with the page's **Import** button.

## Setup

```sh
cd frontend/vue3/cupitor-frontend
npm install                      # the web app's dependencies (Playwright)
npx playwright install chromium  # the browser it drives
cd tools/play-mcp && npm install # the MCP SDK
```

## Running

| Command | What it does |
| --- | --- |
| `node server.js` | stdio server (what most clients start) with a visible browser window |
| `node server.js --headless` | same, without a window (also `PLAY_MCP_HEADLESS=1`) |
| `node server.js --http 3337` | Streamable HTTP server at `http://127.0.0.1:3337/mcp` |
| `node server.js --public <dir>` | use another folder holding `play.html` (default `../../public`) |

The server serves the `public/` folder itself on a free local port; nothing else needs to be running.

## Adding it to a client

Use the absolute path to `server.js` below (shown here as `/path/to/tools/play-mcp/server.js`).

**Claude Code**

```sh
claude mcp add play-animations -- node /path/to/tools/play-mcp/server.js
```

**Claude Desktop** (`claude_desktop_config.json`), **Cursor** (`~/.cursor/mcp.json`),
**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "play-animations": { "command": "node", "args": ["/path/to/tools/play-mcp/server.js"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "play-animations": { "type": "stdio", "command": "node", "args": ["/path/to/tools/play-mcp/server.js"] }
  }
}
```

**Clients that connect by URL:** start `node server.js --http 3337` and point them at
`http://127.0.0.1:3337/mcp`.

## Tools

| Tool | What it does |
| --- | --- |
| `list_functions` | Functions a script can call, with their options (from `public/script-functions.js`, the same list the page's **? Functions** popup shows). Optional word filter. |
| `run_script_lines` | Add lines to the recorded script and play them; each line waits as the player does. Reports failures per line. `record: false` just tries them. |
| `list_objects` | Objects on the canvas, including inside groups: uid, type, bounding box, angle, visibility, colours, text, tree children, connectors. |
| `screenshot` | PNG of the canvas, or of one object with a margin. |
| `get_script` | The recorded script, numbered. |
| `replace_script` | Replace the whole script (to edit or delete lines). |
| `replay_script` | Clear the canvas and play the whole script from the start. |
| `load_script_file` | Load a script file (plain lines or a page Export) and replay it. |
| `save_script_file` | Save the script as plain lines (`lines`, default) or as the page's Export format (`export`). |
| `reset_page` | Reload the page: empty canvas and empty script. |

The server also gives clients a short guide to how scripts run (order, waiting, uids,
coordinates) as its MCP `instructions`.

## Tests

```sh
npm test
```

Starts the server headless, connects a real MCP client over stdio and over HTTP, and exercises
every tool.
