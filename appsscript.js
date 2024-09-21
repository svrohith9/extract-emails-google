function downloadFromEmailAddresses() {
  const startDate = "2024/01/01"; // Format: YYYY/MM/DD
  const endDate = "2024/01/02"; // Format: YYYY/MM/DD

  // Build the Gmail query to fetch emails between the specified dates
  const formattedStartDate = Utilities.formatDate(
    new Date(startDate),
    "GMT",
    "yyyy/MM/dd"
  );
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const formattedEndDate = Utilities.formatDate(
    endDateObj,
    "GMT",
    "yyyy/MM/dd"
  );
  const query = `in:inbox after:${formattedStartDate} before:${formattedEndDate}`;

  const threads = GmailApp.search(query);
  const processedEmails = new Set();
  const fromEmailAddresses = new Set();
  const batchSize = 1000;
  let batchNumber = 1;

  // Lists of domains and keywords to exclude
  const excludedDomains = ["@example.com", "@spam.com"]; // Modify this list
  const excludedKeywords = ["newsletter", "noreply"]; // Modify this list

  Logger.log(`Total threads found: ${threads.length}`);

  for (const thread of threads) {
    Logger.log(
      `Processing thread ${threads.indexOf(thread) + 1} of ${threads.length}`
    );
    const messages = thread.getMessages();

    for (const message of messages) {
      const msgId = message.getId();

      // Only process messages where you are the recipient
      if (!message.getTo().includes(Session.getActiveUser().getEmail())) {
        Logger.log(`Skipping email ID ${msgId} as it is not addressed to you.`);
        continue;
      }

      // Skip if this email has already been processed
      if (processedEmails.has(msgId)) {
        Logger.log(`Skipping already processed email ID: ${msgId}`);
        continue;
      }
      processedEmails.add(msgId);

      // Extract 'From' email address
      const fromEmail = extractEmailAddress(message.getFrom());

      // Check if email address should be excluded
      if (shouldExcludeEmail(fromEmail, excludedDomains, excludedKeywords)) {
        Logger.log(`Excluding email address: ${fromEmail}`);
        continue;
      }

      // Add email to the set
      fromEmailAddresses.add(fromEmail);

      // If set size reaches batch size, save to file
      if (fromEmailAddresses.size >= batchSize) {
        saveEmailAddressesToFile(Array.from(fromEmailAddresses), batchNumber);
        fromEmailAddresses.clear();
        batchNumber++;
      }
    }
  }

  // Save any remaining email addresses
  if (fromEmailAddresses.size > 0) {
    saveEmailAddressesToFile(Array.from(fromEmailAddresses), batchNumber);
  }

  Logger.log('All "From" email addresses have been saved to Google Drive.');
}

function shouldExcludeEmail(email, excludedDomains, excludedKeywords) {
  email = email.toLowerCase();

  for (const domain of excludedDomains) {
    if (email.endsWith(domain.toLowerCase())) {
      return true;
    }
  }

  for (const keyword of excludedKeywords) {
    if (email.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

function saveEmailAddressesToFile(emailAddresses, batchNumber) {
  const folderName = "FromEmailAddresses";
  const folder = getOrCreateFolder(folderName);
  const filename = `FromEmailAddresses_Batch_${batchNumber}.txt`;
  const content = emailAddresses.join("\n");
  folder.createFile(filename, content);
  Logger.log(
    `Saved batch ${batchNumber} with ${emailAddresses.length} email addresses.`
  );
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function extractEmailAddress(emailString) {
  const match = emailString.match(/<([^>]+)>/);
  return match
    ? match[1].trim().toLowerCase()
    : emailString.trim().toLowerCase();
}
