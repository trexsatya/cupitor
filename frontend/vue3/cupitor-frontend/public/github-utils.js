/**
 * github-utils.js
 * Browser-compatible utility for reading and updating files in a GitHub repository
 * via the GitHub REST API, using the browser's native fetch.
 *
 * Exposes window.GitHubUtils with:
 *   getGHToken()             - Prompt/cache a GitHub PAT in localStorage
 *   getFile(...)             - Fetch file content + current blob SHA
 *   putFile(...)             - Create or update a file (raw)
 *   putFileWithContent(...)  - Write specific content without a prior read
 *   updateFile(...)          - High-level: read → transform → commit
 */
(function (global) {
  const GITHUB_API = "https://api.github.com";

  // Token is kept only in memory for this page session.
  // It is intentionally NOT persisted to localStorage or any other
  // storage to reduce the risk of XSS token theft.
  let _cachedToken = null;

  function getGHToken() {
    if (!_cachedToken) {
      // Skip the prompt when auth is provided out-of-band (e.g. Flutter
      // GitHubProxy injects the token server-side, or a captured-subtitle
      // event flagged that we should not prompt in-page).
      if (typeof GitHubProxy !== 'undefined' || global._suppressGHTokenPrompt) {
        return null;
      }
      const token = prompt("Enter your GitHub personal access token (PAT) with repo scope:");
      if (token) _cachedToken = token.trim();
    }
    return _cachedToken;
  }

  function clearGHToken() {
    _cachedToken = null;
  }

  /** Set the token programmatically (e.g. injected by a native webview). */
  function setGHToken(token) {
    _cachedToken = token ? token.trim() : null;
  }

  function _b64encode(str) {
    // Handles UTF-8 characters (e.g. Swedish ä, ö, å)
    return btoa(unescape(encodeURIComponent(str)));
  }

  function _b64decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }

  async function _githubRequest(method, path, body, token) {
    // If running inside the Flutter webview, route through the GitHubProxy
    // JavaScriptChannel. The token is held in Flutter and injected server-side
    // so it is never present in the JS context.
    if (typeof GitHubProxy !== 'undefined') {
      return _githubRequestViaProxy(method, path, body);
    }

    // Fallback: direct fetch (browser / dev environment). Most callers in
    // language.js pass an empty string for `token` (the Flutter-first
    // convention) and rely on this fallback to pull the cached PAT — which
    // is set via the auto-prompt or GitHubUtils.setGHToken() from DevTools.
    const effectiveToken = token || getGHToken();
    const headers = {
      Authorization: `Bearer ${effectiveToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = await res.json();
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${parsed.message}`);
    }
    return parsed;
  }

  /** Send a GitHub API request through the Flutter JavaScriptChannel proxy. */
  function _githubRequestViaProxy(method, path, body) {
    return new Promise((resolve, reject) => {
      const id = 'gh_' + Math.random().toString(36).slice(2);
      window._ghProxyHandlers = window._ghProxyHandlers || {};
      let settled = false;
      const settle = (fn) => { if (settled) return; settled = true; clearTimeout(t); delete window._ghProxyHandlers[id]; fn(); };
      // Surface the outbound call so a silent-hang can be diagnosed from the
      // in-app Log Viewer (mobile has no DevTools).
      console.log(`[GitHubProxy] → ${id} ${method} ${path}${body ? ' (with body)' : ''}`);
      window._ghProxyHandlers[id] = (statusCode, responseText) => {
        // For write operations (POST/PATCH/PUT/DELETE), include a snippet of
        // the response body so we can diagnose proxies that fake success.
        const isWrite = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
        const bodyHint = isWrite ? ` body=${(responseText || '').slice(0, 200)}` : '';
        console.log(`[GitHubProxy] ← ${id} status=${statusCode} len=${(responseText || '').length}${bodyHint}`);
        let parsed;
        try { parsed = JSON.parse(responseText); } catch (_) { parsed = {}; }
        if (statusCode === 0 || statusCode >= 400) {
          settle(() => reject(new Error(`GitHub API error ${statusCode}: ${parsed.message || responseText}`)));
        } else {
          settle(() => resolve(parsed));
        }
      };
      // Timeout — without this, a proxy that never calls back (e.g. the
      // Flutter side doesn't implement POST/PATCH or drops the message)
      // leaves the Promise pending forever and Push All silently hangs
      // after `[pushCapturedSubtitlesBatched] preparing commit ...`.
      const TIMEOUT_MS = 30000;
      const t = setTimeout(() => {
        console.error(`[GitHubProxy] ✗ ${id} ${method} ${path} timed out after ${TIMEOUT_MS}ms — Flutter side likely doesn't handle this method/path`);
        settle(() => reject(new Error(`GitHubProxy timeout (${TIMEOUT_MS}ms) for ${method} ${path}`)));
      }, TIMEOUT_MS);
      try {
        GitHubProxy.postMessage(JSON.stringify({
          id,
          method,
          path,
          body: body ? JSON.stringify(body) : undefined,
        }));
      } catch (e) {
        console.error(`[GitHubProxy] ✗ ${id} postMessage threw`, e);
        settle(() => reject(e));
      }
    });
  }

  /**
   * Fetches a file from GitHub. Returns { content, sha }.
   */
  async function getFile(owner, repo, filePath, token, branch) {
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const path = `/repos/${owner}/${repo}/contents/${filePath}${query}`;
    const response = await _githubRequest("GET", path, null, token);
    return { content: _b64decode(response.content), sha: response.sha };
  }

  /**
   * Creates or updates a file in a GitHub repository.
   */
  async function putFile(owner, repo, filePath, newContent, message, sha, token, branch) {
    const path = `/repos/${owner}/${repo}/contents/${filePath}`;
    const body = {
      message,
      content: _b64encode(newContent),
      ...(sha && { sha }),
      ...(branch && { branch }),
    };
    return _githubRequest("PUT", path, body, token);
  }

  /**
   * Write specific content directly, fetching the current SHA automatically.
   * @param {object} options
   * @param {string} options.owner
   * @param {string} options.repo
   * @param {string} options.filePath
   * @param {string} options.content      - New UTF-8 content to write
   * @param {string} options.commitMessage
   * @param {string} [options.branch]
   */
  async function putFileWithContent({ owner, repo, filePath, content, commitMessage, branch }) {
    const token = "";getGHToken();
    //if (!token) throw new Error("No GitHub token provided.");

    let sha;
    try {
      const existing = await getFile(owner, repo, filePath, token, branch);
      sha = existing.sha;
    } catch (_) {
      // File does not exist yet — omit sha to create it
    }

    return putFile(owner, repo, filePath, content, commitMessage, sha, token, branch);
  }

  /**
   * Delete a file from a GitHub repository. Needs the file's current sha.
   * Resolves with the API response on success; rejects on error.
   */
  async function deleteFile(owner, repo, filePath, message, sha, token, branch) {
    const path = `/repos/${owner}/${repo}/contents/${filePath}`;
    const body = {
      message,
      ...(sha && { sha }),
      ...(branch && { branch }),
    };
    return _githubRequest("DELETE", path, body, token);
  }

  /**
   * Fetch the file's current sha and DELETE it. Returns null if the file
   * doesn't exist (treated as already-deleted).
   */
  async function deleteFileWithLookup({ owner, repo, filePath, commitMessage, branch }) {
    let sha;
    try {
      const existing = await getFile(owner, repo, filePath, "", branch);
      sha = existing.sha;
    } catch (_) {
      return null; // already gone
    }
    return deleteFile(owner, repo, filePath, commitMessage, sha, "", branch);
  }

  /**
   * Read → transform → commit. No-op if the content is unchanged.
   * @param {object} options
   * @param {string} options.owner
   * @param {string} options.repo
   * @param {string} options.filePath
   * @param {string} options.token
   * @param {string} options.commitMessage
   * @param {(content: string) => string} options.transform
   * @param {string} [options.branch]
   */
  async function updateFile({ owner, repo, filePath, token, commitMessage, transform, branch }) {
    if (!owner || !repo || !filePath || !token || !commitMessage || typeof transform !== "function") {
      throw new Error("Missing required options.");
    }
    const { content, sha } = await getFile(owner, repo, filePath, token, branch);
    const updatedContent = transform(content);
    if (updatedContent === content) return null;
    return putFile(owner, repo, filePath, updatedContent, commitMessage, sha, token, branch);
  }

  /**
   * Commit multiple file changes in a single git commit using the Git Data
   * API (blobs + tree + commit + ref). Each entry's `getContent(current)`
   * receives the file's current text (or null if it doesn't yet exist) and
   * must return the new text. On a 422 (someone pushed between our ref read
   * and ref update), the whole sequence is re-run with fresh current-content
   * so transforms re-apply cleanly.
   *
   * @param {object} options
   * @param {string} options.owner
   * @param {string} options.repo
   * @param {string} options.branch
   * @param {string} options.commitMessage
   * @param {Array<{path: string, getContent: (current: string|null) => Promise<string>|string}>} options.files
   * @param {number} [options.maxAttempts]
   */
  async function commitMultipleFiles({ owner, repo, branch, commitMessage, files, maxAttempts = 5 }) {
    if (!owner || !repo || !branch || !commitMessage || !Array.isArray(files) || !files.length) {
      throw new Error("commitMultipleFiles: missing required options");
    }
    const token = getGHToken();
    let lastErr;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 1. Current HEAD of the branch.
        const ref = await _githubRequest("GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`, null, token);
        const headSha = ref.object.sha;
        const headCommit = await _githubRequest("GET", `/repos/${owner}/${repo}/git/commits/${headSha}`, null, token);
        const baseTreeSha = headCommit.tree.sha;

        // 2. For each file: read current content (in parallel batches),
        //    run the transform, then create a blob (also in parallel).
        //    Entries with `delete: true` produce a `{ path, sha: null }` tree
        //    entry instead, which tells GitHub to drop the file from this tree.
        //    Non-existent files in a delete request are silently skipped so the
        //    tree request doesn't 422 on stale local state.
        //
        //    Sequential per-file getFile was the bottleneck on Push All with
        //    many captures (50+ files × ~300ms each → multi-minute hangs).
        const CONCURRENCY = 6;
        const runInBatches = async (arr, fn) => {
          const out = new Array(arr.length);
          let i = 0;
          const worker = async () => {
            while (true) {
              const idx = i++;
              if (idx >= arr.length) return;
              out[idx] = await fn(arr[idx], idx);
            }
          };
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, arr.length || 1) }, worker));
          return out;
        };

        const fileFetches = await runInBatches(files, async (f) => {
          if (f.delete) {
            try {
              await getFile(owner, repo, f.path, token, branch);
              return { f, action: 'delete' };
            } catch (_) {
              return { f, action: 'skip' };  // already gone
            }
          }
          let currentText = null;
          try {
            const existing = await getFile(owner, repo, f.path, token, branch);
            currentText = existing.content;
          } catch (_) {
            // File doesn't exist yet — getContent will receive null.
          }
          const newText = await f.getContent(currentText);
          if (newText === null || newText === undefined) {
            console.log(`[commitMultipleFiles] skip ${f.path}: getContent returned null/undefined`);
            return { f, action: 'skip' };
          }
          if (newText === currentText) {
            console.log(`[commitMultipleFiles] skip ${f.path}: unchanged`);
            return { f, action: 'skip' };
          }
          return { f, action: 'upsert', newText };
        });

        // Create blobs in parallel for everything that needs upserting.
        const upserts = fileFetches.filter(x => x.action === 'upsert');
        const blobs = await runInBatches(upserts, async (x) => {
          const blob = await _githubRequest("POST", `/repos/${owner}/${repo}/git/blobs`, {
            content: x.newText,
            encoding: "utf-8"
          }, token);
          return { path: x.f.path, sha: blob.sha };
        });

        const treeEntries = [];
        fileFetches.forEach(x => {
          if (x.action === 'delete') {
            treeEntries.push({ path: x.f.path, mode: "100644", type: "blob", sha: null });
          }
        });
        blobs.forEach(b => {
          treeEntries.push({ path: b.path, mode: "100644", type: "blob", sha: b.sha });
        });

        if (!treeEntries.length) {
          console.warn(`[commitMultipleFiles] no tree entries — nothing to commit (all files unchanged or skipped)`);
          return { committed: false, reason: "no-changes" };
        }

        // 3. Create a new tree extending the base.
        const newTree = await _githubRequest("POST", `/repos/${owner}/${repo}/git/trees`, {
          base_tree: baseTreeSha,
          tree: treeEntries
        }, token);

        // 4. Create the commit.
        const newCommit = await _githubRequest("POST", `/repos/${owner}/${repo}/git/commits`, {
          message: commitMessage,
          tree: newTree.sha,
          parents: [headSha]
        }, token);

        // 5. Advance the branch ref. Force is OFF — if someone pushed between
        // step 1 and this PATCH, GitHub returns 422 and we retry the whole
        // sequence so the transforms re-apply on the new content.
        await _githubRequest("PATCH", `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
          sha: newCommit.sha,
          force: false
        }, token);

        // 6. VERIFY the ref actually advanced on GitHub. The Flutter
        //    GitHubProxy was observed returning HTTP 200 / 201 for every
        //    POST/PATCH while the remote ref didn't move — so we can't
        //    trust the proxy's success response alone.
        //
        //    We *bypass* the proxy for this check by calling `fetch` directly
        //    (the proxy is only consulted via `_githubRequest`). The repo is
        //    public, so no auth is needed for a GET on /git/ref. If the
        //    direct fetch also fails (CORS / network), we fall back to the
        //    proxy GET — better than no verification.
        let actualSha;
        let verifySource = 'direct';
        try {
          const url = `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`;
          const res = await fetch(url, {
            cache: 'no-cache',
            headers: { Accept: 'application/vnd.github+json' }
          });
          const json = await res.json();
          if (!res.ok) throw new Error(`direct verify GET status=${res.status}`);
          actualSha = json && json.object && json.object.sha;
        } catch (e) {
          console.warn(`[commitMultipleFiles] direct verify failed (${e.message}); falling back to proxy`);
          verifySource = 'proxy';
          const verifyRef = await _githubRequest("GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`, null, token);
          actualSha = verifyRef && verifyRef.object && verifyRef.object.sha;
        }
        if (actualSha !== newCommit.sha) {
          console.error(
            `[commitMultipleFiles] verification FAILED (via ${verifySource}): expected ref to advance to ${newCommit.sha}, ` +
            `but origin/${branch} is at ${actualSha}. The native proxy returned success but the commit did NOT land on GitHub.`
          );
          throw new Error(
            `Commit not persisted on GitHub: proxy returned success but ref didn't advance ` +
            `(expected ${newCommit.sha && newCommit.sha.slice(0, 8)}, got ${(actualSha || 'unknown').slice(0, 8)}). ` +
            `Native GitHubProxy is likely stubbing write responses — check the app/proxy implementation.`
          );
        }
        console.log(`[commitMultipleFiles] verified (${verifySource}): ${branch} → ${newCommit.sha.slice(0, 8)}`);
        return { committed: true, commitSha: newCommit.sha, files: treeEntries.map(t => t.path) };
      } catch (e) {
        lastErr = e;
        if (attempt < maxAttempts - 1 && /GitHub API error (409|422)\b/.test(String(e && e.message))) {
          console.warn(`commitMultipleFiles: conflict, retrying (${attempt + 2}/${maxAttempts})`);
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error("commitMultipleFiles: exhausted retries");
  }

  global.GitHubUtils = { getGHToken, setGHToken, clearGHToken, getFile, putFile, putFileWithContent, updateFile, deleteFile, deleteFileWithLookup, commitMultipleFiles };

})(window);
