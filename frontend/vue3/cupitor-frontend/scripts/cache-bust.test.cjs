const { test } = require('node:test')
const assert = require('node:assert/strict')
const { bustImports, bustHtmlAssets } = require('./cache-bust.js')

test('a deploy changes the entry module and stylesheet URLs as well as child imports', () => {
  const html = '<script type="module" src="/language/language.js"></script><link href="/language.css" rel="stylesheet">'
  const exists = asset => ['language/language.js', 'language.css'].includes(asset)
  const first = bustHtmlAssets(html, 'one', 'language.html', exists)
  const second = bustHtmlAssets(html, 'two', 'language.html', exists)
  assert.match(first, /src="\/language\/language.js\?v=one"/)
  assert.match(second, /src="\/language\/language.js\?v=two"/)
  assert.match(second, /href="\/language.css\?v=two"/)
  assert.equal(bustImports('import x from "./practice-video.js"', 'two'), 'import x from "./practice-video.js?v=two"')
})

test('entry URLs preserve local queries and resolve relative paths without modifying external or vendor assets', () => {
  const html = '<script src="../language.js?lang=sv&v=old"></script><link rel="stylesheet" href="./card.css">' +
    '<script src="/vendor/jquery.js"></script><script src="/js/app.hash.js"></script>' +
    '<script src="https://youtube.com/iframe_api"></script><script src="//example.com/a.js"></script>' +
    '<script src="./missing.js"></script><link rel="icon" href="/icon.css">'
  const out = bustHtmlAssets(html, 'new', 'language/card.html', asset => !asset.endsWith('missing.js'))
  assert.match(out, /src="..\/language.js\?lang=sv&v=new"/)
  assert.match(out, /href=".\/card.css\?v=new"/)
  assert(out.endsWith(html.slice(html.indexOf('<script src="/vendor'))))
  assert.equal(bustHtmlAssets(out, 'new', 'language/card.html', () => true).includes('v=new&v='), false)
})
