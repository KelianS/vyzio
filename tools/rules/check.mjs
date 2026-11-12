// Checks docs/rules: well-formed and unique IDs, a level line per rule, every page routed, every cited ID defined.
// Checks the SPECS and its use cases alike: unique requirement and use case IDs, their paths, no section number (DOCS-17).
// Checks the ADRs: numbered from 1 with no gap, each indexed, every cited number defined (DOCS-23, DOCS-25).
// Usage: node tools/rules/check.mjs (from the repository root, as `task rules:check` runs it)
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const RULES_DIR = 'docs/rules'
const INDEX = path.posix.join(RULES_DIR, 'README.md')
const RULE_HEADING = /^### ([A-Z]+)-(\d{2}) · \S/
const LOOKS_LIKE_RULE = /^#{1,6} [A-Z]+-\d+\b/
const LEVEL_LINE = /^\*\*Level\*\*: (Required|Recommended) · \*\*Verified by\*\*: (Review|Tool: )/

const SPECS = 'docs/SPECS.md'
const UC_DIR = 'docs/uc'
const UC_TEMPLATE = 'TEMPLATE.md'
const DOMAIN_ROW = /^\| `([A-Z]+)` \|/
const REQUIREMENT = /^\s*[-|]\s*\*\*([A-Z]+)-(\d{2})\*\*/
const UC_FILE = /^([a-z]+)-(\d{2})-[a-z0-9-]+\.md$/
const UC_TITLE = /^# UC-([A-Z]+)-(\d{2}) · \S/
const PATH_ROW = /^\| ([NAE]\d+) \| ([^|]+?) \|/
const PATH_DETAIL = /^### ([NAE]\d+) · (.+)$/
const ADR_DIR = 'docs/adr'
const ADR_INDEX = path.posix.join(ADR_DIR, 'README.md')
const ADR_FILE = /^(\d{4})-[a-z0-9-]+\.md$/
const ADR_TITLE = /^# ADR-(\d+)\b/
const CITED_ADR = /\bADR-(\d+)\b/g
// A review case describes a hypothetical change, whose ADR does not exist.
const ADR_CITATION_EXEMPT = 'tools/review-cases/'
const SECTION_SIGN = /§ ?\d/
// A section number after the word SPECS, on its line or the next comment line, as in "2.3" or "§9".
const SPECS_SECTION =
  /SPECS(?:\.md)?`?(?:\]\([^)\n]*\))?\)?[ \t]*(?:\r?\n[ \t]*(?:\/\/\/?|\*|#)?[ \t]*)?(?:§[ \t]?\d+(?:\.\d+)*|\d+\.\d+|\d+(?=[),;]))/g

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

const specsLines = readFileSync(SPECS, 'utf8').split(/\r?\n/)
const domains = specsLines.map((l) => DOMAIN_ROW.exec(l)?.[1]).filter(Boolean)
for (const domain of domains) {
  if (prefixes.includes(domain)) problems.push(`${SPECS}: domain ${domain} is also the prefix of a rule page`)
}

const useCases = new Map()
const productFiles = [SPECS]
for (const file of readdirSync(UC_DIR).filter((f) => f.endsWith('.md') && f !== UC_TEMPLATE)) {
  const where = path.posix.join(UC_DIR, file)
  productFiles.push(where)
  const lines = readFileSync(where, 'utf8').split(/\r?\n/)
  const name = UC_FILE.exec(file)
  const title = UC_TITLE.exec(lines[0] ?? '')
  if (!name || !title) {
    problems.push(`${where}: a use case is named <domain>-<nn>-<slug>.md and titled "# UC-<DOMAIN>-<NN> · <goal>"`)
    continue
  }
  const id = `UC-${title[1]}-${title[2]}`
  if (name[1].toUpperCase() !== title[1] || name[2] !== title[2]) problems.push(`${where}: its name does not match ${id}`)
  if (!domains.includes(title[1])) problems.push(`${where}: ${title[1]} is not a domain of ${SPECS}`)
  if (useCases.has(id)) problems.push(`${where}: ${id} is already defined at ${useCases.get(id).where}`)
  if (!specsLines.some((l) => l.includes(`](uc/${file})`))) problems.push(`${where}: missing from the index of ${SPECS}`)

  const table = new Map(lines.map((l) => PATH_ROW.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]))
  const details = new Map(lines.map((l) => PATH_DETAIL.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]))
  if (!table.has('N1') || [...table.keys()].some((p) => p.startsWith('N') && p !== 'N1')) {
    problems.push(`${where}: a use case has one nominal path, N1`)
  }
  for (const [p, label] of table) {
    if (details.get(p) !== label) problems.push(`${where}: path ${p} "${label}" has no detail under the same label`)
  }
  for (const p of details.keys()) if (!table.has(p)) problems.push(`${where}: detail ${p} is missing from the paths table`)
  useCases.set(id, { where, paths: new Set(table.keys()) })
}

const adrIndex = readFileSync(ADR_INDEX, 'utf8')
const adrs = new Set()
for (const file of readdirSync(ADR_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'TEMPLATE.md')) {
  const where = path.posix.join(ADR_DIR, file)
  const name = ADR_FILE.exec(file)
  const title = ADR_TITLE.exec(readFileSync(where, 'utf8').split(/\r?\n/)[0] ?? '')
  if (!name || !title) {
    problems.push(`${where}: an ADR is named <NNNN>-<slug>.md and titled "# ADR-<NN>: <decision>"`)
    continue
  }
  const number = Number(name[1])
  if (adrs.has(number)) problems.push(`${where}: ADR-${number} is already held by another file (DOCS-23)`)
  if (Number(title[1]) !== number) problems.push(`${where}: its title does not carry ADR-${number}`)
  if (!adrIndex.includes(`](${file})`)) problems.push(`${where}: missing from the index of ${ADR_INDEX} (DOCS-25)`)
  adrs.add(number)
}
for (let n = 1; n <= adrs.size; n++) {
  if (!adrs.has(n)) problems.push(`${ADR_DIR}: ADR-${String(n).padStart(2, '0')} is missing, the numbering has a gap (DOCS-23)`)
}

const requirements = new Map()
for (const file of productFiles) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const where = `${file}:${i + 1}`
      if (SECTION_SIGN.test(line)) problems.push(`${where}: a section number; cite the requirement's ID (DOCS-17)`)
      const match = REQUIREMENT.exec(line)
      if (!match) return
      const id = `${match[1]}-${match[2]}`
      if (!domains.includes(match[1])) problems.push(`${where}: ${id} belongs to no domain of ${SPECS}`)
      if (requirements.has(id)) problems.push(`${where}: ${id} is already defined at ${requirements.get(id)}`)
      requirements.set(id, where)
    })
}

