# Docs: framing (loaded when you edit `docs/`)

This folder holds the framing documents. Before writing or changing one, apply the **mandated
order**, the **document architecture** (SAD / ADR / TAD types) and the **writing discipline** defined
in [`WORKFLOW.md`](WORKFLOW.md), the single home of documentation governance.

Where to write what: an architectural **decision** goes in an ADR under [`adr/`](adr/); the
**detailed workings** of a component go in a TAD under [`design/`](design/); **boundaries and the
overall picture** go in [`SAD.md`](SAD.md), which references ADRs and TADs rather than copying them.

A reminder of the rule broken most often: **a SAD states the target, not the history.** What was done
before lives only in the "Options rejected" section of the relevant ADR. Corollaries (no paraphrasing
of the code, exploration history goes to [`investigations/`](investigations/)): see WORKFLOW.md.
