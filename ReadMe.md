# README: Extract "From" Email Addresses from Gmail using Google Apps Script

This script allows you to extract "From" email addresses from your Gmail inbox within a specified date range and save them as text files in your Google Drive. The script filters out duplicate email addresses and allows you to exclude certain domains and keywords.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Configuration](#configuration)
- [Running the Script](#running-the-script)
- [Understanding the Output](#understanding-the-output)
- [Notes and Considerations](#notes-and-considerations)
- [Troubleshooting](#troubleshooting)

## Features

- Extracts "From" email addresses from your Gmail inbox.
- Filters emails based on a specified date range.
- Excludes email addresses based on user-defined domains and keywords.
- Saves the extracted email addresses in batches as text files to Google Drive.
- Avoids duplicates by using a `Set` to store email addresses.

## Prerequisites

- A Google account with access to Gmail and Google Drive.
- Basic familiarity with Google Apps Script.

## Setup Instructions

Follow these steps to set up and use the script:

### 1. Access Google Apps Script

- Open your web browser and go to [Google Apps Script](https://script.google.com/).
- Click on **"New project"** to create a new script.

### 2. Paste the Script

- Copy and paste the following script into the editor:

### 3. Save the Script

- Click on **"Untitled project"** at the top-left corner and give your project a meaningful name, e.g., **"Gmail Email Extractor"**.
- Click **"File"** > **"Save"** or press **Ctrl+S** (Windows) or **Cmd+S** (Mac) to save the script.

## Configuration

Before running the script, you may need to adjust some settings:

### 1. Date Range

- Locate the following lines at the beginning of the `downloadFromEmailAddresses` function:

  ```javascript
  const startDate = "2024/01/01"; // Format: YYYY/MM/DD
  const endDate = "2024/01/02"; // Format: YYYY/MM/DD
  ```

- Modify `startDate` and `endDate` to set the desired date range for extracting emails. Ensure the dates are in **YYYY/MM/DD** format.

### 2. Excluded Domains and Keywords

- Find the exclusion lists within the script:

  ```javascript
  const excludedDomains = ["@example.com", "@spam.com"]; // Modify this list
  const excludedKeywords = ["newsletter", "noreply"]; // Modify this list
  ```

- Update these arrays to include any domains or keywords you want to exclude from the results. For example:

  ```javascript
  const excludedDomains = ["@domain1.com", "@domain2.org"];
  const excludedKeywords = ["unsubscribe", "do-not-reply"];
  ```

### 3. Batch Size (Optional)

- The script saves email addresses in batches to avoid creating overly large files.
- The default `batchSize` is set to **1000**. If you wish to change this, modify the following line:

  ```javascript
  const batchSize = 1000; // Adjust the batch size as needed
  ```

## Running the Script

### 1. Authorize the Script

- Click on the **"Run"** menu and select **"downloadFromEmailAddresses"**.
- The first time you run the script, you'll be prompted to authorize it to access your Gmail and Google Drive.
- Follow the on-screen instructions to grant the necessary permissions.

  > **Note:** You may receive a warning that the app is not verified. Click on **"Advanced"** and then **"Go to Gmail Email Extractor (unsafe)"** to proceed. This is because the script is personal and not published for verification.

### 2. Monitor Execution

- After authorization, the script will start executing.
- Open the **"Logs"** by clicking on **"View"** > **"Logs"** to monitor the progress.
- The logs will display messages indicating the number of threads found and the processing status.

## Understanding the Output

- The script creates a folder named **"FromEmailAddresses"** in your Google Drive if it doesn't already exist.
- Extracted email addresses are saved in text files named **"FromEmailAddresses_Batch_X.txt"**, where **X** is the batch number.
- Each file contains a list of unique email addresses, separated by new lines.

## Notes and Considerations

- **Duplicate Handling:** The script uses a `Set` to store email addresses, ensuring that duplicates are automatically filtered out.
- **Email Address Extraction:** The `extractEmailAddress` function handles email addresses in both formats:

  - **With display name:** `John Doe <john.doe@example.com>`
  - **Without display name:** `jane.doe@example.com`

- **Recipient Check:** The script processes only the emails where you are the recipient (`message.getTo()` includes your email address).
- **Excluded Emails:** Emails from domains or containing keywords specified in the exclusion lists are skipped.
- **Batch Processing:** If you have a large number of emails, the script splits the email addresses into batches to manage memory and performance efficiently.
- **Time Zone:** The date formatting uses `'GMT'` time zone. Adjust if necessary.

## Troubleshooting

- **Script Exceeds Maximum Execution Time:**

  - Google Apps Script has a maximum execution time of **6 minutes** for consumer accounts.
  - If you have a large number of emails, consider narrowing the date range or running the script multiple times with different date ranges.

- **No Emails Found:**

  - Verify that the `startDate` and `endDate` are correct and that you have emails in your inbox during that period.
  - Check the Gmail query in the script to ensure it matches your requirements.

- **Authorization Errors:**

  - Ensure that you're logged into the correct Google account.
  - If you encounter authorization issues, try re-authorizing the script by going to **"Run"** > **"Run function"** > **"downloadFromEmailAddresses"** and following the prompts.

- **Excluded Emails Not Being Filtered:**

  - Make sure the domains and keywords in the exclusion lists are correctly formatted.
  - Domains should include the `@` symbol, e.g., `@domain.com`.
  - Keywords should be in lowercase and match the part of the email address you want to exclude.

## Conclusion

You now have a script that efficiently extracts "From" email addresses from your Gmail inbox within a specified date range. Customize the exclusion lists and batch sizes according to your needs. Remember to handle the extracted data responsibly and in compliance with Google's terms of service and privacy policies.
