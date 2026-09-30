# Whiteboard feature videos

Records a narrated video of each `play.html` feature. Each clip drives the real page the way a
person does (toolbar, mouse, keyboard, Properties and Tree panels, right-click menu), with a
caption for every step and a dot that shows the mouse. Most clips end by replaying the recorded
script on a cleared board.

```sh
node tools/whiteboard-demo/record.mjs                      # every clip
node tools/whiteboard-demo/record.mjs 03-html-box          # just some clips
node tools/whiteboard-demo/record.mjs --out ~/Movies/wb    # somewhere else
npm run demo:whiteboard                                    # the same as the first line
```

| Clip | Shows |
| --- | --- |
| `01-mind-map` | Tree children from `t`, the Tree panel, facing-edge lines, connector, group move/scale/rotate |
| `02-text` | Text box that fits its text, widen + undo, multi-line text in shapes |
| `03-html-box` | Typing and formatting, the CKEditor with CSS in Source, shapes on top, sharp zoom |
| `04-presenting` | Draw outline, reveal, spotlight while zoomed |
| `05-editing` | Delete + undo (menu and key), copy/paste and Duplicate of a connected pair, undo a move |
| `06-arranging` | Snap to align, resize/turn a multi-selection, undo, typing in a panel field |
| `07-scripts` | Script editor, the Functions help, importing the nested-groups lesson (shown at 4×) |

Output goes to `tools/whiteboard-demo/out/`: `raw/*.webm` as recorded, and, with
[ffmpeg](https://ffmpeg.org) installed, `mp4/*.mp4` per clip plus `whiteboard-features.mp4`
with all of them. `--no-mp4` skips the conversion.

It needs the web app's dependencies and Chromium (`npm install`, `npx playwright install
chromium`) and the MCP server's (`cd tools/play-mcp && npm install`); it serves `public/`
itself.
