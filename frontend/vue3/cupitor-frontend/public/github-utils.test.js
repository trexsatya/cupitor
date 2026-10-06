const fs = require('fs')
const path = require('path')

// github-utils.js is a plain script that sets window.GitHubUtils.
beforeAll(() => {
  // eslint-disable-next-line no-eval
  window.eval(fs.readFileSync(path.join(__dirname, 'github-utils.js'), 'utf8'))
  window.GitHubUtils.setGHToken('t')
})

const b64 = s => Buffer.from(s, 'utf8').toString('base64')
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body })

// A fake api.github.com: `routes` maps "METHOD /path" (no query) to a reply
// or a function returning one. Every call is recorded.
function fakeGitHub(routes) {
  const calls = []
  global.fetch = jest.fn(async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${new URL(url).pathname}`
    calls.push(key)
    const r = routes[key]
    if (!r) return reply(404, { message: 'Not Found' })
    return typeof r === 'function' ? r(opts) : r
  })
  return calls
}

const R = '/repos/o/r'
const big = JSON.stringify([{ link: 'a' }, { link: 'b' }])

describe('getFile', () => {
  test('a file the contents API sends without content is read from its blob', async () => {
    fakeGitHub({
      [`GET ${R}/contents/db/index.json`]: reply(200, { content: '', encoding: 'none', size: 1156954, sha: 'S1' }),
      [`GET ${R}/git/blobs/S1`]: reply(200, { content: b64(big), encoding: 'base64' }),
    })
    expect(await window.GitHubUtils.getFile('o', 'r', 'db/index.json', '', 'gh-pages'))
      .toEqual({ content: big, sha: 'S1' })
  })

  test('an empty file stays empty without a second request', async () => {
    const calls = fakeGitHub({ [`GET ${R}/contents/e.txt`]: reply(200, { content: '', size: 0, sha: 'S0' }) })
    expect((await window.GitHubUtils.getFile('o', 'r', 'e.txt')).content).toBe('')
    expect(calls).toHaveLength(1)
  })
})

describe('commitMultipleFiles', () => {
  const head = {
    [`GET ${R}/git/ref/heads/gh-pages`]: reply(200, { object: { sha: 'H' } }),
    [`GET ${R}/git/commits/H`]: reply(200, { tree: { sha: 'T' } }),
  }
  const run = getContent => window.GitHubUtils.commitMultipleFiles({
    owner: 'o', repo: 'r', branch: 'gh-pages', commitMessage: 'm', maxAttempts: 1,
    files: [{ path: 'db/index.json', getContent }],
  })

  test('a file that cannot be read is not rewritten from nothing', async () => {
    const calls = fakeGitHub({ ...head, [`GET ${R}/contents/db/index.json`]: reply(500, { message: 'boom' }) })
    const getContent = jest.fn(() => '[]')
    await expect(run(getContent)).rejects.toThrow(/500/)
    expect(getContent).not.toHaveBeenCalled()
    expect(calls.filter(c => c.startsWith('POST'))).toEqual([])
  })

  test('a file over 1 MB reaches getContent whole', async () => {
    fakeGitHub({
      ...head,
      [`GET ${R}/contents/db/index.json`]: reply(200, { content: '', encoding: 'none', size: 2e6, sha: 'S1' }),
      [`GET ${R}/git/blobs/S1`]: reply(200, { content: b64(big), encoding: 'base64' }),
    })
    const getContent = jest.fn(() => null)   // skip the write; only the read matters here
    await run(getContent).catch(() => {})
    expect(getContent).toHaveBeenCalledWith(big)
  })
})

describe('reads that fail for a reason other than "not found"', () => {
  test('a 404 on the blob of a large file is not taken for a missing file', async () => {
    fakeGitHub({ [`GET ${R}/contents/big.json`]: reply(200, { content: '', size: 2e6, sha: 'S1' }) })
    const err = await window.GitHubUtils.getFile('o', 'r', 'big.json').catch(e => e)
    expect(err.message).toMatch(/blob read failed/)
    expect(err.message).not.toMatch(/GitHub API error 404\b/)
  })

  test('a delete whose lookup fails is an error, not "already gone"', async () => {
    fakeGitHub({ [`GET ${R}/contents/x.srt`]: reply(403, { message: 'rate limit' }) })
    await expect(window.GitHubUtils.deleteFileWithLookup({ owner: 'o', repo: 'r', filePath: 'x.srt', commitMessage: 'm' }))
      .rejects.toThrow(/403/)
  })
})
