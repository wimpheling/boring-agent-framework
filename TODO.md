# TODO

## Spec Follow-Ups

- Decide how rewritten `system` and `developer` instructions should be traced. `applyRewriter` currently records the rewritten session, but not instruction changes, so instruction rewrites need an explicit durable trace shape or metadata convention.
- Tighten or document JSON compatibility for custom and built-in entry payloads. Metadata is JSON-typed, but payloads such as tool input/output and stream chunk values can still be arbitrary values.
- Decide whether to add first-class workflow/model-response metadata entries, or keep those as custom entries plus entry metadata.