const cited = new RegExp(`\\b(?:${prefixes.join('|')})-\\d{2}\\b`, 'g')
// A use case ID holds a requirement-like part (UC-CAM-01), checked as a use case instead.
const citedRequirement = new RegExp(`(?<!UC-)\\b(?:${domains.join('|')})-\\d{2}\\b`, 'g')
const citedUseCase = /\bUC-([A-Z]+)-(\d{2})\b(?: ([NAE]\d+)\b)?/g
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

for (const file of tracked) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // Listed by git but deleted in the working tree.
  }
  if (text.includes('\0')) continue // Binary.
  text.split(/\r?\n/).forEach((line, i) => {
    const where = `${file}:${i + 1}`
    if (!file.startsWith(ADR_CITATION_EXEMPT)) {
      for (const [id, number] of line.matchAll(CITED_ADR)) {
        if (!adrs.has(Number(number))) problems.push(`${where}: cites ${id}, which no ADR defines (DOCS-25)`)
      }
    }
    for (const id of line.match(cited) ?? []) {
      if (!defined.has(id)) problems.push(`${where}: cites ${id}, which no rule page defines`)
    }
    for (const id of line.match(citedRequirement) ?? []) {
      const home = requirements.get(id)?.split(':')[0]
      if (!home) problems.push(`${where}: cites ${id}, which neither ${SPECS} nor a use case defines`)
      else if (home !== SPECS && home !== file && productFiles.includes(file)) {
        problems.push(`${where}: cites ${id}, local to ${home}; a rule cited beyond its use case lives in ${SPECS} (DOCS-19)`)
      }
    }
    for (const [, domain, number, step] of line.matchAll(citedUseCase)) {
      const useCase = useCases.get(`UC-${domain}-${number}`)
      if (!useCase) problems.push(`${where}: cites UC-${domain}-${number}, which no use case defines`)
      else if (step && !useCase.paths.has(step)) problems.push(`${where}: cites UC-${domain}-${number} ${step}, a path it lacks`)
    }
  })
  for (const match of text.matchAll(SPECS_SECTION)) {
    const line = text.slice(0, match.index).split('\n').length
    problems.push(`${file}:${line}: cites the SPECS by section number; cite the requirement's ID (DOCS-17)`)
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(
  `${defined.size} rules in ${pages.length} pages, ${requirements.size} requirements, ${useCases.size} use cases, ${adrs.size} ADRs, every citation resolved`,
)
