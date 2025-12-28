# Email Extractor Library

Extract email addresses and metadata from Gmail into Google Sheets.

## Quick Start

1. Open Google Sheets -> Extensions -> Apps Script
2. Click the plus icon next to Libraries
3. Paste this ID: `YOUR_SCRIPT_ID_HERE`
4. Select version `4` and click Add
5. Use the library in your script:

```javascript
const extractor = EmailExtractor();

function testExtraction() {
  const filters = {
    maxEmails: 200,
    dateRange: "last30days",
    exportFields: ["from", "to", "name", "subject", "date"],
    emailContains: "@gmail.com",
  };

  const result = extractor.extractEmailsWithFilters(filters);

  if (result.success) {
    console.log(`Extracted ${result.extracted} emails`);
    console.log(`Sheet: ${result.sheetUrl}`);
  } else {
    console.error(result.error);
  }
}
```

## Library Link Format

```
https://script.google.com/macros/library/d/SCRIPT_ID/4
```

- `SCRIPT_ID`: Your library ID
- `4`: Current version number

## Publishing as a Google Apps Script Library

1. Save the final code in your Apps Script project
2. Deploy -> New deployment -> Select type: Library
3. Version: `4`
4. Description: `Email Extractor v1.0 - Extract emails from Gmail to Sheets`
5. Access: Anyone with link
6. Copy the new library ID and version number

## Examples

```javascript
// Example 1: Extract all emails from last 7 days
extractEmailsWithFilters({
  maxEmails: 1000,
  dateRange: "last7days",
  exportFields: ["from", "subject", "date"],
});

// Example 2: Find all PDF invoices
extractEmailsWithFilters({
  maxEmails: 500,
  dateRange: "last30days",
  exportFields: ["from", "name", "subject"],
  attachmentTypes: ["pdf"],
  subjectContains: "invoice",
});
```
