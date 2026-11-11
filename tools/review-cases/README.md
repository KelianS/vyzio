# Review cases

Each case is a change with known findings, run through one agent of `.claude/agents/` or one skill of
`.claude/skills/` on a throwaway worktree of `HEAD`; the run checks that the expected verdict and rule
IDs come out.

- `setup.sh` applies the change, from the worktree root.
- `expect.txt` names the `agent` or the `skill`, optionally the `prompt` it gets (a review of the
  case's commit otherwise), the `verdict` (`BLOCKING` or `PASS`) when it gives one, and any
  `cites: <text>` or `absent: <text>`.

`bash tools/review-cases/run.sh [-n runs] [case...]` calls Claude, so it runs locally (AGENTS-07,
AGENTS-08). In a `prompt`, `{base}` stands for the commit the case is applied on. A skill may edit files
and an agent may not; `gh` is [`shim/gh`](shim/gh), which lets reads through and refuses anything
else. A file the run changed or a GitHub write it attempted fails the case, whatever `expect.txt`
says. Reports land in `results/`, ignored by Git.
