import { installMobileRichToolbar } from './rich-card-mobile-toolbar.js';

function fixture() {
  const root = document.createElement('div');
  root.id = 'richCardEditor';
  root.innerHTML = '<div class="ck-editor"><div class="ck-editor__top">' +
    '<div class="ck-toolbar"><button>Bold</button><button>Italic</button></div>' +
    '</div><div class="ck-editor__editable">Write a card</div></div>';
  document.body.append(root);
  const toolbar = root.querySelector('.ck-toolbar');
  return { root, toolbar, editor: { ui: { view: { toolbar: { element: toolbar } } } } };
}

afterEach(() => { document.body.innerHTML = ''; });

test('mobile starts collapsed, toggles formatting and leaves editing content alone', () => {
  const {root, toolbar, editor} = fixture();
  const editable = root.querySelector('.ck-editor__editable');
  const controller = installMobileRichToolbar(editor, root, { mobile: true });
  expect(controller).toBeTruthy();
  expect(toolbar.hidden).toBe(true);
  expect(controller.button.getAttribute('aria-expanded')).toBe('false');
  expect(controller.button.getAttribute('aria-controls')).toBe(toolbar.id);
  expect(editable.textContent).toBe('Write a card');
  controller.button.click();
  expect(toolbar.hidden).toBe(false);
  expect(controller.button.getAttribute('aria-expanded')).toBe('true');
  controller.button.click();
  expect(toolbar.hidden).toBe(true);
  expect(editable.textContent).toBe('Write a card');
  controller.dispose();
  expect(toolbar.hidden).toBe(false);
  expect(root.querySelector('.rce-toolbar-toggle')).toBeNull();
});

test('desktop does not hide existing editor controls', () => {
  const {root, toolbar, editor} = fixture();
  expect(installMobileRichToolbar(editor, root, { mobile: false })).toBeNull();
  expect(toolbar.hidden).toBe(false);
  expect(root.querySelector('.rce-toolbar-toggle')).toBeNull();
});
