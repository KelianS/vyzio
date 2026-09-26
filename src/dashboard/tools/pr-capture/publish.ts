import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// An orphan branch, so main never carries an image that only served one review (docs/WORKFLOW.md).
const BRANCH = 'pr-screenshots'
const OUT = path.resolve(import.meta.dirname, 'out')

const gh = (args: string[], body?: object): string =>
  execFileSync('gh', ['api', ...args, ...(body ? ['--input', '-'] : [])], {
    encoding: 'utf8',
    input: body ? JSON.stringify(body) : undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

// Only a 404 means absent: an expired login or a dropped network must stop the run, not look like it.
const ghUnlessMissing = (args: string[]): string | undefined => {
  try {
    return gh(args)
  } catch (error) {
    if (String((error as { stderr?: string }).stderr).includes('HTTP 404')) return undefined
    throw error
  }
}

const repo = gh(['repos/{owner}/{repo}', '--jq', '.full_name']).trim()

// A branch with no parent, so it never shares history with the code.
const ensureBranch = () => {
  if (ghUnlessMissing([`repos/${repo}/git/ref/heads/${BRANCH}`])) return
  const readme = 'Screenshots attached to pull requests. Nothing here is part of the product.\n'
  const tree = JSON.parse(
    gh(['-X', 'POST', `repos/${repo}/git/trees`], {
      tree: [{ path: 'README.md', mode: '100644', type: 'blob', content: readme }],
    }),
  ).sha
  const commit = JSON.parse(
    gh(['-X', 'POST', `repos/${repo}/git/commits`], {
      message: 'chore: start the pull request screenshots branch',
      tree,
      parents: [],
    }),
  ).sha
  gh(['-X', 'POST', `repos/${repo}/git/refs`], { ref: `refs/heads/${BRANCH}`, sha: commit })
}

const folder = (
  process.argv[2] ?? execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' })
)
  .trim()
  .replaceAll('/', '-')

const shots = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')) : []
if (shots.length === 0) {
  console.error(`No screenshot in ${OUT}: run \`task pr:capture\` first.`)
  process.exit(1)
}

ensureBranch()
for (const shot of shots.sort()) {
  const target = `${folder}/${encodeURIComponent(shot)}`
  const existing = ghUnlessMissing([
    `repos/${repo}/contents/${target}?ref=${BRANCH}`,
    '--jq',
    '.sha',
  ])
  gh(['-X', 'PUT', `repos/${repo}/contents/${target}`], {
    message: `chore: screenshot ${target}`,
    branch: BRANCH,
    content: fs.readFileSync(path.join(OUT, shot)).toString('base64'),
    ...(existing ? { sha: existing.trim() } : {}),
  })
  // Printed ready to paste into the pull request description.
  console.log(`![${shot}](https://raw.githubusercontent.com/${repo}/${BRANCH}/${target})`)
}
