// Plans: a whole scene document as data, so another assistant (or a person)
// can turn a text into something this server builds. A plan is
//   { title, scenes: [{ name, beats: [{ name, move, viewer_task, actions: [...] }] }] }
// where actions are the semantic actions apply_semantic_action takes.

import { ACTIONS, VIEWER_TASKS, PACE, PAUSE, TEXT_SIZE, REGIONS } from './scene.js';

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// The plan's beats as lists of actions, each with where it came from, plus
// problems with the plan's shape (which stop it being built) and warnings.
export function planBeats(plan) {
  const errors = [], warnings = [], beats = [];
  if (!isObj(plan)) return { errors: ['The plan must be a JSON object with "scenes".'], warnings, beats };
  if (!Array.isArray(plan.scenes) || !plan.scenes.length) errors.push('"scenes" must be a non-empty list.');
  (plan.scenes || []).forEach((scene, si) => {
    const where = `scene ${si + 1}${scene && scene.name ? ` "${scene.name}"` : ''}`;
    if (!isObj(scene) || typeof scene.name !== 'string' || !scene.name.trim()) { errors.push(`${where}: needs a "name".`); return; }
    if (!Array.isArray(scene.beats) || !scene.beats.length) { errors.push(`${where}: "beats" must be a non-empty list.`); return; }
    scene.beats.forEach((beat, bi) => {
      const at = `${where}, beat ${bi + 1}${beat && beat.name ? ` "${beat.name}"` : ''}`;
      if (!isObj(beat) || typeof beat.name !== 'string' || !beat.name.trim()) { errors.push(`${at}: needs a "name".`); return; }
      if (!Array.isArray(beat.actions) || !beat.actions.length) { errors.push(`${at}: "actions" must be a non-empty list.`); return; }
      if (!beat.move) warnings.push(`${at}: no "move" (what the narrator does in this beat).`);
      if (!beat.viewer_task) warnings.push(`${at}: no "viewer_task" (what the viewer should do).`);
      const head = [];
      if (bi === 0) head.push({ op: 'scene', name: scene.name });
      head.push({ op: 'beat', name: beat.name, ...(beat.move ? { move: beat.move } : {}), ...(beat.viewer_task ? { viewer_task: beat.viewer_task } : {}) });
      beat.actions.forEach((a, ai) => {
        if (!isObj(a) || typeof a.op !== 'string') errors.push(`${at}, action ${ai + 1}: each action is an object with an "op".`);
        else if (a.op === 'scene' || a.op === 'beat') errors.push(`${at}, action ${ai + 1}: "${a.op}" comes from the plan's structure; leave it out of "actions".`);
        else if (!ACTIONS[a.op]) errors.push(`${at}, action ${ai + 1}: unknown op "${a.op}".`);
        else if ('place' in a && !isObj(a.place)) errors.push(`${at}, action ${ai + 1}: "place" is an object such as {"region": "left"} or {"near": id, "side": "below"}.`);
      });
      beats.push({ where: at, head, actions: beat.actions });
    });
  });
  return { errors, warnings, beats };
}

// The instructions to give an assistant that writes plans from a text.
export function planSpec(example) {
  const actions = Object.entries(ACTIONS).filter(([op]) => op !== 'scene' && op !== 'beat')
    .map(([op, d]) => `- \`${op}\`: ${d}`).join('\n');
  return `# Writing a visual-reasoning plan from a text

You turn a passage of philosophical or explanatory text into a **plan**: a JSON document describing an animation
that helps a viewer think the passage through. A server lays the plan out and animates it; you never give pixel
positions or write code. Answer with the plan as one JSON object and nothing else.

## What the animation is for

This is guided visual reasoning, not entertainment. The animation should take away needless effort and leave
the thinking to the viewer.

- Each beat makes one conceptual move. Motion happens only when the meaning changes; stillness is a valid state.
- Reveal step by step. Do not show a finished diagram, and do not show the conclusion before the viewer has had
  the chance to infer it. Put a question in the narration *before* its answer, followed by
  \`{"op": "pause", "kind": "prediction"}\`. Put \`{"op": "pause", "kind": "thinking"}\` after an unresolved state.
- Reuse concepts that are already on screen (refer to their ids) instead of inventing new pictures. Keep the
  same id when a concept is revised (\`revise\`, \`question\`); use \`replace\` only when it really becomes
  something else.
- Choose the smallest model: a few words, arrows and boundaries. Keep around a dozen concepts on screen at most;
  fade or remove what is finished, or widen the frame (\`widen_context\`) to show a change of scale.
- Make room before a new topic: \`remove\` what the next idea does not need (a large boundary especially), or pull
  the camera back with \`narrow_context {"reset": true}\` or \`widen_context\`. New concepts are placed in free space;
  when there is none, the camera pulls back by itself to make some, and everything on screen gets smaller.
- Diagrams may fail, revise themselves or stay unresolved when the argument does.

## How to work, for each passage

1. Split the text into scenes (a section of argument) and beats (one move each, usually 3–8 actions).
2. For each beat write the narrator's \`move\` (one sentence: what the narration does) and a \`viewer_task\`:
   \`{"type": one of ${VIEWER_TASKS.map(t => `"${t}"`).join(', ')}, "target": what the viewer should arrive at}\`.
3. Write the narration as short lines (\`narrate\`, at most about 20 words each), in the text's own voice.
   \`"sync": "before"\` (the default) holds the scene while the line is read; \`"sync": "with"\` lets the next
   actions play while it shows.
4. Add the visual actions that support the move, in order.

## Format

\`\`\`
{
  "title": "…",
  "scenes": [
    { "name": "scene_id",
      "beats": [
        { "name": "short name", "move": "what the narrator does", "viewer_task": {"type": "…", "target": "…"},
          "actions": [ { "op": "…", … }, … ] }
      ] }
  ]
}
\`\`\`

Ids (concept ids, narration ids) start with a letter and use letters, digits, \`_\` or \`-\`. Without an \`id\`,
a concept's id is its text in lower case, with \`_\` in place of spaces and punctuation and none at the ends
(\`"FIRST CAUSE"\` → \`first_cause\`, \`"DUSK?"\` → \`dusk\`). Only the letters a–z count, so give an \`id\`
when the text has other letters (\`"ÅNGEST"\`), starts with a digit, or repeats another concept's text. Ids stay
valid across beats and scenes; an id cannot be used twice. Narration ids default to \`n1\`, \`n2\`, …: leave
them out, or never use that pattern yourself.

## Actions

${actions}

Places: \`{"near": id, "side": "left" | "right" | "above" | "below" | "around"}\`, \`{"between": [id, id]}\`
(ids of concepts or groups) or \`{"region": ${Object.keys(REGIONS).map(r => `"${r}"`).join(' | ')}}\`.
Sizes: ${Object.keys(TEXT_SIZE).map(s => `"${s}"`).join(', ')}. Paces: ${Object.keys(PACE).map(p => `"${p}"`).join(', ')}.
Pauses: ${Object.keys(PAUSE).map(p => `"${p}"`).join(', ')}.
In a plan, a picture's \`src\` is an http(s) URL (the other forms above are paths on the server's machine);
prefer words, figures and boundaries.

## Example

${'```json'}
${JSON.stringify(example, null, 2)}
${'```'}
`;
}
