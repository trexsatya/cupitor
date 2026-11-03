import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configure } from './data-source.js'
import { githubWordMapSync } from './word-maps-github.js'
const storage = () => {
  const data = new Map()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  }
}
const self = {
  login: 'alice',
  repo: 'cupitor-data',
  branch: 'main',
  other: { login: 'bob', repo: 'data', branch: 'main' },
}
test('GitHub adapter writes only self and uses the language path plus existing commit helper', async () => {
  globalThis.window = {
    location: { href: 'https://cupitor.test/language.html?lang=spanish' },
  }
  configure(self)
  let options
  const github = {
    hasGHToken: () => true,
    getFile: async (owner, repo, path, token, branch) => {
      assert.equal(owner, 'alice')
      assert.equal(repo, 'cupitor-data')
      assert.equal(path, 'db/language/spanish/word-maps.json')
      assert.equal(branch, 'main')
      return { content: '[]' }
    },
    commitMultipleFiles: async (opts) => {
      options = opts
      await opts.files[0].getContent(null)
    },
  }
  const sync = githubWordMapSync('local', { github, storage: storage() })
  let maps = []
  await sync.pull(
    () => maps,
    (v) => (maps = v)
  )
  await sync.push(
    () => maps,
    (v) => (maps = v)
  )
  assert.equal(options.owner, 'alice')
  assert.equal(options.repo, 'cupitor-data')
  assert.equal(options.branch, 'main')
  assert.equal(options.files[0].path, 'db/language/spanish/word-maps.json')
})
test('public load does not ask for a token and bypasses the raw CDN cache', async () => {
  globalThis.window = {
    location: { href: 'https://cupitor.test/language.html?lang=swedish' },
  }
  configure(self)
  let called = false
  const github = {
    hasGHToken: () => false,
    getFile: () => {
      throw Error('must not prompt')
    },
  }
  const sync = githubWordMapSync('local', {
    github,
    storage: storage(),
    fetchFn: async (url, init) => {
      called = true
      assert.match(
        url,
        /api.github.com\/repos\/alice\/cupitor-data\/contents\/db\/language\/swedish\/word-maps.json\?ref=main$/
      )
      assert.equal(init.cache, 'no-store')
      return { ok: true, status: 200, text: async () => '[]' }
    },
  })
  await sync.pull(
    () => [],
    () => {}
  )
  assert.equal(called, true)
})
test('native host uses the authenticated proxy; guest cannot sync', async () => {
  globalThis.window = {
    GitHubProxy: {},
    location: { href: 'https://cupitor.test/language.html' },
  }
  configure(self)
  let read = false
  const sync = githubWordMapSync('local', {
    storage: storage(),
    github: {
      hasGHToken: () => false,
      getFile: async () => {
        read = true
        return { content: '[]' }
      },
    },
  })
  await sync.pull(
    () => [],
    () => {}
  )
  assert.equal(read, true)
  configure({ login: null, repo: null, branch: null, other: self.other })
  assert.equal(
    githubWordMapSync('local', { github: {}, storage: storage() }),
    null
  )
})
test('account switches block both reads and writes through an old editor', async () => {
  globalThis.window = {
    location: { href: 'https://cupitor.test/language.html' },
  }
  configure(self)
  const sync = githubWordMapSync('local', { github: {}, storage: storage() })
  configure({ ...self, login: 'charlie' })
  await assert.rejects(
    sync.pull(
      () => [],
      () => {}
    ),
    /changed/
  )
  await assert.rejects(
    sync.push(
      () => [],
      () => {}
    ),
    /changed/
  )
})

test('a 404 means no maps only when the repo branch is accessible', async () => {
  globalThis.window = {
    location: { href: 'https://cupitor.test/language.html' },
  }
  configure(self)
  const options = { github: { hasGHToken: () => false }, storage: storage() }
  const missing = githubWordMapSync('local', {
    ...options,
    fetchFn: async (url) => ({
      ok: url.includes('/git/ref/'),
      status: url.includes('/git/ref/') ? 200 : 404,
    }),
  })
  let adopted
  await missing.pull(
    () => [],
    (next) => (adopted = next)
  )
  assert.deepEqual(adopted, [])
  const inaccessible = githubWordMapSync('local', {
    ...options,
    fetchFn: async () => ({ ok: false, status: 404 }),
  })
  adopted = null
  await assert.rejects(
    inaccessible.pull(
      () => [],
      (next) => (adopted = next)
    ),
    /could not be read/
  )
  assert.equal(adopted, null)
})

test('a delayed response cannot adopt maps after the active language changes', async () => {
  globalThis.window = {location: {href:'https://cupitor.test/language.html?lang=swedish'}}
  configure(self)
  let release, adopted = false
  const github = {hasGHToken: () => true, getFile: () => new Promise(resolve => {release = resolve})}
  const local = storage()
  const sync = githubWordMapSync('swedish-maps', {github, storage:local})
  const pending = sync.pull(() => [], () => {adopted = true})
  window.location.href = 'https://cupitor.test/language.html?lang=spanish'
  release({content:'[]'})
  await assert.rejects(pending, /account or repository changed/i)
  assert.equal(adopted, false)
  assert.equal(local.getItem('swedish-maps'), null)
})

test('account changes during upload cannot mark the old editor synced', async () => {
  globalThis.window = {location: {href:'https://cupitor.test/language.html?lang=swedish'}}
  configure(self)
  let release, entered
  const started = new Promise(resolve => {entered = resolve})
  const github = {hasGHToken: () => true, commitMultipleFiles: async opts => {
    assert.equal(opts.owner, 'alice')
    assert.equal(opts.files[0].path, 'db/language/swedish/word-maps.json')
    await opts.files[0].getContent(null)
    entered()
    await new Promise(resolve => {release = resolve})
  }}
  const local = storage()
  const sync = githubWordMapSync('maps', {github, storage:local})
  let adopted = false
  const pending = sync.push(() => [], () => {adopted = true})
  await started
  configure({...self, login:'charlie'})
  release()
  await assert.rejects(pending, /account or repository changed/i)
  assert.equal(adopted, false)
  configure(null)
})
