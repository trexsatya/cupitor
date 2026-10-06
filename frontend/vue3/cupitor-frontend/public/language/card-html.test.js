import { isCardHtml, cardHtml, cardPlainText } from './card-html.js'

describe('isCardHtml', () => {
  test('a known tag makes it HTML', () => {
    expect(isCardHtml('Ett <b>hus</b>')).toBe(true)
    expect(isCardHtml('rad ett<br>rad två')).toBe(true)
    expect(isCardHtml('<ul><li>a</li></ul>')).toBe(true)
  })
  test('text that merely has angle brackets stays plain', () => {
    expect(isCardHtml('a < b and c > d')).toBe(false)
    expect(isCardHtml('I <3 Sverige')).toBe(false)
    expect(isCardHtml('<nope>')).toBe(false)
    expect(isCardHtml('')).toBe(false)
  })
})

describe('cardHtml', () => {
  test('plain text is escaped and keeps its line breaks for the pre-wrap views', () => {
    expect(cardHtml('a < b\nc & d')).toEqual({ html: 'a &lt; b\nc &amp; d', isHtml: false })
  })

  test('inline formatting is kept, line breaks become <br>', () => {
    expect(cardHtml('Ett <b>stort</b>\n<i>hus</i>').html)
      .toBe('Ett <b>stort</b><br><i>hus</i>')
  })

  test('with block tags, line breaks are layout and are not doubled', () => {
    expect(cardHtml('<ul>\n<li>a</li>\n<li>b</li>\n</ul>').html)
      .toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>')
  })

  test('colour, links and images survive; their dangerous parts do not', () => {
    const { html } = cardHtml('<span style="color:#c00">röd</span> <a href="https://x.se/a" onclick="evil()">länk</a> <img src="https://x.se/i.png" onerror="evil()">')
    expect(html).toContain('<span style="color:#c00">röd</span>')
    expect(html).toContain('<a href="https://x.se/a" target="_blank" rel="noopener noreferrer">länk</a>')
    expect(html).toContain('<img src="https://x.se/i.png">')
    expect(html).not.toMatch(/onclick|onerror|evil/)
  })

  test('script, script links and styles that fetch are removed', () => {
    const { html } = cardHtml('<b>ok</b><script>alert(1)</script><a href="javascript:alert(1)">x</a><span style="background:url(https://t.se)">y</span><iframe src="https://t.se"></iframe>')
    expect(html).toBe('<b>ok</b><a>x</a><span>y</span>')
  })

  test('escaped CSS, fixed overlays and app classes are dropped', () => {
    expect(cardHtml('<span style="background:\\75rl(https://t.se)">a</span>').html).toBe('<span>a</span>')
    expect(cardHtml('<div style="position: fixed; inset:0">a</div>').html).toBe('<div>a</div>')
    expect(cardHtml('<b class="practice-close">a</b>').html).toBe('<b>a</b>')
  })

  test('an unknown tag keeps its words', () => {
    expect(cardHtml('<b>a</b> <blink>kvar</blink>').html).toBe('<b>a</b> kvar')
  })
})

describe('cardPlainText', () => {
  test('tags go, entities decode, breaks become new lines', () => {
    expect(cardPlainText('Ett <b>stort</b> hus &amp; trädgård<br>rad två')).toBe('Ett stort hus & trädgård\nrad två')
  })
  test('list items and paragraphs end up on their own lines', () => {
    expect(cardPlainText('<p>ett</p><ul><li>a</li><li>b</li></ul>')).toBe('ett\na\nb')
  })
  test('plain text is returned as it is', () => {
    expect(cardPlainText('a < b\nc')).toBe('a < b\nc')
    expect(cardPlainText(null)).toBe('')
  })
})
