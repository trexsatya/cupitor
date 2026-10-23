import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'));
const {parse} = runtimeRequire('@babel/parser');

const {chromium} = await import(pathToFileURL(process.env.CUPITOR_PLAYWRIGHT).href);
const browser = await chromium.launch({headless: true});
const output = resolve('../test-results/dialog-browser-results', process.env.CUPITOR_TEST_ASSETS || 'public');
await mkdir(output, {recursive: true});
const app = await readFile(new URL('../../public/language/language.js', import.meta.url), 'utf8');
const ast = parse(app, {sourceType: 'module'});
const scrolling = await readFile('language/dialog-scrolling.js', 'utf8');
const extract = name => {
  const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(node, name);
  return app.slice(node.start, node.end);
};
const notificationCode = [
  '_notifSchedules', '_notifLists', '_playlistForNotifKey',
  '_notifScheduleKind', '_notifPopulateSchedules', '_notifSyncIntroAvailability',
  '_notifRawItems', '_notifCallSettings', '_notifLoadCallSettings', '_notifPreviewCalls',
  '_notifRenderEnabled', '_notifBootCapabilities', '_openNotifDialog',
].map(extract).join('\n') + '\nwindow._openNotifDialog = _openNotifDialog;';
const calls = await readFile(new URL('../../public/language/playlist-calls.js', import.meta.url), 'utf8');
const defaultsNode = parse(calls, {sourceType: 'module'}).program.body.find(node =>
  node.type === 'ExportNamedDeclaration' && node.declaration?.declarations?.[0]?.id.name === 'playlistCallDefaults').declaration;
