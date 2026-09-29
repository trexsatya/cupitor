import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serveStatic } from '../page-driver.js';

test('serves files under the root only', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'play-mcp-'));
  fs.mkdirSync(path.join(base, 'public'));
  fs.mkdirSync(path.join(base, 'public-evil'));
  fs.writeFileSync(path.join(base, 'public', 'ok.txt'), 'ok');
  fs.writeFileSync(path.join(base, 'public-evil', 'x.txt'), 'secret');
  const { server, url } = await serveStatic(path.join(base, 'public'));
  try {
    assert.equal(await (await fetch(`${url}/ok.txt`)).text(), 'ok');
    for (const p of ['/..%2fpublic-evil/x.txt', '/%2e%2e%2fpublic-evil/x.txt', '/..%2f..%2fetc/hosts']) {
      assert.equal((await fetch(url + p)).status, 403, p);
    }
  } finally {
    server.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
});
