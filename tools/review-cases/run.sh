#!/usr/bin/env bash
# Runs each review case on a throwaway worktree of HEAD and checks that the expected findings come out.
# Usage: bash tools/review-cases/run.sh [-n runs] [case...]   (calls Claude: local only, never in CI)
set -uo pipefail

root="$(git rev-parse --show-toplevel)"
here="$root/tools/review-cases"
runs=1
while getopts n: opt; do
  case $opt in
    n) runs=$OPTARG ;;
    *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))

if [ $# -gt 0 ]; then cases=("$@"); else
  cases=()
  for expect in "$here"/*/expect.txt; do cases+=("$(basename "$(dirname "$expect")")"); done
fi

out="$here/results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
base="$(git -C "$root" rev-parse HEAD)"

# Applies the case on a detached worktree of HEAD, commits it, and asks the case's agent to review it.
run_one() {
  local case=$1 n=$2 work agent prompt
  work="$(mktemp -d)/repo"
  agent="$(sed -n 's/^agent: //p' "$here/$case/expect.txt" | tr -d '\r')"
  prompt="$(sed -n 's/^prompt: //p' "$here/$case/expect.txt" | tr -d '\r')"
  prompt="${prompt:-review the current branch against base $base; task check was not run}"
  git -C "$root" worktree add --quiet --detach "$work" "$base" >"$out/$case-$n.log" 2>&1
  if (cd "$work" && bash "$here/$case/setup.sh" && git add -A && git commit --quiet --allow-empty -m "test(review): apply the $case review case") >>"$out/$case-$n.log" 2>&1; then
    (cd "$work" && claude -p "Use the $agent agent to $prompt. Print the agent's report verbatim, nothing else." \
      --allowedTools Read Grep Glob Agent WebSearch WebFetch "Bash(git *)" "Bash(gh issue view *)" \
      "Bash(gh issue list *)" "Bash(dotnet list *)" "Bash(pnpm --prefix src/dashboard outdated*)" \
      --disallowedTools Edit Write NotebookEdit) >"$out/$case-$n.md" 2>>"$out/$case-$n.log"
  else
    echo "setup failed" >"$out/$case-$n.md"
  fi
  git -C "$root" worktree remove --force "$work" >>"$out/$case-$n.log" 2>&1
}

# Prints one line per unmet expectation of a report.
check() {
  local report=$1 expect=$2 kind value verdict
  verdict="$(grep -oE '\**Verdict\**: *\**(BLOCKING|PASS)' "$report" | head -1 | grep -oE '(BLOCKING|PASS)$')"
  while IFS=': ' read -r kind value; do
    value="${value%$'\r'}"
    case $kind in
      verdict) [ "$verdict" = "$value" ] || echo "verdict '${verdict:-absent}', expected '$value'" ;;
      cites) grep -qF "$value" "$report" || echo "$value not cited" ;;
      absent) ! grep -qF "$value" "$report" || echo "$value cited, expected absent" ;;
    esac
  done <"$expect"
}

failures=0
for case in "${cases[@]}"; do
  [ -f "$here/$case/expect.txt" ] || { echo "unknown case: $case" >&2; exit 2; }
  passed=0
  for n in $(seq 1 "$runs"); do
    run_one "$case" "$n"
    problems="$(check "$out/$case-$n.md" "$here/$case/expect.txt")"
    if [ -z "$problems" ]; then passed=$((passed + 1)); else
      failures=$((failures + 1))
      echo "FAIL - $case run $n"
      echo "$problems" | sed 's/^/       /'
    fi
  done
  echo "$case: $passed/$runs"
done

echo "Reports: $out"
[ "$failures" -eq 0 ]
