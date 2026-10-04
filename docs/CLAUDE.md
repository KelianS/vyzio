# Docs: framing (loaded when you edit `docs/`)

This folder holds the framing documents. Before writing or changing one, apply the **mandated
order**, the **document architecture**, the rules of **the SAD** and the **writing discipline** defined
in [`WORKFLOW.md`](WORKFLOW.md), the single home of documentation governance.

Where to write what: an architectural **decision** goes in an ADR under [`adr/`](adr/); the **system
overview** goes in [`SAD.md`](SAD.md), which names ADRs rather than restating them; the **how** of a
component stays in the code and its tests; a camera model's **measurements** go to its sheet under
[`hardware/`](hardware/).

A reminder of the rules broken most often: **a SAD states the target, not the history**, the SAD
names no class, file or code layout, and **no document copies a code constant or restates an ADR**.
Details: WORKFLOW.md.
