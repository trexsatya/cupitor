const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { stageSite, STATE } = require('./deploy-site.cjs');
const put = (root, file, contents) => { const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, contents); };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cupitor-deploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = path.join(root, 'dist'), published = path.join(root, 'published');
  fs.mkdirSync(dist); fs.mkdirSync(published);
  put(dist, 'index.html', '<p>new app</p>'); put(dist, 'language.html', '<p>language</p>'); put(dist, 'language/language.js', 'export const version = 1');
  return { root, dist, published };
}

test('overlays app files while preserving db, CNAME, workflows and unrelated site files', t => {
  const { dist, published } = fixture(t);
  for (const file of ['db/recordings.json', 'CNAME', '.github/workflows/other.yml', 'my-page.html']) put(published, file, 'keep');
  put(dist, 'db/recordings.json', 'must not publish'); put(dist, 'CNAME', 'wrong-domain'); put(dist, '.github/workflows/other.yml', 'wrong workflow');
  put(dist, 'language/unit.test.js', 'not needed');
  stageSite(dist, published, 'source-one');
  for (const file of ['db/recordings.json', 'CNAME', '.github/workflows/other.yml', 'my-page.html']) assert.equal(fs.readFileSync(path.join(published, file), 'utf8'), 'keep');
  assert.equal(fs.readFileSync(path.join(published, 'index.html'), 'utf8'), '<p>new app</p>');
  assert(!fs.existsSync(path.join(published, 'language/unit.test.js')));
  assert(fs.existsSync(path.join(published, '.nojekyll')));
});

test('removes only previously managed obsolete assets and keeps unknown old files', t => {
  const { dist, published } = fixture(t);
  put(dist, 'js/old.js', 'old bundle'); put(published, 'js/unmanaged.js', 'keep');
  stageSite(dist, published, 'one');
  fs.unlinkSync(path.join(dist, 'js/old.js')); put(dist, 'js/new.js', 'new bundle');
  stageSite(dist, published, 'two');
  assert(!fs.existsSync(path.join(published, 'js/old.js')));
  assert(fs.existsSync(path.join(published, 'js/unmanaged.js')));
  assert(fs.existsSync(path.join(published, 'js/new.js')));
  const before = fs.readFileSync(path.join(published, STATE), 'utf8');
  stageSite(dist, published, 'two');
  assert.equal(fs.readFileSync(path.join(published, STATE), 'utf8'), before);
});

test('protected files cannot be deleted even if an old deployment manifest names them', t => {
  const { dist, published } = fixture(t);
  put(published, 'db/recordings.json', 'keep'); put(published, 'CNAME', 'keep');
  put(published, STATE, JSON.stringify({ version: 1, files: ['db/recordings.json', 'CNAME'] }));
  stageSite(dist, published);
  assert.equal(fs.readFileSync(path.join(published, 'db/recordings.json'), 'utf8'), 'keep');
  assert.equal(fs.readFileSync(path.join(published, 'CNAME'), 'utf8'), 'keep');
});

