# Automatic frontend deployment

`.github/workflows/deploy-site.yml` builds and tests the Vue frontend when its
files change on `music-study-app`, then publishes the build to
`trexsatya/trexsatya.github.io`, branch `gh-pages`. Pull requests to that branch
run the same validation and build without publishing or reading deploy secrets.

## Source ownership

Application fixes belong in this frontend's public/ source. Matching files in
trexsatya.github.io/gh-pages are generated and overwritten on the next deploy.
The db/ tree, including db/js/, remains site-owned. See the
[source/deployment audit](source-deployment-audit.md) for recovered fixes and
pending site-only work. The active deployment branch is music-study-app;
master is not the branch this workflow builds.

## One-time credential setup

1. Create a fine-grained GitHub personal access token owned by `trexsatya`.
   Select only the `trexsatya.github.io` repository and grant **Contents: read
   and write**. Choose an appropriate expiration date.
2. In **trexsatya/cupitor → Settings → Secrets and variables → Actions**, add
   a repository secret named **`PAGES_DEPLOY_TOKEN`**, with that token as its value.
3. Keep the target site's GitHub Pages publishing source set to **Deploy from
   a branch → gh-pages → /(root)**. The workflow adds `.nojekyll` to publish the
   built static files directly.
4. Merge the workflow into `music-study-app`. Subsequent matching pushes
   automatically test, build and publish. A missing or expired secret makes
   the job fail visibly; it does not publish an unauthenticated fallback.

The source repository's built-in `GITHUB_TOKEN` cannot write to the other
repository. A PAT also lets the target branch push trigger the existing GitHub
Pages build. No token is embedded in source files or committed to either repo.
The deploy token is used only after tests/build, in publishing-only steps.

## Publishing behavior

- Node 24 builds the existing Vue CLI/webpack project with
  `--openssl-legacy-provider`. Dependencies are installed with `npm ci` using
  the checked-in lockfile; browser binary downloads are disabled.
- Language/GitHub utility tests and publishing tests must pass before building.
- `scripts/deploy-site.cjs` overlays generated files in a disposable checkout.
  `db/`, `CNAME`, `.github/` and unrelated existing site files are preserved.
  No data files are copied from the build. Test scripts are not published.
- `.cupitor-deployed-files.json` records exactly which files the action owns.
  Later deploys remove obsolete owned files, such as old hashed bundles.
  On the first deployment, pre-existing unknown files are retained.
- Deploy jobs are serialized. If another device updates the target branch
  during publishing, `scripts/publish-site.sh` fetches the latest target and
  reapplies the app files before retrying, up to five times. It never force
  pushes and never replaces the target tree with the build directory.
- The target checkout omits `db/` with sparse checkout. Its data remains in
  the git index and is carried forward unchanged in the deployed commit.

Manual dispatch is also declared; GitHub requires the workflow to exist on
the repository's default branch before its manual Run workflow UI is available.
Automatic pushes to `music-study-app` do not depend on that UI.

## Local verification

From `frontend/vue3/cupitor-frontend`:

```sh
npx jest public/language public/github-utils.test.js --runInBand
node --test scripts/deploy-site.test.cjs
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

Publishing tests use disposable local repositories and verify preservation of
recordings/data and CNAME, removal of obsolete owned assets, and a real
non-fast-forward race with a concurrent data commit.

References:
- https://docs.github.com/en/actions/concepts/security/github_token
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
