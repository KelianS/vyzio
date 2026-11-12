# Docs: framing (loaded when you edit `docs/`)

This folder holds the framing documents. Before writing or changing one, apply the **mandated
order** and the **document architecture** of [`WORKFLOW.md`](WORKFLOW.md), and the documentation
rules, whose home is [`rules/docs.md`](rules/docs.md), imported here:

@rules/docs.md

The rules broken most often: the SPECS, the use cases and the SAD state the target, never its
history or its delivery (DOCS-16); a requirement is cited by its ID (DOCS-17) and lives in the SPECS
or one use case (DOCS-19), written to [`uc/TEMPLATE.md`](uc/TEMPLATE.md); the SAD names no class,
file or code layout (DOCS-05); no document copies the code (DOCS-11) or restates an ADR (DOCS-12).