test('invalid manifests, incomplete builds and symlinks abort before changing site content', t => {
  const { root, dist, published } = fixture(t);
  put(published, 'index.html', 'keep');
  put(published, STATE, JSON.stringify({ version: 1, files: ['../outside'] }));
  assert.throws(() => stageSite(dist, published), /Invalid previous deployment/);
  fs.unlinkSync(path.join(published, STATE));
  fs.unlinkSync(path.join(dist, 'language.html'));
  assert.throws(() => stageSite(dist, published));
  put(dist, 'language.html', 'new');
  put(root, 'elsewhere/file.js', 'keep');
  fs.symlinkSync(path.join(root, 'elsewhere'), path.join(published, 'language'));
  assert.throws(() => stageSite(dist, published), /Unsafe deployment directory/);
  assert.equal(fs.readFileSync(path.join(published, 'index.html'), 'utf8'), 'keep');
  assert.equal(fs.readFileSync(path.join(root, 'elsewhere/file.js'), 'utf8'), 'keep');
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
test('publisher retries a racing data commit without losing data or force pushing', t => {
  const { root, dist, published } = fixture(t);
  const remote = path.join(root, 'remote.git'), other = path.join(root, 'other');
  git(root, 'init', '--bare', remote);
  git(published, 'init', '-b', 'gh-pages');
  git(published, 'config', 'user.name', 'Fixture'); git(published, 'config', 'user.email', 'fixture@example.invalid');
  put(published, 'db/recordings.json', 'original'); put(published, 'CNAME', 'keep-domain');
  put(published, '.gitignore', 'js/\n'); put(dist, 'js/app.js', 'built app');
  git(published, 'add', '.'); git(published, 'commit', '-m', 'initial'); git(published, 'remote', 'add', 'origin', remote);
  git(published, 'push', '-u', 'origin', 'gh-pages'); git(root, 'clone', '--branch', 'gh-pages', remote, other);
  git(other, 'config', 'user.name', 'Other fixture'); git(other, 'config', 'user.email', 'fixture@example.invalid');
  git(published, 'sparse-checkout', 'set', '--no-cone', '/*', '!/db/');
  assert(!fs.existsSync(path.join(published, 'db/recordings.json')));
  put(other, 'db/recordings.json', 'concurrent data'); git(other, 'add', '.'); git(other, 'commit', '-m', 'concurrent data');
  // The publisher's first push hook races a user's data commit into the remote.
  const hook = '#!/bin/sh\nif [ ! -f "' + root + '/raced" ]; then\n touch "' + root + '/raced"\n git -C "' + other + '" push origin gh-pages\nfi\n';
  put(published, '.git/hooks/pre-push', hook); fs.chmodSync(path.join(published, '.git/hooks/pre-push'), 0o755);
  const output = execFileSync('bash', [path.join(__dirname, 'publish-site.sh'), dist, published, 'a'.repeat(40)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(output, /Frontend pushed/);
  assert.equal(git(root, '--git-dir=' + remote, 'show', 'gh-pages:db/recordings.json'), 'concurrent data');
  assert.equal(git(root, '--git-dir=' + remote, 'show', 'gh-pages:CNAME'), 'keep-domain');
  assert.equal(git(root, '--git-dir=' + remote, 'show', 'gh-pages:index.html'), '<p>new app</p>');
  assert.equal(git(root, '--git-dir=' + remote, 'show', 'gh-pages:js/app.js'), 'built app');
  assert.equal(git(root, '--git-dir=' + remote, 'rev-list', '--count', 'gh-pages'), '3');
});

test('MP3 transcription workflow is generic, uses safe URL arguments and emits SRT', () => {
  const workflows = path.resolve(__dirname, '../../../../.github/workflows');
  const workflowPath = path.join(workflows, 'mp3-to-srt.yml');
  assert(fs.existsSync(workflowPath), 'generic transcription workflow must exist');
  assert(!fs.existsSync(path.join(workflows, 'sveriges-radio-srt.yml')),
    'provider-specific transcription workflow must be replaced');
  const yaml = fs.readFileSync(workflowPath, 'utf8');
  assert.match(yaml, /name: Transcribe MP3 to SRT/);
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /mp3_url:\s*\n\s*description:/);
  assert.match(yaml, /required: true/);
  assert.match(yaml, /TRANSCRIPTION_LANGUAGE:/);
  assert.match(yaml, /default: auto/);
  assert.match(yaml, /curl --fail --location --retry 3/);
  assert.match(yaml, /--proto '=http,https' --proto-redir '=http,https'/);
  assert.match(yaml, /--output output\/audio\.mp3 -- "\$MP3_URL"/);
  assert.match(yaml, /output\/audio\.mp3 -l "\$TRANSCRIPTION_LANGUAGE" -o output\/audio\.srt/);
  assert.match(yaml, /name: mp3-transcription/);
  assert.doesNotMatch(yaml, /sveriges.?radio|api\.sr\.se|avsnitt\/repris|episode_url/i);
});
