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

## Guided visual reasoning: semantic actions

Scenes can be built from meaning rather than coordinates. A client sends actions such as

```json
[{ "op": "beat", "name": "many causes", "viewer_task": { "type": "infer", "target": "behaviour has many causes" } },
 { "op": "introduce", "id": "culture", "text": "CULTURE", "role": "cause", "place": { "near": "person", "side": "left" } },
 { "op": "connect", "from": "culture", "to": "person" },
 { "op": "pause", "kind": "prediction" }]
```

and the server lays them out, writes ordinary script lines, and plays them. Each action is kept in the script as
a comment just before the lines it wrote:

```
// @sem {"op":"introduce","id":"culture","kind":"text","text":"CULTURE","fontSize":22,"boundary":"none","role":"cause","at":[214,400],"size":[121,50]}
drawOutline(addLabel("CULTURE", 214, 400, {"uid":"culture","fontSize":22,"boundary":"none"}), {duration: 700})
```

The scene model (concepts, roles, revisions, groups, enclosures, relationships, beats, viewer tasks) is rebuilt
from these comments whenever it is needed (`scene.js`, `parseScene`), so a saved script carries its own
intent: loading it brings the scene back, and deleting an action's lines removes it from the scene. Each
comment holds the positions and sizes the action settled on, so rebuilding never needs the page.

