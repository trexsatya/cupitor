// Only generated recording parts are disposable. A part first becomes
// eligible seven days after a sync observes it without a live reference.
export const RECORDINGS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const RECORDINGS_SCAN_MS = 24 * 60 * 60 * 1000
const PART = /^recordings\/[a-f0-9]{64}\.json$/
export const isRecordingsPart = path => typeof path === 'string' && PART.test(path)

export function planRecordingsCleanup(previous, activePaths, now, discovered = []) {
  const active = new Set(activePaths)
  const priorParts = new Set((previous.playlists || []).flatMap(entry => entry.parts || []))
  const retired = {}
  const remove = []
  // Invalid timestamps never authorize deletion. Discovery can retire such
  // a file afresh, with the full grace period.
  for (const [path, at] of Object.entries(previous.retiredParts || {})) {
    if (isRecordingsPart(path) && Number.isFinite(at) && at >= 0 && !active.has(path) && !priorParts.has(path)) retired[path] = at
  }
  for (const path of [...priorParts, ...discovered]) {
    if (isRecordingsPart(path) && !active.has(path) && !(path in retired)) retired[path] = now
  }
  for (const [path, at] of Object.entries(retired)) {
    if (now - at >= RECORDINGS_RETENTION_MS) { remove.push(path); delete retired[path] }
  }
  return { retired, remove }
}

// Walk a commit's directory trees instead of the contents-list endpoint
// (which stops at 1,000 entries). A fixed commit SHA keeps the inventory
// coherent. Only this user's generated hashes under the language's
// recordings directory are returned; other files and subdirectories stay.
export async function listRecordingsParts({ request, owner, repo, branch, directory }) {
  const segments = directory.split('/')
  if (segments.some(s => !s || s === '.' || s === '..')) throw new Error('Invalid recordings directory')
  const base = `/repos/${owner}/${repo}`
  const ref = await request('GET', `${base}/git/ref/heads/${branch}`)
  const commit = await request('GET', `${base}/git/commits/${ref.object.sha}`)
  let sha = commit.tree.sha
  const readTree = async () => {
    const tree = await request('GET', `${base}/git/trees/${sha}`)
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete recordings directory listing')
    return tree.tree
  }
  for (const segment of segments) {
    const entry = (await readTree()).find(e => e.path === segment && e.type === 'tree')
    if (!entry) return []
    sha = entry.sha
  }
  return (await readTree()).filter(e => e.type === 'blob' && e.mode === '100644' && isRecordingsPart(`recordings/${e.path}`))
    .map(e => `recordings/${e.path}`)
}