const callDefaults = calls.slice(defaultsNode.start, defaultsNode.end).replace('playlistCallDefaults', '_playlistCallDefaults');
const errors = [];
let lastPage;
try {
  for (const viewport of [{width: 390, height: 700}, {width: 844, height: 390}, {width: 1280, height: 900}]) {
    const context = await browser.newContext({viewport, hasTouch: true});
    const page = lastPage = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.setContent('<!doctype html><html><head></head><body><p>Page content</p></body></html>');
    for (const path of ['vendor/bootstrap.min.css', 'vendor/jquery-ui.min.css', 'language.css']) {
      await page.addStyleTag({path});
    }
    for (const path of ['vendor/jquery.js', 'vendor/jquery-ui.min.js', 'vendor/select2.min.js']) {
      await page.addScriptTag({path});
    }
    await page.addStyleTag({path: 'vendor/select2.min.css'});
    await page.addScriptTag({content: scrolling.replace('export function ', 'function ') +
      '\ninstallDialogScrolling(jQuery);'});
    // The real notification dialog/list renderer; substitute only the native
    // app bridge and data providers, never layout or scrolling.
    const providers = [
      callDefaults,
      "const $ = jQuery, _ = {escape: value => jQuery('<div>').text(value).html()};",
      "window._recordings = Object.fromEntries(Array.from({length: 100}, (_, i) =>",
      "  ['Playlist ' + (i + 1), {notifKey: 'key-' + i, items: {}}]));",
      "window._recording = {currentName: 'Playlist 1'};",
      "window.__cupitorNotifSchedules = {schedules: [",
      "  {key: 'series', name: 'Study series', kind: 'series'},",
      "  {key: 'daily', name: 'Every day', kind: 'recurring'}]};",
      "window.__cupitorNotifLists = {lists: Object.keys(window._recordings).map((name, i) =>",
      "  ({name, external_key: 'key-' + i, source: 'webpage', items: [{id: i}], schedule_key: 'series'}))};",
      "const listRecordings = () => Object.keys(window._recordings), _isVirtual = () => false, _recordingItemCountByName = () => 1;",
      "const _ownerLabeller = () => ({prefix: name => name});",
      "const _webpageNotifLists = data => data.lists.filter(row => row.source === 'webpage' && row.external_key);",
      "const _haveNotifBridge = () => true, notifRpc = async name => name === 'getCapabilities'",
      "  ? {supported: true, permission: 'granted'} : {};",
    ].join('\n');
    await page.addScriptTag({content: providers + '\n' + notificationCode +
      '\nwindow.refreshNotifications=_notifRenderEnabled;window._openNotifDialog();'});
    await page.waitForFunction(() => document.getElementById('notifBody').style.display !== 'none');
    await page.waitForFunction(() => {
      const node = document.getElementById('notifDialog');
      return node.scrollHeight > node.clientHeight && node.clientHeight > 0;
    });
    const metrics = async id => page.evaluate(id => {
      const body = document.getElementById(id), wrapper = body.closest('.ui-dialog');
      const rect = wrapper.getBoundingClientRect(), title = wrapper.querySelector('.ui-dialog-titlebar');
      const footer = wrapper.querySelector('.ui-dialog-buttonpane');
      return {top: rect.top, bottom: rect.bottom, right: rect.right, left: rect.left,
        height: innerHeight, width: innerWidth, overflow: getComputedStyle(body).overflowY,
        scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, scrollTop: body.scrollTop,
        titleVisible: title.getBoundingClientRect().top >= 0,
        footerVisible: !footer || footer.getBoundingClientRect().bottom <= innerHeight};
    }, id);
    const assertBounds = async id => {
      const m = await metrics(id);
      assert.ok(m.top >= 0 && m.bottom <= m.height + 1, JSON.stringify(m));
      assert.ok(m.left >= 0 && m.right <= m.width + 1, JSON.stringify(m));
      assert.equal(m.overflow, 'auto'); assert.equal(m.titleVisible, true);
      assert.equal(m.footerVisible, true);
      return m;
    };
    await assertBounds('notifDialog');
    const rect = await page.locator('#notifDialog').boundingBox();
    const client = await context.newCDPSession(page);
    const point = {x: rect.x + rect.width / 2, y: rect.y + rect.height - 30};
    await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    for (let i = 1; i <= 6; i++) {
      await client.send('Input.dispatchTouchEvent', {type: 'touchMove',
        touchPoints: [{x: point.x, y: point.y - i * (rect.height - 70) / 6}]});
    }
    await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForFunction(() => document.getElementById('notifDialog').scrollTop > 0);
    await page.evaluate(() => {
      const body = document.getElementById('notifDialog'); body.scrollTop = body.scrollHeight;
    });
    await page.locator('.notif-disable').last().click({trial: true});
    await page.screenshot({path: resolve(output, 'study-notifications-' + viewport.width + '.png')});
    await page.setViewportSize({width: viewport.width, height: 320});
    await page.waitForFunction(() => document.querySelector('.ui-dialog').getBoundingClientRect().bottom <= 321);
    await assertBounds('notifDialog');
    await page.evaluate(() => {
      jQuery('#notifDialog').scrollTop(0).find('#notifPlaylist').select2('open');
    });
    await page.locator('.select2-results__option').last().scrollIntoViewIfNeeded();
    await page.locator('.select2-results__option').last().click();
    assert.equal(await page.locator('#notifPlaylist').inputValue(), 'Playlist 100');
    await page.evaluate(() => jQuery('#notifDialog').dialog('close'));
    await page.setViewportSize(viewport);

    for (const id of ['recordingReviewDialog', 'manualEntryEditor', 'practiceLogDialog', 'logViewerDialog']) {
      await page.evaluate(id => {
        const body = jQuery('<div>').attr('id', id).appendTo('body');
        body.html(Array.from({length: 100}, (_, i) => '<p>Dialog row ' + i + '</p>').join(''));
        body.dialog({title: id, width: 650, minHeight: 500, modal: true,
          buttons: [{text: 'Save'}, {text: 'Close', click() {body.dialog('close');}}]});
      }, id);
      await assertBounds(id);
      const m = await metrics(id);
      assert.ok(m.scrollHeight > m.clientHeight, id + ' has scrollable overflow');
      await page.locator('#' + id).hover(); await page.mouse.wheel(0, 600);
      await page.waitForFunction(id => document.getElementById(id).scrollTop > 0, id);
      await page.setViewportSize({width: 500, height: 360});
      await page.waitForFunction(id => {
        const rect = document.getElementById(id).closest('.ui-dialog').getBoundingClientRect();
        return rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
      }, id);
      await assertBounds(id);
      assert.ok((await metrics(id)).scrollTop > 0, 'resize preserves the reading position');
      await page.setViewportSize(viewport);
      await page.waitForFunction(id => {
        const rect = document.getElementById(id).closest('.ui-dialog').getBoundingClientRect();
        return rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
      }, id);
      await page.evaluate(id => {
        jQuery('#' + id).closest('.ui-dialog').hide(); window.dispatchEvent(new Event('resize'));
      }, id);
      await page.setViewportSize({width: 360, height: 320});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#' + id).isVisible(), false, 'resize keeps minimized dialogs hidden');
      await page.evaluate(id => jQuery('#' + id).closest('.ui-dialog').show(), id);
      await assertBounds(id);
      await page.getByRole('button', {name: 'Close', exact: true}).last().click();
      assert.equal(await page.locator('#' + id).isVisible(), false);
      await page.setViewportSize(viewport);
    }
    await page.screenshot({path: resolve(output, 'dialogs-closed-' + viewport.width + '.png')});
    await context.close();
    console.log('PASS native dialog scrolling, touch, footer, Select2 and resizing: ' + JSON.stringify(viewport));
  }
  assert.deepEqual(errors, [], 'no UI errors');
} catch (error) {
  await lastPage?.screenshot({path: resolve(output, 'failure.png'), fullPage: true}).catch(() => {});
  throw error;
} finally {await browser.close();}