| Action | What it does |
| --- | --- |
| `scene`, `beat`, `viewer_task` | Name the scene and its beats (a beat can say the narrator's `move`); record what the viewer should do mentally (notice, compare, predict, infer, remember, question, integrate) |
| `introduce`, `introduce_group`, `branch` | Add concepts as text, a box, a minimal person (`figure`) or a `picture`; placed near another concept or group, between two, in a region, or in a row or column. A `role` from the palette (citizen, knowledge, power, feedback, risk, values, technical, neutral) colours a concept, and `color` sets one directly; `background` fills the box behind a text or box concept; the colour stays through revisions, emphasis changes and going back, and a group's items, a replacement and turnover arrivals take colour and background on unless given their own |
| `type`, `write` | A text concept typed in a character at a time, or written by hand stroke after stroke (still handwritten after a revise or question), for a proposition being formulated in front of the viewer; otherwise as `introduce` |
| `connect`, `disconnect` | Relationships: arrows that follow both ends. They (and `branch` arrows) curve round concepts in the way and off a reverse arrow; an arrow from a concept to itself is a loop. When a concept is pushed aside, its arrows take the curve that suits where it now is (a curve given by hand stays). A group as an end means its enclosure (a dashed one is drawn first if it has none). Arrows leave and arrive at the middles of facing edges, never a corner unless `from_side` / `to_side` names one |
| `enclose`, `weaken_boundary` | A boundary round concepts; dash or drop it |
| `revise`, `question`, `replace` | Change a concept's text, or a figure's or picture's label, in place (its revisions are kept), make it uncertain, or swap it for another; a longer text pushes the concepts beside it aside |
| `deemphasize`, `focus` | Fade concepts back, or bring some forward and dim the rest |
| `move_into` | Move a concept into another |
| `widen_context`, `narrow_context` | Pull the camera back so concepts sit small in a much larger frame (or, with `mode: "objects"`, shrink just those concepts); bring it in on some concepts or back to the starting view. When a new, longer or replaced concept has no room in view, the camera pulls back by itself first, as its own step |
| `dissolve_boundary` | Categories become a continuum: their boxes lose their outlines while a colour band appears under them (place in-between cases first with `place: {between: [a, b]}`) |
| `checkpoint`, `return_to` | Remember the scene; go back to it (places, text, emphasis, removed concepts, camera), or bring back removed concepts by id (a dimmed one still on screen comes back to full strength) |
| `turnover` | Members of a group leave while new ones arrive, the group (and its enclosure) holding |
| `narrate` | A line of narration shown as a caption (see below) |
| `pause`, `remove` | Hold still (`short`, `prediction`, `thinking`); fade out and delete |

`examples/` holds whole scenes built this way. `opening_question.txt`: a child's question about the point of life,
practical answers enclosing it, competing arguments that shrink into a wider frame, and "I KNOW" revised step
by step down to "I DON'T KNOW". Load it with `load_script_file` (or the page's **Import**) and use `inspect_scene`
to see its beats and viewer tasks. `tree.txt` grows a web of conditions round a tree until the tree is one
node among many; `spectrum.txt` puts in-between cases between DAY and NIGHT until the boundary dissolves
into a band; `river.txt` keeps RIVER while every drop is replaced, then does the same for ME. All four are narrated.

A picture's `src` can be a URL, a path under `public/`, or a local file; a local file elsewhere is copied into
`public/play-assets/` so the script loads it by a path the page serves. Durations are classes (`instant`,
`short`, `deliberate`) or ms. Layout keeps concepts in view, clear of each other, of the page's minimap and of the narration caption strip; under a
zoomed-out camera, new text is made larger in the scene so it reads at the size asked for. The first `scene`
of a script resets the camera, so replays start from the same view.

### Narration

`{"op": "narrate", "text": "Then the child asks something no dinner can answer."}` shows the line as a caption at
the bottom of the screen. It is held for its reading time (160 words a minute, plus a moment to notice it;
1.5–8 s), or `seconds` if given. With `sync: "before"` (the default) the script waits while it is read, so what
follows is revealed after it; with `sync: "with"` what follows plays while the caption shows. A caption stays
until the next line, beat or scene. Each line has an id (`n1`, `n2`, … unless given), the key a recorded voice
for that line can use later.

Tools that play the script (`apply_semantic_action`, `run_script_lines`, `replay_script`, `load_script_file`,
`undo_last_action`) return when playback ends, which for a narrated scene can take minutes. While they play,
the server sends a progress notification every 5 s to clients that ask for progress, so those clients keep
waiting; a client that doesn't reset its timeout on progress may need a longer tool timeout.

`scene_timeline` lists each beat with its start time, its viewer task, its narration and its moves, with
estimated times. `export_captions` writes the narration as a WebVTT (or SRT) caption track timed to the
script. `validate_scene` also flags lines shown too briefly to read, a question followed at once by the next
move (no time to think), and beats that move without narration.

### Review mode

`review_scene` writes one self-contained HTML page for a script (the recorded one, or a file). For each beat it
shows the narrator's move (`{op: "beat", name, move}`), the viewer task, the narration with its times, the visual
moves in plain words, a checklist (task and move stated, narration before the first move, questions given time,
concepts reused, revisions that keep or replace identity, readability and layout warnings, length), the issues
found at the end of the beat, and two screenshots: the end of the beat and, when the beat makes the viewer wait
(a `before` narration or a pause) and then moves, the moment just before the move it held back. For the
screenshots the script is replayed once with waits and animations cut to almost nothing, so a scene that plays
for minutes is reviewed in seconds; the canvas is left at the script's end.

### Plans

A plan is a whole scene document as JSON: `{title, scenes: [{name, beats: [{name, move, viewer_task, actions}]}]}`,
where `actions` are the semantic actions above. [PLAN-SPEC.md](PLAN-SPEC.md) is the instructions for another
assistant (for example ChatGPT) that turns a text into a plan: give it the spec and the text, and save the JSON
it answers with. `examples/spectrum.plan.json` is a small plan.

`build_from_plan {path, dry_run: true}` checks a plan without changing the canvas or the script: its shape, then
every action laid out in order (pictures are loaded to measure them, and local ones copied to `public/play-assets/`),
reporting the first problem by scene, beat and action. Without `dry_run` it clears the page (unless
`fresh: false`), builds the script, plays it and reports what `validate_scene` finds. `plan_spec` returns the
same text as PLAN-SPEC.md, generated from the action list, so the two cannot drift apart.

## Tools

| Tool | What it does |
| --- | --- |
| `apply_semantic_action` | Apply semantic actions in order: laid out, written to the script with their `// @sem` comments, and played. If any action is invalid, none is applied. |
| `inspect_scene` | The scene model rebuilt from the script, with each concept's live box on the canvas. |
| `validate_scene` | Overlaps, things off the canvas or under the minimap (or the caption, when there is narration), text too small to read, arrows running through other concepts, concepts missing from the canvas, enclosures that miss members or catch others, a scene without a viewer task. |
| `scene_timeline` | The script as it plays: beats with start times, viewer tasks, narration and moves. |
| `export_captions` | Write the narration as a caption track (`vtt`, default, or `srt`) timed to the script. |
| `review_scene` | Write a review page: per beat, move, viewer task, narration, moves, checklist, issues and screenshots. |
| `plan_spec` | The instructions for writing a plan from a text (PLAN-SPEC.md). |
| `build_from_plan` | Check (`dry_run`) or build a plan file into the script and play it. |
| `undo_last_action` | Remove the last semantic action and its lines, and replay. |
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

`test/scene.test.js` checks the scene layer on its own (layout, rebuilding from the script, validation, narration
timing); `test/review.test.js` the review page.
`test/server.test.js` starts the server headless, connects a real MCP client over stdio and over HTTP, and
exercises every tool.
