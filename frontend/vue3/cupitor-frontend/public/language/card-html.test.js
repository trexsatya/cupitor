import { isCardHtml, cardHtml, cardPlainText, driveImageUrl } from './card-html.js'

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

  test('text/background colors and both ruler orientations survive sanitizing', () => {
    const source = '<p><span style="color:#d81b60">pink</span> ' +
      '<span style="background-color:#fff59d">yellow</span> │ separator</p><hr>';
    expect(cardHtml(source).html).toBe(source);
    expect(cardPlainText(source)).toContain('pink yellow │ separator');
  });

  test('strikethrough from a manual card round-trips as HTML', () => {
    expect(cardHtml('<p>Det är <s>fel</s> rätt</p>').html)
      .toBe('<p>Det är <s>fel</s> rätt</p>')
    expect(cardPlainText('<p>Det är <s>fel</s> rätt</p>')).toBe('Det är fel rätt')
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

  test('a Google Drive share link shows the picture itself', () => {
    const id = '1AbCdEfGhIjKlMnOp_qr-StUv'
    const direct = `https://lh3.googleusercontent.com/d/${id}`
    ;[`https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/file/u/0/d/${id}/view`,
      `https://drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://docs.google.com/uc?id=${id}`,
    ].forEach(src => expect(cardHtml(`<img src="${src}">`).html).toBe(`<img src="${direct}">`))
    // Links stay as they are: they open Drive, as given.
    expect(cardHtml(`<a href="https://drive.google.com/open?id=${id}">x</a>`).html).toContain(`href="https://drive.google.com/open?id=${id}"`)
    expect(driveImageUrl('https://x.se/i.png')).toBe('https://x.se/i.png')
    expect(driveImageUrl('https://drive.google.com/drive/folders/abc')).toBe('https://drive.google.com/drive/folders/abc')
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
