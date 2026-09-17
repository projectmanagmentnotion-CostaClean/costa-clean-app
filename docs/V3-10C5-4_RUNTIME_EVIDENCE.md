# V3-10C5.4 — Closings runtime evidence

This is sanitized evidence for the authorized read-only C5.4 replay. It
contains no customer data, credentials, tokens, cookies or private
screenshots.

## Run contract

- URL: `http://127.0.0.1:4178/?v3=1`
- QA namespace: `costaclean-v3`
- Surface: `?v3=1&view=fiscal_closing`
- Browser state: canonical authenticated QA profile, reused; credentials and
  session secrets were not inspected.
- Actions: period surface inspected; no save, export or AI action invoked.

## Structured result

| Viewport | Auth shell | Closing surface | Reload | Back | Overflow | Broken assets | UUID | Unicode icon | Legacy | Touch targets | Console/page/critical errors |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 320x568 | PASS | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px | 0 / 0 / 0 |
| 390x844 | PASS | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px | 0 / 0 / 0 |
| 768x1024 | PASS | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px | 0 / 0 / 0 |
| 1440x900 | PASS | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px | 0 / 0 / 0 |

The final runner result was:

```json
{
  "authenticated": true,
  "productionRequests": [],
  "productionMutations": [],
  "qaMutations": [],
  "consoleErrors": [],
  "pageErrors": [],
  "failedCriticalRequests": [],
  "navigation": { "reload": true, "back": true },
  "allViewportChecksPassed": true
}
```

The temporary runner used to produce this result was removed after the run;
the private screenshots remain ignored and are not part of the commit.
