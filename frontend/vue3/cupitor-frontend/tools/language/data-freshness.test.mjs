import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('srt checks the live upstream before resetting progress or processing hits', t => {
  const dir = mkdtempSync(join(tmpdir(), 'cupitor-data-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  const commit = (cwd, message) =>
    git(cwd, '-c', 'user.name=Tester', '-c', 'user.email=test@example.com', 'commit', '-am', message);
  git(dir, 'init', '--bare', '--initial-branch=gh-pages', 'remote');
  git(dir, 'clone', 'remote', 'publisher');
  const publisher = join(dir, 'publisher');
  const subtitles = 'db/language/swedish/srts';
  mkdirSync(join(publisher, subtitles), { recursive: true });
  writeFileSync(join(publisher, subtitles, 'index.json'), '[]\n');
  git(publisher, 'add', '.');
  commit(publisher, 'Initialize data');
  git(publisher, 'push', '-u', 'origin', 'gh-pages');
  git(dir, 'clone', 'remote', 'local');
  const local = join(dir, 'local');
  const index = join(local, subtitles, 'index.json');
  const out = join(dir, 'out');
  mkdirSync(out);
  const hits = { word: [{ videoId: 'testVideo01', title: 'Clip', channel: 'Channel',
    lines: [{ start: 1, dur: 2, text: 'word' }] }] };
  writeFileSync(join(out, 'filmot-hits.json'), JSON.stringify(hits));
  const progress = join(out, 'srt-progress.json');
  const initialProgress = '{"doneKeys":["existing"]}\n';
  writeFileSync(progress, initialProgress);
  const run = () => spawnSync(process.execPath, [
    fileURLToPath(new URL('./lang-manage.js', import.meta.url)), 'srt',
    '--config', fileURLToPath(new URL('./config.example.json', import.meta.url)),
    '--dataDir', join(local, subtitles, '..'), '--srtsDir', '', '--outDir', out, '--no-translate', '--reset',
  ], { cwd: dir, encoding: 'utf8' });

  writeFileSync(join(publisher, subtitles, 'index.json'), '[ ]\n');
  commit(publisher, 'Update index');
  git(publisher, 'push');
  let result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /missing commits from origin refs\/heads\/gh-pages/);
  assert.equal(readFileSync(progress, 'utf8'), initialProgress);
  assert.equal(readFileSync(index, 'utf8'), '[]\n');

  git(local, 'merge', '--ff-only', 'FETCH_HEAD');
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /srt: 1\/1 done/);
  assert.match(readFileSync(index, 'utf8'), /testVideo01/);

  commit(local, 'Add local subtitle data');
  result = run();
  assert.equal(result.status, 0, result.stderr);

  git(local, 'remote', 'set-url', 'origin', join(dir, 'missing-remote'));
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot verify subtitle data freshness/);
});
