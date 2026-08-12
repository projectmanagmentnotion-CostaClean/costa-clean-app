# Stitch source preparation

The original Google Stitch ZIP exports are private local inputs. They are intentionally excluded from Git by `.project-agent/private/`.

## Definitive source set

The user confirmed that the definitive source is the following four-package export set:

- `stitch_costa_clean_crm_system.zip`
- `stitch_costa_clean_crm_system (1).zip`
- `stitch_costa_clean_crm_system (2).zip`
- `stitch_costa_clean_crm_system (3).zip`

Do not wait for `(4)` or `(5)`. Those names were part of an earlier incorrect assumption and are not required for the definitive handoff.

The package count alone is not enough. The four packages are accepted only when their combined inventory matches the canonical audit totals:

- 58 `code.html`
- 59 `screen.png`
- 7 `DESIGN.md`

## Prepare the private source folder

Place the four ZIP files in one local folder, normally `Downloads`.

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch\prepare-stitch-source.ps1
```

For a different source directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch\prepare-stitch-source.ps1 -SourceFolder "D:\StitchExports"
```

The script:

1. requires exactly the four definitive ZIP files;
2. opens every archive and verifies Stitch evidence;
3. counts `code.html`, `screen.png` and `DESIGN.md` entries;
4. copies the archives to `.project-agent/private/stitch-source/` when necessary;
5. creates `stitch-source-report.json` locally;
6. verifies the canonical totals `58 / 59 / 5`;
7. never stages or uploads private packages.

The report is generated automatically. It is not a file the user needs to download.

After the script succeeds, Codex can continue using:

`docs/STITCH_CODEX_CONTINUATION_PROMPT_20260802.md`
