/**
 * @jest-environment jsdom
 */
import { renderAccordions } from './accordion-render.js'

function buildRoot(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => { document.body.innerHTML = '' })

describe('renderAccordions', () => {
  test('alternates even/odd classes', () => {
    const root = buildRoot(`
      <div class="l-accordion"><h4>A</h4></div><p>a-body</p>
      <div class="l-accordion"><h4>B</h4></div><p>b-body</p>
      <div class="l-accordion"><h4>C</h4></div><p>c-body</p>
    `)
    renderAccordions(root)
    const accs = root.getElementsByClassName('l-accordion')
    expect(accs[0].classList.contains('even')).toBe(true)
    expect(accs[1].classList.contains('odd')).toBe(true)
    expect(accs[2].classList.contains('even')).toBe(true)
  })
  test('wraps multi-sibling panels into .autocreated-panel', () => {
    const root = buildRoot(`
      <div class="l-accordion"><h4>A</h4></div>
      <p>line1</p>
      <p>line2</p>
      <p>line3</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    const panel = root.querySelector('.autocreated-panel')
    expect(panel).not.toBeNull()
    expect(panel.querySelectorAll('p').length).toBe(3)
  })
  test('single-sibling panels are NOT wrapped', () => {
    const root = buildRoot(`
      <div class="l-accordion"><h4>A</h4></div>
      <p>only</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    expect(root.querySelector('.autocreated-panel')).toBeNull()
  })
  test('idempotent: calling twice does not re-wrap or re-bind', () => {
    const root = buildRoot(`
      <div class="l-accordion no-result"><h4>A</h4></div>
      <p>p1</p>
      <p>p2</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    renderAccordions(root)
    expect(root.querySelectorAll('.autocreated-panel').length).toBe(1)
    expect(root.querySelector('.l-accordion').getAttribute('accordion-rendered')).toBe('true')
  })
  test('click toggles active class and panel display', () => {
    const root = buildRoot(`
      <div class="l-accordion no-result"><h4>A</h4></div>
      <p>p1</p>
      <p>p2</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    const header = root.querySelector('.l-accordion')
    const panel = root.querySelector('.autocreated-panel')
    expect(header.classList.contains('active')).toBe(false)
    header.click()
    expect(header.classList.contains('active')).toBe(true)
    expect(panel.style.display).toBe('block')
    header.click()
    expect(header.classList.contains('active')).toBe(false)
    expect(panel.style.display).toBe('none')
  })
  test('single-open: opening one collapses the other', () => {
    const root = buildRoot(`
      <div class="l-accordion no-result"><h4>A</h4></div>
      <p>p1</p>
      <p>p2</p>
      <div class="accordion-end"></div>
      <div class="l-accordion no-result"><h4>B</h4></div>
      <p>q1</p>
      <p>q2</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    const headers = root.querySelectorAll('.l-accordion')
    const panels = root.querySelectorAll('.autocreated-panel')
    headers[0].click()
    expect(panels[0].style.display).toBe('block')
    headers[1].click()
    expect(panels[0].style.display).toBe('none')
    expect(panels[1].style.display).toBe('block')
  })
  test('auto-opens the first non-no-result / non-non-srt accordion', () => {
    const root = buildRoot(`
      <div class="l-accordion no-result"><h4>NoRes</h4></div>
      <p>p</p>
      <p>p</p>
      <div class="accordion-end"></div>
      <div class="l-accordion non-srt"><h4>NonSrt</h4></div>
      <p>p</p>
      <p>p</p>
      <div class="accordion-end"></div>
      <div class="l-accordion"><h4>Real</h4></div>
      <p>p</p>
      <p>p</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    const headers = root.querySelectorAll('.l-accordion')
    expect(headers[0].classList.contains('active')).toBe(false)
    expect(headers[1].classList.contains('active')).toBe(false)
    expect(headers[2].classList.contains('active')).toBe(true)
  })
  test('top-aligns td vertical alignment', () => {
    const root = buildRoot(`<table><tr><td>x</td><td>y</td></tr></table>`)
    renderAccordions(root)
    Array.from(root.getElementsByTagName('td')).forEach(td => {
      expect(td.style.verticalAlign).toBe('top')
    })
  })
  test('falls back to .accordion when no .l-accordion present', () => {
    const root = buildRoot(`
      <div class="accordion no-result"><h4>X</h4></div>
      <p>p1</p>
      <p>p2</p>
      <div class="accordion-end"></div>
    `)
    renderAccordions(root)
    expect(root.querySelector('.accordion').getAttribute('accordion-rendered')).toBe('true')
  })
})
