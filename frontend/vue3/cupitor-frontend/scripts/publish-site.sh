#!/usr/bin/env bash
set -euo pipefail

deploy_dist=$(realpath "${1:?Pass the built dist directory}")
deploy_repo=$(realpath "${2:?Pass the disposable publishing checkout}")
deploy_sha=${3:?Pass the source commit SHA}
deploy_script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)

if [[ ! $deploy_sha =~ ^[a-f0-9]{40}$ ]] || [[ ! -d "$deploy_repo/.git" ]] ||
   [[ $(git -C "$deploy_repo" rev-parse --show-toplevel) != "$deploy_repo" ]]; then
  echo 'Invalid source SHA or publishing checkout' >&2
  exit 1
fi

git -C "$deploy_repo" config user.name 'github-actions[bot]'
git -C "$deploy_repo" config user.email '41898282+github-actions[bot]@users.noreply.github.com'

for deploy_attempt in 1 2 3 4 5; do
  # Reapply only app files onto the latest target commit. A simultaneous
  # vocabulary/recordings edit is retained, even when the first push races it.
  git -C "$deploy_repo" fetch --depth=1 origin gh-pages
  git -C "$deploy_repo" reset --hard FETCH_HEAD
  node "$deploy_script_dir/deploy-site.cjs" "$deploy_dist" "$deploy_repo" "$deploy_sha"
  # The disposable checkout contains only tracked site content and generated
  # output; force includes app assets even if the target gitignore names them.
  git -C "$deploy_repo" add --all --force
  if git -C "$deploy_repo" diff --cached --quiet; then
    echo 'Frontend already deployed.'
    exit 0
  fi
  git -C "$deploy_repo" commit -m "Deploy cupitor ${deploy_sha:0:12}"
  if git -C "$deploy_repo" push origin HEAD:gh-pages; then
    echo 'Frontend pushed to trexsatya.github.io/gh-pages.'
    exit 0
  fi
  echo "Target changed or push failed; retrying ($deploy_attempt/5)." >&2
  sleep "$deploy_attempt"
done

echo 'Deployment failed after five attempts; no force push was used.' >&2
exit 1
