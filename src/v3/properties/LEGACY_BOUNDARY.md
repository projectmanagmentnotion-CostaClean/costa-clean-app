# Properties V3 legacy boundary

The V3 Properties runtime must not render or import as an executable V3 path:

- `PropertyCreateFlow`
- `FullscreenStepFlow`
- `DSSmartLocationFields`
- `ClientCreateForm`
- legacy form classes

The V3 entry point is `V3PropertiesPage`. The legacy names may remain in the
non-V3 orchestration branch only; they are not an allowed V3 runtime dependency.
