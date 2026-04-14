# Historical Google Form Imports

Place exported Google Forms / Google Sheets CSV files in this folder for local imports.

Run a dry run before writing anything:

```powershell
npm run import:google-form-history -- --file="api/tools/imports/google-form-history.csv" --dry-run
```

Run the import:

```powershell
npm run import:google-form-history -- --file="api/tools/imports/google-form-history.csv"
```

CSV files in this folder are ignored by Git so client data is not committed.
