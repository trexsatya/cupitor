const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// The native app reads the same registry as the study page. Generate JSON at
// build time so adding a supported language never requires a native release.
async function buildLanguageCatalog(output = path.resolve(__dirname, '../dist/language/language-catalog.json')) {
  const registry = pathToFileURL(path.resolve(__dirname, '../public/language/language-config.js'))
  const { LANGUAGES } = await import(registry.href)
  const catalog = { version: 1, languages: Object.values(LANGUAGES) }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, JSON.stringify(catalog, null, 2) + '\n')
  return catalog
}

if (require.main === module) buildLanguageCatalog().catch(error => {
  console.error(error)
  process.exitCode = 1
})
module.exports = { buildLanguageCatalog }
