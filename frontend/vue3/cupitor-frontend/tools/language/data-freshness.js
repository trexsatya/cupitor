import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

export function verifyDataFreshness(srtsDir) {
  const cwd = realpathSync(srtsDir);
  const git = (...args) => execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();

  let upstream;
  try {
    if (!git('ls-files', '--', '.')) throw new Error('The subtitle directory has no tracked files.');
    if (git('ls-files', '--unmerged', '--', '.')) throw new Error('Resolve subtitle data merge conflicts before running srt.');
    const branch = git('symbolic-ref', 'HEAD');
    const [remote, ref] = git('for-each-ref', '--format=%(upstream:remotename)%09%(upstream:remoteref)', branch).split('\t');
    if (!remote || remote === '.' || !ref) throw new Error('The data branch needs a remote upstream.');
    upstream = `${remote} ${ref}`;
    git('fetch', '--no-tags', '--', remote, ref);
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`Cannot verify subtitle data freshness in ${cwd}: ${detail}`);
  }

  try {
    git('merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD');
  } catch (error) {
    if (error.status === 1 && error.stderr === '') {
      throw new Error(`The local subtitle data checkout is missing commits from ${upstream}. Integrate the upstream changes and rerun srt.`);
    }
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`Cannot verify subtitle data freshness in ${cwd}: ${detail}`);
  }
}
