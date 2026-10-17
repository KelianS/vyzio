// Checks docs/rules: well-formed and unique IDs, a level line per rule, every page routed, every cited ID defined.
// Usage: node tools/rules/check.mjs (from the repository root, as `task rules:check` runs it)
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const RULES_DIR = 'docs/rules'
const INDEX = path.posix.join(RULES_DIR, 'README.md')
const RULE_HEADING = /^### ([A-Z]+)-(\d{2}) · \S/
const LOOKS_LIKE_RULE = /^#{1,6} [A-Z]+-\d+\b/
const LEVEL_LINE = /^\*\*Level\*\*: (Required|Recommended) · \*\*Verified by\*\*: (Review|Tool: )/
const CITED_EXTENSIONS = new Set(['.md', '.cs', '.ts', '.tsx', '.js', '.mjs', '.json', '.jsonc', '.yml', '.yaml'])

const problems = []
const defined = new Map()

const pages = readdirSync(RULES_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')
const prefixes = pages.map((f) => path.basename(f, '.md').toUpperCase())
const index = readFileSync(INDEX, 'utf8')

for (const page of pages) {
  const file = path.posix.join(RULES_DIR, page)
  const prefix = path.basename(page, '.md').toUpperCase()
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)

  if (!index.includes(`](${page})`)) problems.push(`${file}: not named by the routing of ${INDEX}`)
  if (!lines.some((l) => l.startsWith('> Applies when: '))) problems.push(`${file}: no "> Applies when:" line`)

  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`
    if (!LOOKS_LIKE_RULE.test(line)) return
    const match = RULE_HEADING.exec(line)
    if (!match) return problems.push(`${where}: a rule heading reads "### ${prefix}-NN · <constraint>"`)
    const id = `${match[1]}-${match[2]}`
    if (match[1] !== prefix) problems.push(`${where}: ${id} does not belong to ${page}, whose prefix is ${prefix}`)
    if (defined.has(id)) problems.push(`${where}: ${id} is already defined at ${defined.get(id)}`)
    defined.set(id, where)
    const next = lines.slice(i + 1).find((l) => l.trim() !== '')
    if (!next || !LEVEL_LINE.test(next)) {
      problems.push(`${where}: ${id} lacks "**Level**: Required|Recommended · **Verified by**: Review|Tool: ..."`)
    }
  })

  if (![...defined.keys()].some((id) => id.startsWith(`${prefix}-`))) problems.push(`${file}: holds no rule`)
}

const cited = new RegExp(`\\b(?:${prefixes.join('|')})-\\d{2}\\b`, 'g')
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => CITED_EXTENSIONS.has(path.extname(f)))

for (const file of tracked) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // Listed by git but deleted in the working tree.
  }
  text.split(/\r?\n/).forEach((line, i) => {
    for (const id of line.match(cited) ?? []) {
      if (!defined.has(id)) problems.push(`${file}:${i + 1}: cites ${id}, which no rule page defines`)
    }
  })
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`${defined.size} rules in ${pages.length} pages, every citation resolved`)
