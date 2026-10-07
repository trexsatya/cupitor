// Review mode: one HTML page per script showing, for each beat, what the
// narrator does, what the viewer should do, the narration with its times, the
// visual moves in plain words, a checklist and how the canvas looks (before the
// first reveal, if the beat holds one back, and at the end). Pure: the frames
// and per-stop issues come from the caller.

import { annotations, timeline, describe } from './scene.js';

const VISUAL = op => !['narrate', 'pause', 'viewer_task', 'checkpoint', 'scene', 'beat'].includes(op);

// Where a review stops to look: for each beat, the line where it ends (the next
// beat or scene, or the end of the script) and, when the beat makes the viewer
// wait (a 'before' narration or a pause) and then moves, the line of the move
// it held back: the "has anything been given away yet?" frame.
export function reviewStops(lines) {
  const marks = annotations(lines).list; // {line (1-based), record}
  const stops = [];
  let cur = null;
  marks.forEach(({ line, record }) => {
    const index = line - 1;
    if (record.op === 'scene' || record.op === 'beat') {
      if (cur) cur.endIndex = index;
      cur = record.op === 'beat' ? { beat: record.name, index, waited: false } : null;
      if (cur) stops.push(cur);
      return;
    }
    if (!cur) return;
    if ((record.op === 'narrate' && record.sync === 'before') || record.op === 'pause') cur.waited = true;
    else if (VISUAL(record.op) && cur.beforeIndex == null && cur.waited) cur.beforeIndex = index;
  });
  if (cur) cur.endIndex = lines.length;
  return stops.map(({ waited, ...s }) => s);
}

const sec = ms => `${(ms / 1000).toFixed(1)}s`;
const q = t => `“${t}”`;

// One action in plain words.
export function plainMove(rec) {
  const place = p => !p ? '' : p.near ? `, ${p.side && p.side !== 'around' ? `${p.side} of` : 'near'} ${p.near}`
    : p.between ? `, between ${p.between.join(' and ')}` : p.region ? `, ${p.region}` : '';
  switch (rec.op) {
    case 'introduce': return `introduce ${rec.text ? q(rec.text) : 'a ' + rec.kind} as ${rec.id}${rec.kind !== 'text' ? ` (${rec.kind})` : ''}`;
    case 'introduce_group': return `introduce group ${rec.id}: ${rec.items.map(i => q(i.text)).join(', ')}`;
    case 'branch': return `branch from ${rec.from}: ${rec.items.map(i => q(i.text)).join(', ')}`;
    case 'connect': return `connect ${rec.from} → ${rec.to}${rec.bend === 'loop' ? ' (loop)' : rec.bend ? ' (curved)' : ''}${rec.kind ? ` [${rec.kind}]` : ''}`;
    case 'disconnect': return `disconnect ${rec.id}`;
    case 'enclose': return `enclose ${rec.members.join(', ')} in ${rec.id}${rec.style === 'dashed' ? ' (dashed)' : ''}`;
    case 'revise': return `revise ${rec.id} → ${q(rec.text)}`;
    case 'question': return `question ${rec.id} → ${q(rec.text)}`;
    case 'weaken_boundary': return `weaken the boundary of ${rec.id} (${rec.style})`;
    case 'replace': return `replace ${rec.id} with ${q(rec.with.text)} as ${rec.with.id} (a new identity)`;
    case 'deemphasize': return `fade back ${Object.keys(rec.opacity).join(', ')}`;
    case 'focus': return `focus on ${(rec.ids || []).join(', ')}`;
    case 'move_into': return `move ${rec.id} into ${rec.into}`;
    case 'widen_context': return rec.camera ? `camera pulls back (zoom ${rec.camera.zoom})${rec.auto ? ' to make room' : ''}` : `shrink ${Object.keys(rec.moves).join(', ')} to ${rec.scale}`;
    case 'narrow_context': return rec.reset ? 'camera back to the starting view' : `camera in on ${(rec.ids || []).join(', ')} (zoom ${rec.camera.zoom})`;
    case 'dissolve_boundary': return `dissolve ${rec.ids.join(', ')} into the band ${rec.id}`;
    case 'checkpoint': return `checkpoint ${q(rec.name)}`;
    case 'return_to': return rec.name ? `return to checkpoint ${q(rec.name)}` : `bring back ${rec.ids.join(', ')}`;
    case 'turnover': return `turnover in ${rec.group}: ${rec.leaving.join(', ') || 'none'} leave, ${rec.arriving.map(a => a.id).join(', ') || 'none'} arrive`;
    case 'pause': return `pause ${rec.seconds}s${rec.kind && rec.kind !== 'short' ? ` (${rec.kind})` : ''}`;
    case 'remove': return `remove ${rec.ids.join(', ')}`;
    default: return describe(rec, { scene: null, beat: null }) + place(rec.place);
  }
}

