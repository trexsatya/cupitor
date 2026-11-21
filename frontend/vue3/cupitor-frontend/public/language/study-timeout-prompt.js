// A native modal dialog keeps the covered study page inert, including iframe
// controls. Capture shortcuts separately: document/window handlers can still
// receive keyboard and native media events while a modal owns the focus.
export function createStudyTimeoutPrompt(doc = document, host = window) {
  let dialog = null
  const blockShortcut = event => {
    if (!dialog) return
    event.stopImmediatePropagation()
    if (event.key === 'Escape' || event.type === 'cupitorMediaKey') event.preventDefault()
  }
  return {
    get blocked() { return dialog !== null },
    show() {
      if (dialog) { dialog.querySelector('button').focus(); return }
      dialog = doc.createElement('dialog')
      dialog.id = 'practiceTimeoutDialog'
      dialog.className = 'study-timeout-prompt'
      dialog.setAttribute('role', 'alertdialog')
      dialog.setAttribute('aria-labelledby', 'practiceTimeoutTitle')
      dialog.setAttribute('aria-describedby', 'practiceTimeoutMessage')
      dialog.setAttribute('closedby', 'none')
      dialog.innerHTML = '<h2 id="practiceTimeoutTitle">Practice session timed out</h2>' +
        '<p id="practiceTimeoutMessage">Practice is paused. Close this message before continuing.</p>' +
        '<button type="button" autofocus>Close</button>'
      dialog.addEventListener('cancel', event => event.preventDefault())
      dialog.querySelector('button').addEventListener('click', () => {
        const current = dialog
        dialog = null
        host.removeEventListener('keydown', blockShortcut, true)
        host.removeEventListener('cupitorMediaKey', blockShortcut, true)
        current.close()
        current.remove()
      })
      host.addEventListener('keydown', blockShortcut, true)
      host.addEventListener('cupitorMediaKey', blockShortcut, true)
      doc.body.append(dialog)
      dialog.showModal()
    },
  }
}
