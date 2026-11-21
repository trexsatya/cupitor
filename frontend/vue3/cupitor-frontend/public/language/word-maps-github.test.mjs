import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configure } from './data-source.js'
import { githubWordMapSync } from './word-maps-github.js'
import { emptyMap, readMap } from './word-map-model.js'
import { readWordMaps, splitWordMaps, WORD_MAPS_FORMAT } from './word-maps-store.js'
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
      await opts.files[0].getContent('[]')
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
    await opts.files[0].getContent('[]')
    entered()
    await new Promise(resolve => {release = resolve})
  }, getFile: async () => ({content:'[]'})}
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

const wordMap = id => readMap({...emptyMap(id), id, folder:'Swedish/Ideas'})
function repository(initial) {
  const disk = new Map([['db/language/spanish/word-maps.json', JSON.stringify(initial)]])
  const commits = []
  const github = {
    hasGHToken: () => true,
    getFile: async (owner, repo, path, token, branch) => {
      assert.equal(owner, 'alice'); assert.equal(repo, 'cupitor-data'); assert.equal(branch, 'main')
      if (!disk.has(path)) throw new Error('GitHub API error 404: missing')
      return {content:disk.get(path)}
    },
    commitMultipleFiles: async opts => {
      const changes = await Promise.all(opts.files.map(async file => [file.path,
        file.delete ? null : await file.getContent(disk.get(file.path) ?? null)]))
      for (const [path, text] of changes) text === null ? disk.delete(path) : disk.set(path, text)
      commits.push(opts)
    },
  }
  return {disk, commits, github}
}
function spanishAccount(native = false) {
  globalThis.window = {location:{href:'https://cupitor.test/language.html?lang=spanish'},
    ...(native ? {GitHubProxy:{}} : {})}
  configure(self)
}

test('migration and subsequent edits use atomic per-map files on web and native hosts', async () => {
  for (const native of [false, true]) {
    spanishAccount(native)
    const repo = repository([wordMap('one'), wordMap('two')])
    // Native uses GitHubProxy even when no browser token exists.
    repo.github.hasGHToken = () => !native
    const sync = githubWordMapSync('maps', {github:repo.github, storage:storage()})
    let local = []
    const get = () => local, adopt = maps => {local = maps}
    await sync.pull(get, adopt)
    await sync.push(get, adopt)
    const rootPath = 'db/language/spanish/word-maps.json'
    const root = JSON.parse(repo.disk.get(rootPath))
    assert.equal(root.format, WORD_MAPS_FORMAT)
    assert.equal(root.maps.length, 2)
    assert.equal(repo.commits[0].files.length, 3)
    assert.ok(repo.commits[0].files.every(file => file.path.startsWith('db/language/spanish/')))
    assert.deepEqual(await readWordMaps(root, path => repo.disk.get('db/language/spanish/' + path)), local)
    local = [{...local[0], name:'Edited'}, local[1]]
    await sync.push(get, adopt)
    assert.equal(repo.commits[1].files.length, 2, 'only the edited map and index are written')
    let other = []
    const another = githubWordMapSync('other', {github:repo.github, storage:storage()})
    await another.pull(() => other, maps => {other = maps})
    assert.deepEqual(other, local)
    assert.equal(other[0].folder, 'Swedish/Ideas')
  }
})

test('public manifest reads include each map file without requesting authentication', async () => {
  spanishAccount()
  const {root, files} = await splitWordMaps([wordMap('one'), wordMap('two')])
  const disk = new Map([['word-maps.json', JSON.stringify(root)], ...files])
  const reads = []
  const sync = githubWordMapSync('maps', {storage:storage(),
    github:{hasGHToken:() => false, getFile:() => {throw Error('must not prompt')}},
    fetchFn:async (url, init) => {
      const prefix = 'https://api.github.com/repos/alice/cupitor-data/contents/db/language/spanish/'
      assert.ok(url.startsWith(prefix)); assert.equal(init.cache, 'no-store')
      const path = new URL(url).pathname.split('/spanish/')[1]
      reads.push(path)
      return {ok:disk.has(path), status:disk.has(path) ? 200 : 404, text:async () => disk.get(path)}
    },
  })
  let local
  await sync.pull(() => [], maps => {local = maps})
  assert.deepEqual(local, [wordMap('one'), wordMap('two')])
  assert.deepEqual(new Set(reads), new Set(disk.keys()))
})

test('missing manifest parts never erase maps or advance a sync baseline', async () => {
  spanishAccount(true)
  const repo = repository([wordMap('one')]), localStorage = storage()
  let local = [wordMap('one')]
  const sync = githubWordMapSync('maps', {github:repo.github, storage:localStorage})
  await sync.push(() => local, maps => {local = maps})
  const baseKey = 'maps:base:' + JSON.stringify(['alice','cupitor-data','main','spanish'])
  const before = localStorage.getItem(baseKey)
  for (const path of repo.disk.keys()) if (path.includes('/word-maps/')) repo.disk.delete(path)
  await assert.rejects(sync.pull(() => local, () => {throw Error('must not adopt')}), /Missing word map/)
  assert.deepEqual(local, [wordMap('one')])
  assert.equal(localStorage.getItem(baseKey), before)
  await assert.rejects(sync.push(() => local, () => {throw Error('must not adopt')}), /Missing word map/)
  assert.equal(repo.commits.length, 1)
})