// Ids an action refers to that already existed (concepts it reuses).
function refs(rec) {
  return [rec.from, rec.to, rec.into, rec.group, ...(rec.ids || []), ...(rec.members || []),
    ...(['revise', 'question', 'weaken_boundary', 'replace', 'move_into'].includes(rec.op) ? [rec.id] : [])].filter(Boolean);
}
const created = rec => [...(rec.op === 'introduce' ? [rec.id] : []), ...((rec.items || rec.arriving || []).map(i => i.id)),
  ...(rec.op === 'replace' ? [rec.with.id] : []), ...(['enclose', 'dissolve_boundary'].includes(rec.op) ? [rec.id] : [])];

const isReadability = i => /hard to read/.test(i.message);
const isLayout = i => /overlap|out of view|minimap|runs through|sticks out|not one of its members/.test(i.message);

// The checklist for one beat: [label, ok (true/false/null for not applicable), detail].
export function beatChecklist(tb, issues, earlierIds) {
  const items = tb.items, visual = items.filter(it => VISUAL(it.op));
  const task = items.find(it => it.op === 'viewer_task') || null;
  const firstVisual = items.findIndex(it => VISUAL(it.op));
  const firstNarr = items.findIndex(it => it.op === 'narrate');
  const narrMs = items.filter(it => it.op === 'narrate').reduce((s, it) => s + it.rec.hold, 0);
  const reused = [...new Set(visual.flatMap(it => refs(it.rec)).filter(id => earlierIds.has(id)))];
  const revisions = items.filter(it => it.op === 'revise' || it.op === 'question').map(it => `${it.rec.id} → ${q(it.rec.text)}`);
  const replaced = items.filter(it => it.op === 'replace').map(it => `${it.rec.id} → ${it.rec.with.id}`);
  const asked = issues.filter(i => /asks a question/.test(i.message));
  return [
    ['viewer task stated', !!(tb.task || task), tb.task ? `${tb.task.type}: ${tb.task.target}` : ''],
    ["narrator's move stated", !!tb.move, tb.move || ''],
    ['narration before the first reveal', firstVisual < 0 ? null : firstNarr >= 0 && firstNarr < firstVisual, firstVisual < 0 ? 'no visual moves' : ''],
    ['questions leave time to think', asked.length ? false : null, asked.map(i => i.id).join(', ')],
    ['moves', null, `${visual.length}`],
    ['reuses earlier concepts', reused.length ? true : null, reused.join(', ')],
    ['revisions keep identity', replaced.length ? false : revisions.length ? true : null, [...revisions, ...replaced.map(r => `${r} (replaced)`)].join('; ')],
    ['readability warnings', issues.some(isReadability) ? false : true, `${issues.filter(isReadability).length}`],
    ['layout warnings', issues.some(isLayout) ? false : true, `${issues.filter(isLayout).length}`],
    ['length', null, `${sec(tb.end - tb.start)}, narration ${sec(narrMs)}`]
  ];
}

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CRITERIA = [
  'Can the viewer task be stated for each beat?',
  'Is the key relationship easier to see than in text alone?',
  'Is the central inference revealed no earlier than intended?',
  'Can every motion be justified by a change in meaning?',
  'Is text readable without pausing?',
  'Is identity kept through revisions when the concept is the same?'
];

