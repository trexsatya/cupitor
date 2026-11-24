#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from './args.js'
import { auditVocabularyCatalog } from './vocabulary-catalog-migration.js'
export { auditVocabularyCatalog } from './vocabulary-catalog-migration.js'
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { flags } = parseArgs(process.argv.slice(2))
  if (!flags.dataDir) { console.error('Usage: node tools/language/vocabulary-catalog.js --dataDir <study-data> --lang sv [--outDir <staging>]'); process.exitCode = 1 }
  else auditVocabularyCatalog(flags).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1 })
}
