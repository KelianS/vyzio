# Review cases

Each case is a change with known findings, reviewed by one agent of `.claude/agents/` on a throwaway
worktree of `HEAD`; the run checks that the expected verdict and rule IDs come out.

- `setup.sh` applies the change, from the worktree root.
- `expect.txt` names the `agent`, optionally the `prompt` it gets (a review of the case's commit
  otherwise), the `verdict` (`BLOCKING` or `PASS`) when it gives one, and any `cites: <text>` or
  `absent: <text>`.

`bash tools/review-cases/run.sh [-n runs] [case...]` calls Claude, so it runs locally, before merging
a change to an agent, a skill or a rule page. A change to one of them adds or adapts
the case that covers the behaviour it changes. Reports land in `results/`, ignored by Git.
