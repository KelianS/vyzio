# Review cases

Each case is a change with known findings, reviewed by one agent of `.claude/agents/` on a throwaway
worktree of `HEAD`; the run checks that the expected verdict and rule IDs come out.

- `setup.sh` applies the change, from the worktree root.
- `expect.txt` names the `agent`, optionally the `prompt` it gets (a review of the case's commit
  otherwise), the `verdict` (`BLOCKING` or `PASS`) when it gives one, and any `cites: <text>` or
  `absent: <text>`.

`bash tools/review-cases/run.sh [-n runs] [case...]` calls Claude, so it runs locally (AGENTS-07,
AGENTS-08). In a `prompt`, `{base}` stands for the commit the case is applied on. Reports land in
`results/`, ignored by Git.