// The review page. stops: reviewStops(lines); frames: {[stopKey]: base64 PNG}
// where stopKey is `${i}:before` or `${i}:end`; issues: {[i]: issues at the
// end of beat i}, prev: {[i]: issue messages at the end of the beat before}.
export function buildReviewHtml({ title, lines, stops, frames = {}, issues = {} }) {
  const tl = timeline(lines);
  const tbs = tl.beats.filter(b => b.isBeat); // in step with the stops, one per beat annotation
  const earlier = new Set();
  const tasks = annotations(lines).list.filter(a => a.record.op === 'viewer_task' || (a.record.op === 'beat' && a.record.viewer_task));
  const sections = stops.map((stop, i) => {
    const tb = tbs[i] || { items: [], start: 0, end: 0 };
    const beatRec = annotations(lines).list.find(a => a.line - 1 === stop.index).record;
    tb.task = beatRec.viewer_task || (tb.items.find(it => it.op === 'viewer_task') || {}).rec || null;
    tb.move = beatRec.move;
    // Narration issues say which beat (by its start) they belong to; the rest
    // are how the canvas stood at the end of this beat.
    const mine = (issues[i] || []).filter(x => x.at == null || x.at === tb.start);
    const before = new Set((issues[i - 1] || []).map(x => x.message));
    const list = beatChecklist(tb, mine, earlier);
    tb.items.forEach(it => created(it.rec).forEach(id => earlier.add(id)));
    const mark = ok => (ok === true ? '<span class="ok">✓</span>' : ok === false ? '<span class="no">✗</span>' : '<span class="na">·</span>');
    const narration = tb.items.filter(it => it.op === 'narrate').map(it =>
      `<li><span class="t">${sec(it.start)}</span> <em>${esc(it.rec.id)}</em> ${esc(q(it.rec.text))} <span class="dim">(${esc(it.rec.sync)}, ${sec(it.rec.hold)})</span></li>`).join('');
    const moves = tb.items.filter(it => it.op !== 'narrate' && it.op !== 'viewer_task').map(it =>
      `<li><span class="t">${sec(it.start)}</span> ${esc(plainMove(it.rec))}</li>`).join('');
    const issueList = mine.map(x => `<li class="${esc(x.level)}">${before.has(x.message) ? '<span class="dim">(still)</span> ' : ''}${esc(x.level)}: ${esc(x.message)}</li>`).join('');
    const held = stop.beforeIndex != null && annotations(lines).list.find(a => a.line - 1 === stop.beforeIndex);
    const img = (key, label) => frames[key] ? `<figure><img src="data:image/png;base64,${frames[key]}" alt="${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>` : '';
    return `<section class="beat" id="beat-${i + 1}">
  <div class="text">
    <h2>${i + 1}. ${esc(stop.beat)} <span class="dim">${sec(tb.start)}–${sec(tb.end)}</span></h2>
    <p><b>Narrator's move:</b> ${tb.move ? esc(tb.move) : '<span class="no">not stated</span>'}</p>
    <p><b>Viewer task:</b> ${tb.task ? `${esc(tb.task.type)}: ${esc(tb.task.target)}` : '<span class="no">not set</span>'}</p>
    <h3>Narration</h3>${narration ? `<ul>${narration}</ul>` : '<p class="dim">none</p>'}
    <h3>Visual moves</h3>${moves ? `<ul>${moves}</ul>` : '<p class="dim">none</p>'}
    <h3>Checklist</h3><table>${list.map(([label, ok, detail]) => `<tr><td>${mark(ok)}</td><td>${esc(label)}</td><td class="dim">${esc(detail)}</td></tr>`).join('')}</table>
    ${issueList ? `<h3>Issues at the end of this beat</h3><ul class="issues">${issueList}</ul>` : ''}
  </div>
  <div class="frames">${held ? img(`${i}:before`, `held back until here: ${plainMove(held.record)}`) : ''}${img(`${i}:end`, 'end of beat')}</div>
</section>`;
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { --ink: #1f2328; --dim: #6b7280; --line: #e5e7eb; --ok: #15803d; --no: #b91c1c; --bg: #fff; --card: #f8fafc; }
@media (prefers-color-scheme: dark) { :root { --ink: #e5e7eb; --dim: #9ca3af; --line: #374151; --ok: #4ade80; --no: #f87171; --bg: #111827; --card: #1f2937; } }
body { margin: 0; padding: 24px 16px; font: 15px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
main { max-width: 1280px; margin: 0 auto; }
h1 { margin: 0 0 4px; } h2 { margin: 0 0 8px; font-size: 18px; } h3 { margin: 14px 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--dim); }
.beat { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; padding: 18px; margin: 18px 0; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
@media (max-width: 860px) { .beat { grid-template-columns: 1fr; } }
ul { margin: 0; padding-left: 18px; } li { margin: 2px 0; } table { border-collapse: collapse; } td { padding: 2px 8px 2px 0; vertical-align: top; }
figure { margin: 0 0 12px; } img { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
figcaption, .dim, .t { color: var(--dim); font-size: 13px; } .t { font-variant-numeric: tabular-nums; }
.ok { color: var(--ok); font-weight: 700; } .no { color: var(--no); font-weight: 700; } .na { color: var(--dim); }
.issues .warning, .issues .error { color: var(--no); }
</style></head><body><main>
<h1>${esc(title)}</h1>
<p class="dim">${tbs.length} beats, about ${sec(tl.total)}. ${tasks.length} viewer task(s).</p>
<details><summary>Questions to ask of every beat</summary><ul>${CRITERIA.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
${sections.join('\n')}
</main></body></html>
`;
}

