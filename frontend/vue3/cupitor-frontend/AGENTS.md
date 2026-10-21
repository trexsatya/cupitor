# Frontend source and publishing ownership

Application fixes belong in this project's public/language/ modules,
public/language.css and public/language.html. Keep source readable; the build
minifies JavaScript and versions assets. Add regressions in this source project.

The matching app files in trexsatya/trexsatya.github.io:gh-pages are generated
outputs and are overwritten on deployment. Port fixes into source rather than
editing only those outputs. Do not replace newer source with a site snapshot.

The active deployment workflow builds music-study-app. Check the workflow
before choosing a PR base; master is older. Do not silently change deployment
branches.

The publishing repository's db/ (including db/js/), CNAME and .github/ are
protected site-owned content. Data and capture-script changes may correctly
belong there. Preserve them and follow the user's requested scope.
