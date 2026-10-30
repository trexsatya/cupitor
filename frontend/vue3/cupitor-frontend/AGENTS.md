# Frontend source and publishing ownership

Application fixes belong in this project's public/language/ modules,
public/language.css and public/language.html. Keep source readable; the build
minifies JavaScript and versions assets. Add regressions in this source project.

The matching app files in trexsatya/trexsatya.github.io:gh-pages are generated
outputs and are overwritten on deployment. Port fixes into source rather than
editing only those outputs. Do not replace newer source with a site snapshot.

The active deployment workflow builds master. Check the workflow before
choosing a PR base. Do not silently change deployment branches.

The publishing repository's db/, CNAME and .github/ are protected site-owned
content except for the two generated runtime endpoints db/js/snippet.js and
db/js/frame-boot.js. Their sources and the shared subtitle component belong in
Cupitor; the build packages them and the existing publisher updates these exact
paths so native app URLs stay unchanged. Preserve all other db/ content.
