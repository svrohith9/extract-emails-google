// ==================== CONFIGURATION ====================
const CONFIG = {
  BATCH_SIZE: 500,
  MAX_PER_RUN: 2000,
  MAX_TOTAL: 100000,

  ATTACHMENT_TYPES: {
    pdf: "application/pdf",
    zip: ["application/zip", "application/x-zip-compressed"],
    images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    docs: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
};

// ==================== LIBRARY API ====================
function EmailExtractor() {
  return {
    extractEmailsWithFilters: extractEmailsWithFilters,
    parseDateRange: parseDateRange,
    buildSearchQuery: buildSearchQuery,
  };
}

// ==================== MAIN ENTRY POINT ====================
function extractEmailsWithFilters(filters) {
  try {
    const normalized = normalizeFilters(filters || {});
    const emails = fetchEmails(normalized);
    const filtered = applyAdvancedFilters(emails, normalized);
    const sheet = exportToSheets(filtered, normalized);

    return {
      success: true,
      extracted: filtered.length,
      sheetUrl: sheet.getUrl(),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function normalizeFilters(filters) {
  const normalized = Object.assign({}, filters);

  if (!normalized.maxEmails) normalized.maxEmails = 200;
  if (
    !Array.isArray(normalized.exportFields) ||
    normalized.exportFields.length === 0
  ) {
    normalized.exportFields = ["from", "date"];
  }

  if (normalized.deduplicate === undefined) normalized.deduplicate = true;

  if (!normalized.startDate && !normalized.endDate && !normalized.dateRange) {
    normalized.dateRange = "last30days";
  }

  if (normalized.dateRange && (!normalized.startDate || !normalized.endDate)) {
    const range = parseDateRange(normalized.dateRange, normalized);
    if (!normalized.startDate) normalized.startDate = range.startDate || null;
    if (!normalized.endDate) normalized.endDate = range.endDate || null;
  }

  return normalized;
}

// ==================== EMAIL FETCHING ====================
function fetchEmails(filters) {
  const maxEmails = parseInt(filters.maxEmails) || 200;
  const emails = [];

  for (let offset = 0; offset < maxEmails; offset += CONFIG.BATCH_SIZE) {
    const batchSize = Math.min(CONFIG.BATCH_SIZE, maxEmails - offset);
    const threads = GmailApp.search(
      buildSearchQuery(filters),
      offset,
      batchSize
    );

    if (threads.length === 0) break;

    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        if (emails.length >= maxEmails) break;

        const attachments = message.getAttachments();
        emails.push({
          id: message.getId(),
          subject: message.getSubject(),
          from: message.getFrom(),
          to: message.getTo(),
          cc: message.getCc(),
          date: message.getDate(),
          hasAttachments: attachments.length > 0,
          attachments: attachments,
        });
      }
    }
  }

  return emails;
}

function buildSearchQuery(filters) {
  const parts = [];

  if (filters.startDate) parts.push(`after:${filters.startDate}`);
  if (filters.endDate) parts.push(`before:${filters.endDate}`);
  if (filters.hasAttachments === true) parts.push("has:attachment");
  if (filters.emailFolder && filters.emailFolder !== "all") {
    parts.push(`in:${filters.emailFolder}`);
  }
  if (filters.subjectKeyword) parts.push(`subject:"${filters.subjectKeyword}"`);

  return parts.join(" ") || "in:all";
}

function parseDateRange(range, filters) {
  const now = new Date();

  switch (range) {
    case "today":
      return {
        startDate: formatDate(
          new Date(now.getFullYear(), now.getMonth(), now.getDate())
        ),
      };
    case "yesterday":
      return {
        startDate: formatDate(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        ),
        endDate: formatDate(
          new Date(now.getFullYear(), now.getMonth(), now.getDate())
        ),
      };
    case "last7days":
      return { startDate: formatDate(new Date(now.getTime() - 7 * 86400000)) };
    case "last30days":
      return {
        startDate: formatDate(new Date(now.getTime() - 30 * 86400000)),
      };
    case "thismonth":
      return {
        startDate: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      };
    case "lastmonth":
      return {
        startDate: formatDate(
          new Date(now.getFullYear(), now.getMonth() - 1, 1)
        ),
        endDate: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      };
    case "custom":
      return {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
      };
  }

  return { startDate: formatDate(new Date(now.getTime() - 30 * 86400000)) };
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd");
}

// ==================== FILTER ENGINE ====================
function applyAdvancedFilters(emails, filters) {
  let filtered = emails;

  if (filters.emailContains) {
    filtered = filtered.filter((email) =>
      extractEmailsFromString(email.from + email.to + email.cc).some((addr) =>
        addr.includes(filters.emailContains)
      )
    );
  }

  if (filters.nameContains) {
    filtered = filtered.filter((email) =>
      [email.from, email.to, email.cc].some(
        (field) =>
          field &&
          field.toLowerCase().includes(filters.nameContains.toLowerCase())
      )
    );
  }

  if (filters.subjectContains) {
    filtered = filtered.filter((email) =>
      email.subject
        .toLowerCase()
        .includes(filters.subjectContains.toLowerCase())
    );
  }

  if (filters.filenamePattern) {
    filtered = filtered.filter((email) => {
      if (!email.hasAttachments) return false;
      return email.attachments.some((att) =>
        matchFilename(
          att.getName().toLowerCase(),
          filters.filenamePattern.toLowerCase(),
          filters.filenameMatchType
        )
      );
    });
  }

  if (filters.attachmentTypes && filters.attachmentTypes.length > 0) {
    filtered = filtered.filter((email) => {
      if (!email.hasAttachments) return false;
      const types = email.attachments.map((att) =>
        getAttachmentType(att.getContentType())
      );
      return filters.attachmentTypes.some((t) => types.includes(t));
    });
  }

  if (filters.deduplicate) {
    const seen = new Set();
    filtered = filtered.filter((email) => {
      const key = `${email.from}-${email.to}-${email.date.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return filtered;
}

function matchFilename(filename, pattern, matchType) {
  switch (matchType) {
    case "startsWith":
      return filename.startsWith(pattern);
    case "endsWith":
      return filename.endsWith(pattern);
    default:
      return filename.includes(pattern);
  }
}

function getAttachmentType(mimeType) {
  for (const type in CONFIG.ATTACHMENT_TYPES) {
    const types = CONFIG.ATTACHMENT_TYPES[type];
    if (Array.isArray(types) ? types.includes(mimeType) : types === mimeType) {
      return type;
    }
  }
  return "other";
}

// ==================== EXPORT ENGINE ====================
function exportToSheets(emails, filters) {
  const ss = SpreadsheetApp.create(
    `Email Extract - ${new Date().toLocaleDateString()}`
  );
  const sheet = ss.getActiveSheet();

  const headers = buildHeaders(filters.exportFields);
  const rows = emails.map((email) => buildRow(email, filters.exportFields));

  sheet.appendRow(headers);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  return ss;
}

function buildHeaders(fields) {
  const map = {
    from: "From Email",
    to: "To Email",
    cc: "CC Email",
    name: "Names",
    subject: "Subject",
    date: "Date",
    hasAttachments: "Has Attachments",
    attachmentTypes: "Attachment Types",
  };
  return fields.map((f) => map[f]).filter(Boolean);
}

function buildRow(email, fields) {
  const row = [];

  if (fields.includes("from"))
    row.push(extractEmailsFromString(email.from).join(", "));
  if (fields.includes("to"))
    row.push(extractEmailsFromString(email.to).join(", "));
  if (fields.includes("cc"))
    row.push(extractEmailsFromString(email.cc).join(", "));

  if (fields.includes("name")) {
    const names = [email.from, email.to, email.cc]
      .map(parseName)
      .filter(Boolean);
    row.push(Array.from(new Set(names)).join(", "));
  }

  if (fields.includes("subject")) row.push(email.subject);
  if (fields.includes("date"))
    row.push(
      Utilities.formatDate(
        email.date,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm:ss"
      )
    );
  if (fields.includes("hasAttachments"))
    row.push(email.hasAttachments ? "Yes" : "No");
  if (fields.includes("attachmentTypes"))
    row.push(email.attachments.map(getAttachmentType).join(", "));

  return row;
}

function parseName(emailString) {
  if (!emailString) return "";
  const match = emailString.match(
    /^(.*?)<?([\w._%+-]+@[\w.-]+\.[A-Za-z]{2,})>?$/
  );
  return match ? match[1].trim() : "";
}

function extractEmailsFromString(text) {
  if (!text) return [];
  const regex = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
  return Array.from(new Set(text.match(regex) || []));
}

// ==================== UI (GMAIL ADD-ON) ====================
function onHomepage(e) {
  const formInputs = e.formInputs || {};
  const showCustom = formInputs.dateRange && formInputs.dateRange[0] === "custom";

  const card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle("Email Extractor")
        .setSubtitle("Extract up to 100,000 emails")
        .setImageUrl("https://cdn-icons-png.flaticon.com/512/732/732200.png")
    )
    .addSection(createVolumeSection())
    .addSection(createDateSection(showCustom, formInputs))
    .addSection(createEmailFieldsSection())
    .addSection(createExtraColumnsSection())
    .addSection(createFiltersSection())
    .addSection(createActionSection());

  return [card.build()];
}

function createVolumeSection() {
  return CardService.newCardSection()
    .setHeader("How Many?")
    .addWidget(createMaxEmailsDropdown());
}

function createDateSection(showCustom, formInputs) {
  const section = CardService.newCardSection()
    .setHeader("When?")
    .addWidget(
      createDateRangeDropdown(formInputs.dateRange && formInputs.dateRange[0])
    );

  if (showCustom) {
    section.addWidget(createCustomStartDateInput());
    section.addWidget(createCustomEndDateInput());
  }

  section.addWidget(createFolderDropdown());
  return section;
}

function createEmailFieldsSection() {
  return CardService.newCardSection()
    .setHeader("Email Addresses")
    .addWidget(createFromCheckbox())
    .addWidget(createToCheckbox())
    .addWidget(createCcCheckbox());
}

function createExtraColumnsSection() {
  return CardService.newCardSection()
    .setHeader("Include Also")
    .addWidget(createNameCheckbox())
    .addWidget(createSubjectCheckbox())
    .addWidget(createDateCheckbox())
    .addWidget(createAttachmentInfoCheckbox());
}

function createFiltersSection() {
  return CardService.newCardSection()
    .setHeader("Filter By")
    .addWidget(createEmailContainsInput())
    .addWidget(createNameContainsInput())
    .addWidget(createSubjectContainsInput())
    .addWidget(createAttachmentFilters())
    .addWidget(createFilenameMatchTypeDropdown())
    .addWidget(createFilenamePatternInput());
}

function createActionSection() {
  return CardService.newCardSection().addWidget(createExtractButton());
}

function createMaxEmailsDropdown() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Maximum to extract")
    .setFieldName("maxEmails")
    .addItem("50 (Fast)", "50", true)
    .addItem("1,000 (10 min)", "1000", false)
    .addItem("5,000 (1 hour)", "5000", false)
    .addItem("25,000 (5 hours)", "25000", false)
    .addItem("100,000 (overnight)", "100000", false);
}

function createDateRangeDropdown(selected) {
  const value = selected || "last30days";
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Date Range")
    .setFieldName("dateRange")
    .addItem("Last 7 days", "last7days", value === "last7days")
    .addItem("Last 30 days", "last30days", value === "last30days")
    .addItem("This month", "thismonth", value === "thismonth")
    .addItem("Last month", "lastmonth", value === "lastmonth")
    .addItem("Custom range", "custom", value === "custom")
    .setOnChangeAction(CardService.newAction().setFunctionName("onHomepage"));
}

function createCustomStartDateInput() {
  return CardService.newTextInput()
    .setFieldName("customStartDate")
    .setTitle("Start Date (YYYY/MM/DD)")
    .setHint("e.g., 2024/01/15");
}

function createCustomEndDateInput() {
  return CardService.newTextInput()
    .setFieldName("customEndDate")
    .setTitle("End Date (YYYY/MM/DD)")
    .setHint("e.g., 2024/12/31");
}

function createFolderDropdown() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Search In")
    .setFieldName("emailFolder")
    .addItem("All Mail", "all", true)
    .addItem("Inbox", "inbox", false)
    .addItem("Sent", "sent", false)
    .addItem("Drafts", "drafts", false);
}

function createFromCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportFrom")
    .addItem("Sender emails", "from", true);
}

function createToCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportTo")
    .addItem("Recipient emails", "to", false);
}

function createCcCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportCc")
    .addItem("CC emails", "cc", false);
}

function createNameCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportName")
    .addItem("Names", "name", false);
}

function createSubjectCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportSubject")
    .addItem("Subject line", "subject", false);
}

function createDateCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportDate")
    .addItem("Date", "date", true);
}

function createAttachmentInfoCheckbox() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName("exportHasAttachments")
    .addItem("Attachment info", "hasAttachments", false);
}

function createEmailContainsInput() {
  return CardService.newTextInput()
    .setFieldName("emailContains")
    .setTitle("Email contains")
    .setHint("e.g., @gmail.com");
}

function createNameContainsInput() {
  return CardService.newTextInput()
    .setFieldName("nameContains")
    .setTitle("Name contains")
    .setHint("e.g., John");
}

function createSubjectContainsInput() {
  return CardService.newTextInput()
    .setFieldName("subjectContains")
    .setTitle("Subject contains")
    .setHint("e.g., invoice");
}

function createAttachmentFilters() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setTitle("Attachment type")
    .setFieldName("attachmentTypes")
    .addItem("PDF", "pdf", false)
    .addItem("Images", "images", false)
    .addItem("ZIP", "zip", false)
    .addItem("Documents", "docs", false);
}

function createFilenameMatchTypeDropdown() {
  return CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Filename match type")
    .setFieldName("filenameMatchType")
    .addItem("Contains", "contains", true)
    .addItem("Starts with", "startsWith", false)
    .addItem("Ends with", "endsWith", false);
}

function createFilenamePatternInput() {
  return CardService.newTextInput()
    .setFieldName("filenamePattern")
    .setTitle("Filename pattern")
    .setHint("e.g., invoice.pdf");
}

function createExtractButton() {
  return CardService.newTextButton()
    .setText("Extract Emails")
    .setBackgroundColor("#4285F4")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(
      CardService.newAction()
        .setFunctionName("handleExtraction")
        .setParameters({})
    );
}

function handleExtraction(e) {
  const formInputs = e.formInputs;

  let dateFilter = {};
  if (formInputs.dateRange && formInputs.dateRange[0] === "custom") {
    dateFilter = {
      startDate:
        (formInputs.customStartDate && formInputs.customStartDate[0]) || null,
      endDate:
        (formInputs.customEndDate && formInputs.customEndDate[0]) || null,
    };
  } else {
    dateFilter = parseDateRange(
      (formInputs.dateRange && formInputs.dateRange[0]) || "last30days",
      {}
    );
  }

  const exportFields = [];
  if (formInputs.exportFrom && formInputs.exportFrom[0])
    exportFields.push("from");
  if (formInputs.exportTo && formInputs.exportTo[0])
    exportFields.push("to");
  if (formInputs.exportCc && formInputs.exportCc[0])
    exportFields.push("cc");
  if (formInputs.exportName && formInputs.exportName[0])
    exportFields.push("name");
  if (formInputs.exportSubject && formInputs.exportSubject[0])
    exportFields.push("subject");
  if (formInputs.exportDate && formInputs.exportDate[0])
    exportFields.push("date");
  if (formInputs.exportHasAttachments && formInputs.exportHasAttachments[0]) {
    exportFields.push("hasAttachments");
  }

  const filters = {
    maxEmails: parseInt((formInputs.maxEmails && formInputs.maxEmails[0]) || "200"),
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
    emailFolder: (formInputs.emailFolder && formInputs.emailFolder[0]) || "all",
    exportFields: exportFields.length > 0 ? exportFields : ["from", "date"],
    emailContains: (formInputs.emailContains && formInputs.emailContains[0]) || "",
    nameContains: (formInputs.nameContains && formInputs.nameContains[0]) || "",
    subjectContains: (formInputs.subjectContains && formInputs.subjectContains[0]) || "",
    filenamePattern: (formInputs.filenamePattern && formInputs.filenamePattern[0]) || "",
    filenameMatchType:
      (formInputs.filenameMatchType && formInputs.filenameMatchType[0]) || "contains",
    attachmentTypes: formInputs.attachmentTypes || [],
    deduplicate: true,
  };

  const result = extractEmailsWithFilters(filters);

  if (result.success) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Extracted ${result.extracted} emails.`
        )
      )
      .setOpenLink(
        CardService.newOpenLink()
          .setUrl(result.sheetUrl)
          .setOpenAs(CardService.OpenAs.OVERLAY)
      )
      .build();
  }

  const message =
    result.error && result.error.indexOf("time") !== -1
      ? "Too many emails. Try 50-200 max with a shorter date range."
      : `Error: ${result.error}`;

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(message)
        .setType(CardService.NotificationType.ERROR)
    )
    .build();
}
