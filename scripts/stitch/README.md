# Stitch source preparation

The original Google Stitch ZIP exports are private local inputs. They are intentionally excluded from Git by `.project-agent/private/`.

## Required files

Place these six files in one local folder, normally `Downloads`:

- `stitch_costa_clean_crm_system.zip`
- `stitch_costa_clean_crm_system (1).zip`
- `stitch_costa_clean_crm_system (2).zip`
- `stitch_costa_clean_crm_system (3).zip`
- `stitch_costa_clean_crm_system (4).zip`
- `stitch_costa_clean_crm_system (5).zip`

## Prepare the private source folder

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch\prepare-stitch-source.ps1
```

For a different source directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stitch\prepare-stitch-source.ps1 -SourceFolder "D:\StitchExports"
```

The script:

1. requires exactly six matching ZIP files;
2. opens each archive to verify that it contains Stitch evidence;
3. counts `code.html`, `screen.png` and `DESIGN.md` entries;
4. copies the archives to `.project-agent/private/stitch-source/`;
5. creates a local SHA-256 report;
6. never stages or uploads the private packages.

After it succeeds, Codex can continue using:

`docs/STITCH_CODEX_CONTINUATION_PROMPT_20260802.md`
