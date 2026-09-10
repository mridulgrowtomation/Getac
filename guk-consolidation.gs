// ========================================
// GUK CONSOLIDATION - CONFIGURATION
// ========================================

// ---------- Execution ----------

const GUK_DRY_RUN = false;

// ---------- Mapping / Source Configuration ----------

const GUK_MAPPING_SHEET_ID = "1afWzwlqEus7z7DuVxUgJS0EfWW9KlsZU";
const GUK_MAPPING_TAB_NAME = "BD and Reseller List";

// Columns in the mapping/configuration sheet
const GUK_MAPPING_HEADERS = {
  RESELLER_NAME: "Reseller Name",
  FIRST_NAME: "First Name",
  LAST_NAME: "Last Name",
  ROLE: "Role",
  COUNTRY: "Country",
  EMAIL: "Email ID",
  SHEET_LINK: "Google Sheet Link"
};


// ---------- GUK Target Folder ----------

const GUK_FOLDER_ID = "18oybI5q55HETXtFaChDXgX1ujUtyXbyP";


// ---------- Output Sheet Names ----------

const GUK_BD_CONSOLIDATION_NAME = "GUK BD Consolidation Sheet";

const GUK_RESELLER_CONSOLIDATION_NAME =
  "GUK Reseller Consolidation Sheet";

const GUK_CONSOLIDATION_NAME =
  "GUK Consolidation Sheet";

// ---------- Source / Destination Tabs ----------

const GUK_SOURCE_TAB = "Leads Data";
const GUK_DEST_TAB = "leads_data";


// ---------- Reseller Folder ----------

const GUK_RESELLER_FOLDER_NAME = "Resellers";

// ---------- Dropdown Configuration ----------

const GUK_DROPDOWN_HEADERS = [
  "lead status",
  "contact source",
  "Lead Qualification GUK",
  "3rd Party Data Consent",
  "Reseller Name",
  "Reseller Email",
  "Product Model"
];

const GUK_DROPDOWN_MIN_ROWS = 500;


// ---------- Contact Source / Deduplication ----------

const GUK_RECORD_ID_HEADER = "Record ID";

const GUK_CONTACT_SOURCE_HEADER = "Contact Source";

const GUK_ONLINE_SOURCE = "Online/Campaigns";
const GUK_OFFLINE_SOURCE = "Offline/Events";


// ---------- Date Configuration ----------

const GUK_DATE_HEADERS = [
  "last updated",
  "timestamp",
  "acknowledgement date",
  "acknowledgment date",
  "reseller acknowledgement date",
  "reseller acknowledgment date",
  "lead assignment date",
  "create date"
];

const GUK_DATE_FORMAT = "dd/mm/yyyy";


// ---------- Consolidated Sheet Prefix ----------

const GUK_CONSOLIDATED_PREFIX = "Consolidated - ";

// ---------- Consolidated Sheet for Reseller & Getac Regex ----------

const GETAC_EMAIL_REGEX = /@getac(?:\.[a-z]{2,})+$/i;


// ---------- CANONICAL_HEADERS ----------
const GUK_BD_HEADERS = [
  "Record ID",
  "Create Date",
  "Lead Assignment Date",
  "Acknowledgement Date",
  "First Name",
  "Last Name",
  "Company Name",
  "Email",
  "Country",
  "Industry",
  "Job Title",
  "Customer Comment",
  "Telephone Number",
  "Event Name",
  "Getac Sales",
  "Getac Sales Comments",
  "Lead Qualification GUK",
  "Reseller Name",
  "Reseller Email",
  "Lead Status",
  "# of units",
  "Product Model",
  "3rd Party Data Consent",
  "SQL",
  "Contact Source",
  "Last Updated"
];

const GUK_RESELLER_INDIVIDUAL_HEADERS = [
  "Record Id",
  "Create Date",
  "Lead Assignment Date",
  "Acknowledgement Date",
  "First Name",
  "Last Name",
  "Company Name",
  "Email",
  "Country",
  "Industry",
  "Job Title",
  "Customer Comment",
  "Telephone Number",
  "Event Name",
  "Lead Qualification GUK",
  "Reseller Name",
  "Reseller Email",
  "Reseller Comments",
  "Lead Status",
  "# of units",
  "Product Model",
  "3rd Party Data Consent",
  "SQL",
  "Contact Source",
  "Last Updated"
];

const GUK_RESELLER_COMPANY_HEADERS = [
  "Record Id",
  "Create Date",
  "Lead Assignment Date",
  "Acknowledgement Date",
  "First Name",
  "Last Name",
  "Company Name",
  "Email",
  "Country",
  "Industry",
  "Job Title",
  "Customer Comment",
  "Telephone Number",
  "Event Name",
  "Lead Qualification GUK",
  "Reseller Name",
  "Reseller Email",
  "Reseller Comments",
  "Lead Status",
  "# of units",
  "Product Model",
  "3rd Party Data Consent",
  "SQL",
  "Contact Source",
  "Last Updated"
];

const GUK_COUNTRY_CONSOLIDATION_HEADERS = [
  "Record ID",
  "Create Date",
  "Lead Assignment Date",
  "Acknowledgement Date",
  "First Name",
  "Last Name",
  "Company Name",
  "Email",
  "Country",
  "Industry",
  "Job Title",
  "Customer Comment",
  "Telephone Number",
  "Event Name",
  "Getac Sales",
  "Getac Sales Comments",
  "Lead Qualification GUK",
  "Reseller Name",
  "Reseller Email",
  "Reseller Comments",
  "Lead Status",
  "# of units",
  "Product Model",
  "3rd Party Data Consent",
  "SQL",
  "Contact Source",
  "Last Updated"
];

const GUK_ALL_HEADERS = [
  ...new Set([
    ...GUK_BD_HEADERS,
    ...GUK_RESELLER_INDIVIDUAL_HEADERS,
    ...GUK_RESELLER_COMPANY_HEADERS,
    ...GUK_COUNTRY_CONSOLIDATION_HEADERS
  ])
];

// ---------- HEADER_ALIASES ----------
const GUK_HEADER_ALIASES = {
  'phone number': 'telephone number',
  'reseller email - lead management': 'reseller email',
  'reseller comment': 'reseller comments',
  'product/model': 'product model',
  'status (sf)': 'lead status'
};

// ========================= MAIN =========================

function buildGUKConsolidation() {

  Logger.log(
    GUK_DRY_RUN
      ? "=== GUK DRY RUN STARTED ==="
      : "=== GUK LIVE RUN STARTED ==="
  );

  // Read mapping records.
  const mappingData =
    getGUKMappingData_();

  if (!mappingData.length) {
    Logger.log("No valid mapping records found.");
    return;
  }

  Logger.log(
    "Mapping records found: " +
    mappingData.length
  );

  // Collect rows from all source sheets.
  const allRows =
    collectGUKSourceRows_(
      mappingData
    );

  if (!allRows.length) {
    Logger.log("No source rows were collected.");
    return;
  }

  // Group rows into BD and reseller groups.
  const groupedRows =
    groupGUKRows_(
      allRows
    );

  // Prepare deduplicated output data.
  const outputs =
    prepareGUKOutputs_(
      groupedRows
    );

  // Show output summary.
  logGUKOutputSummary_(
    outputs
  );

  // Write outputs only when live mode is enabled.
  if (!GUK_DRY_RUN) {

    writeAllGUKOutputs_(
      mappingData,
      outputs
    );

  } else {

    Logger.log(
      "DRY RUN: No destination sheets modified."
    );

  }

  Logger.log(
    GUK_DRY_RUN
      ? "=== GUK DRY RUN COMPLETED ==="
      : "=== GUK LIVE RUN COMPLETED ==="
  );
}

// Convert collected row objects into output row arrays.
function convertGUKRowsForOutput_(rows) {

  return rows.map(function (row) {
    return row.data;
  });
}

// ========================= MAPPING SHEET =========================

// Reads the mapping/configuration sheet.
// The Google Sheet Link column tells us which source spreadsheet
// should be processed.
function getGUKMappingData_() {

  Logger.log("Reading GUK mapping sheet...");

  let mappingSpreadsheet;

  try {

    mappingSpreadsheet =
      SpreadsheetApp.openById(GUK_MAPPING_SHEET_ID);

  } catch (error) {

    Logger.log(
      "ERROR: Could not open mapping sheet: " +
      error.message
    );

    return [];
  }

  const mappingSheet =
    mappingSpreadsheet.getSheetByName(
      GUK_MAPPING_TAB_NAME
    );

  if (!mappingSheet) {

    Logger.log(
      "ERROR: Mapping tab not found: " +
      GUK_MAPPING_TAB_NAME
    );

    return [];
  }

  const values =
    mappingSheet.getDataRange().getValues();

  if (values.length < 2) {

    Logger.log(
      "No mapping records found."
    );

    return [];
  }

  const headers = values[0];

  Logger.log(
    "Mapping headers: " +
    JSON.stringify(headers)
  );

  const resellerNameCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.RESELLER_NAME
    );

  const firstNameCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.FIRST_NAME
    );

  const lastNameCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.LAST_NAME
    );

  const roleCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.ROLE
    );

  const countryCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.COUNTRY
    );

  const emailCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.EMAIL
    );

  const sheetLinkCol =
    headers.indexOf(
      GUK_MAPPING_HEADERS.SHEET_LINK
    );


  if (
    roleCol === -1 ||
    countryCol === -1 ||
    sheetLinkCol === -1
  ) {

    Logger.log(
      "ERROR: Required mapping column is missing."
    );

    Logger.log(
      "Role column: " + roleCol
    );

    Logger.log(
      "Country column: " + countryCol
    );

    Logger.log(
      "Google Sheet Link column: " +
      sheetLinkCol
    );

    return [];
  }


  const records = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const record = {

      resellerName:
        resellerNameCol !== -1
          ? String(row[resellerNameCol] || "").trim()
          : "",

      firstName:
        firstNameCol !== -1
          ? String(row[firstNameCol] || "").trim()
          : "",

      lastName:
        lastNameCol !== -1
          ? String(row[lastNameCol] || "").trim()
          : "",

      role:
        String(row[roleCol] || "").trim(),

      country:
        String(row[countryCol] || "").trim(),

      email:
        emailCol !== -1
          ? String(row[emailCol] || "").trim()
          : "",

      sheetLink:
        String(row[sheetLinkCol] || "").trim()
    };


    if (
      !record.role &&
      !record.country &&
      !record.sheetLink
    ) {
      continue;
    }

    if (!record.sheetLink) {

      Logger.log(
        "WARNING: Row " +
        (i + 1) +
        " has no Google Sheet Link. Skipping."
      );

      continue;
    }


    records.push(record);
  }


  Logger.log(
    "Valid mapping records: " +
    records.length
  );

  return records;
}


// ========================= SOURCE READING =========================

// Opens one source spreadsheet using the Google Sheet URL/ID
// from the mapping sheet and reads its "Leads Data" tab.
function openGUKSource_(sheetLink) {

  const spreadsheetId =
    extractGUKSpreadsheetId_(sheetLink);

  if (!spreadsheetId) {

    Logger.log(
      "ERROR: Could not extract spreadsheet ID from: " +
      sheetLink
    );

    return null;
  }


  try {

    const spreadsheet =
      SpreadsheetApp.openById(
        spreadsheetId
      );

    const sheet =
      spreadsheet.getSheetByName(
        GUK_SOURCE_TAB
      );

    if (!sheet) {

      Logger.log(
        'WARNING: "' +
        GUK_SOURCE_TAB +
        '" tab not found in: ' +
        spreadsheet.getName()
      );

      return null;
    }


    const values =
      sheet.getDataRange().getValues();


    if (!values.length) {

      Logger.log(
        "Source sheet is empty: " +
        spreadsheet.getName()
      );

      return {
        fileId: spreadsheetId,
        fileName: spreadsheet.getName(),
        header: [],
        data: []
      };
    }


    return {

      fileId: spreadsheetId,

      fileName:
        spreadsheet.getName(),

      header:
        values[0],

      data:
        values.slice(1)
    };


  } catch (error) {

    Logger.log(
      "ERROR: Could not open source: " +
      error.message
    );

    return null;
  }
}


// Extracts the Google Spreadsheet ID from either
// a full Google Sheets URL or a direct spreadsheet ID.
function extractGUKSpreadsheetId_(value) {

  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  if (
    /^[a-zA-Z0-9-_]{20,}$/.test(text)
  ) {
    return text;
  }


  const match =
    text.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
    );


  if (match) {
    return match[1];
  }


  return "";
}


// ========================= COLUMN MAPPING =========================

// Normalizes a header so comparisons are
// case-insensitive and whitespace-independent.
function gukNorm_(value) {

  return String(
    value == null ? "" : value
  )
    .trim()
    .toLowerCase();
}


// Creates a mapping between the source columns
// and our GUK canonical columns.

// Build source-to-common-header column mapping.
function getGUKColumnMap_(sourceHeader) {

  const sourceNormalized =
    sourceHeader.map(function (header) {

      const normalized =
        gukNorm_(header);

      return (
        GUK_HEADER_ALIASES[normalized] ||
        normalized
      );

    });


  const commonNormalized =
    GUK_ALL_HEADERS.map(
      gukNorm_
    );


  const usedSourceColumns = {};


  return commonNormalized.map(
    function (commonHeader) {

      for (
        let i = 0;
        i < sourceNormalized.length;
        i++
      ) {

        if (
          sourceNormalized[i] === commonHeader &&
          !usedSourceColumns[i]
        ) {

          usedSourceColumns[i] = true;

          return i;
        }

      }

      return -1;
    }
  );
}

// ========================= ROW COLLECTION =========================

// Collect lead rows from all source sheets.
// Collect lead rows from all source sheets.
function collectGUKSourceRows_(mappingData) {

  const allRows = [];

  let totalSourceRows = 0;
  let totalNormalizedRows = 0;
  let sourcesProcessed = 0;


  mappingData.forEach(function (record) {

    const source =
      openGUKSource_(record.sheetLink);


    if (!source) {
      return;
    }


    sourcesProcessed++;

    totalSourceRows +=
      source.data.length;


    const columnMap =
      getGUKColumnMap_(
        source.header
      );


    source.data.forEach(function (sourceRow) {

      const commonRow =
        new Array(
          GUK_ALL_HEADERS.length
        ).fill("");


      columnMap.forEach(function (
        sourceColumnIndex,
        commonIndex
      ) {

        if (
          sourceColumnIndex === -1
        ) {
          return;
        }


        commonRow[commonIndex] =
          sourceRow[
            sourceColumnIndex
          ];

      });


      // Fill missing reseller name
      // from mapping sheet.
      const resellerNameIndex =
        GUK_ALL_HEADERS.indexOf(
          "Reseller Name"
        );


      if (
        resellerNameIndex !== -1 &&
        !commonRow[resellerNameIndex]
      ) {

        commonRow[resellerNameIndex] =
          record.resellerName;

      }


      // Email column positions.
      const resellerEmailIndex =
        GUK_ALL_HEADERS.indexOf(
          "Reseller Email"
        );


      const getacSalesIndex =
        GUK_ALL_HEADERS.indexOf(
          "Getac Sales"
        );


      // Separate Getac and reseller emails.
      const email =
        String(
          record.email || ""
        ).trim();


      const isGetacEmail =
        /@getac(?:\.[a-z]{2,})+$/i.test(
          email
        );


      if (isGetacEmail) {

        if (
          getacSalesIndex !== -1 &&
          !commonRow[getacSalesIndex]
        ) {

          commonRow[getacSalesIndex] =
            email;

        }

      } else {

        if (
          resellerEmailIndex !== -1 &&
          !commonRow[resellerEmailIndex]
        ) {

          commonRow[resellerEmailIndex] =
            email;

        }

      }


      // Skip records without Record ID.
      // NOTE: this intentionally only rejects a BLANK Record ID. A malformed ID
      // (e.g. the "12/31/1969" epoch artifact on the Pendrake/Ed Knight lead) is
      // left to flow through UNCHANGED so it stays visible in the consolidation
      // until the POC confirms the correct source Record ID. Re-tighten to a
      // numeric-only check once that's resolved.
      const recordIdIndex =
        GUK_ALL_HEADERS.indexOf(
          "Record ID"
        );


      if (
        recordIdIndex === -1 ||
        !String(
          commonRow[recordIdIndex] || ""
        ).trim()
      ) {

        return;

      }


      allRows.push({

        data: commonRow,

        role:
          record.role,

        country:
          record.country,

        resellerName:
          record.resellerName,

        email:
          record.email,

        sourceFile:
          source.fileName,

        sourceSheetId:
          source.fileId

      });


      totalNormalizedRows++;

    });

  });


  Logger.log(
    "Source Collection: " +
    sourcesProcessed +
    " sources | " +
    totalSourceRows +
    " rows read | " +
    totalNormalizedRows +
    " rows normalized"
  );


  return allRows;
}

// ========================= GROUPING & DEDUPLICATION =========================

// Group normalized rows into BD and Reseller collections.
function groupGUKRows_(allRows) {

  const groups = {
    bd: [],
    resellers: {}
  };

  allRows.forEach(function (row) {

    const role =
      String(row.role || "").trim().toLowerCase();

    if (role === "bd") {

      groups.bd.push(row);
      return;
    }

    if (role === "reseller") {

      const resellerName =
        String(row.resellerName || "").trim();

      if (!resellerName) {
        return;
      }

      if (!groups.resellers[resellerName]) {
        groups.resellers[resellerName] = [];
      }

      groups.resellers[resellerName].push(row);
    }
  });

  return groups;
}


// Deduplicate rows using Record ID.
// Online/Campaigns has priority over Offline/Events.
function deduplicateGUKRows_(rows) {

  const recordIdIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_RECORD_ID_HEADER
    );

  const contactSourceIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_CONTACT_SOURCE_HEADER
    );

  const records = {};
  const withoutRecordId = [];

  let duplicateCount = 0;
  let offlineSkipped = 0;

  rows.forEach(function (row) {

    const recordId =
      String(
        row.data[recordIdIndex] || ""
      ).trim();

    const contactSource =
      String(
        row.data[contactSourceIndex] || ""
      ).trim().toLowerCase();


    // Keep rows without Record ID.
    if (!recordId) {

      withoutRecordId.push(row);
      return;
    }


    // First occurrence of the Record ID.
    if (!records[recordId]) {

      records[recordId] = row;
      return;
    }


    const existingRow =
      records[recordId];

    const existingSource =
      String(existingRow.data[contactSourceIndex] || "" ).trim().toLowerCase();


    const existingIsOnline =
      existingSource === GUK_ONLINE_SOURCE.toLowerCase();

    const currentIsOnline =
      contactSource === GUK_ONLINE_SOURCE.toLowerCase();


    // Online always wins over Offline.
    if (
      currentIsOnline &&
      !existingIsOnline
    ) { records[recordId] = row;

      duplicateCount++;

      offlineSkipped++;

      return;
    }


    // Existing Online record stays.
    if (
      existingIsOnline &&
      !currentIsOnline
    ) {duplicateCount++;

      offlineSkipped++;

      return;
    }
    // If both are Online or both are Offline,
    // keep the first occurrence.
    duplicateCount++;

  });


  return {
    rows:
      Object.keys(records)
        .map(function (recordId) {
          return records[recordId];
        })
        .concat(withoutRecordId),

    duplicates:
      duplicateCount,

    offlineSkipped:
      offlineSkipped
  };
}

// Merge rows that share a Record ID into ONE complete row.
// Unlike deduplicateGUKRows_ (which picks a single winning row), this fills
// each column from the FIRST non-blank value seen across all rows with that
// Record ID — so a lead that appears on both a BD sheet and a reseller sheet
// becomes one row that keeps BOTH the BD-side fields (Getac Sales, etc.) and
// the reseller-side fields (Reseller Comments). First occurrence wins on any
// genuinely conflicting shared cell; blanks are filled from later occurrences.
// Rows without a Record ID cannot be keyed, so they are kept as-is.
function mergeGUKRowsById_(rows) {

  const recordIdIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_RECORD_ID_HEADER
    );

  const order = [];      // preserve first-seen order of Record IDs
  const byId = {};       // recordId -> merged row object (cloned)
  const withoutRecordId = [];
  let mergedCount = 0;

  rows.forEach(function (row) {

    const recordId =
      String(
        row.data[recordIdIndex] || ""
      ).trim();

    if (!recordId) {
      withoutRecordId.push(row);
      return;
    }

    if (!byId[recordId]) {

      // Clone so we never mutate the caller's row object.
      byId[recordId] = {
        data: row.data.slice(),
        role: row.role,
        country: row.country,
        resellerName: row.resellerName
      };

      order.push(recordId);
      return;
    }

    // Same Record ID again → fill only the cells still blank in the kept row.
    const kept = byId[recordId].data;

    for (let c = 0; c < kept.length; c++) {

      const cur = kept[c];
      const incoming = row.data[c];

      const curBlank =
        (cur === '' || cur === null || cur === undefined);

      const incomingBlank =
        (incoming === '' || incoming === null || incoming === undefined);

      if (curBlank && !incomingBlank) {
        kept[c] = incoming;
      }
    }

    mergedCount++;
  });

  return {
    rows:
      order
        .map(function (id) { return byId[id]; })
        .concat(withoutRecordId),
    merged: mergedCount
  };
}

// ========================= OUTPUT PREPARATION =========================

// Prepare deduplicated BD, reseller and final GUK datasets.
function prepareGUKOutputs_(groupedRows) {

  const outputs = {
    bd: [],
    resellers: {},
    resellerConsolidation: [],
    gukConsolidation: []
  };


  // Prepare all BD rows.
  const bdResult =
    deduplicateGUKRows_(groupedRows.bd);

  outputs.bd =
    bdResult.rows;


  // Prepare each reseller separately.
  Object.keys(groupedRows.resellers).forEach(
    function (resellerName) {

      const result =
        deduplicateGUKRows_(
          groupedRows.resellers[resellerName]
        );

      outputs.resellers[resellerName] =
        result.rows;

    }
  );


  // Combine all reseller rows, then MERGE by Record ID. Without this a lead
  // that somehow sits under two resellers would appear twice; merging collapses
  // it into one complete row.
  let resellerCombined = [];

  Object.keys(outputs.resellers).forEach(
    function (resellerName) {

      resellerCombined =
        resellerCombined.concat(
          outputs.resellers[resellerName]
        );

    }
  );

  outputs.resellerConsolidation =
    mergeGUKRowsById_(resellerCombined).rows;


  // Combine BD + reseller rows into the final GUK consolidation, then MERGE by
  // Record ID. THIS is the duplicate fix: a reseller-assigned lead exists in
  // BOTH the BD group and its reseller group, so a plain concat wrote it twice.
  // Merging keeps ONE row carrying both the BD-side (Getac Sales, ...) and
  // reseller-side (Reseller Comments) fields.
  const gukMerge =
    mergeGUKRowsById_(
      outputs.bd.concat(
        outputs.resellerConsolidation
      )
    );

  outputs.gukConsolidation =
    gukMerge.rows;

  Logger.log(
    'GUK Consolidation: merged ' +
    gukMerge.merged +
    ' duplicate Record ID row(s) into existing rows.'
  );


  return outputs;
}


// Log final datasets before writing to Sheets.
function logGUKOutputSummary_(outputs) {

  Logger.log("=== GUK OUTPUT SUMMARY ===");

  Logger.log(
    "GUK BD Consolidation: " +
    outputs.bd.length +
    " rows"
  );

  Logger.log(
    "GUK Reseller Consolidation: " +
    outputs.resellerConsolidation.length +
    " rows"
  );

  Logger.log(
    "GUK Consolidation: " +
    outputs.gukConsolidation.length +
    " rows"
  );


  const resellerNames =
    Object.keys(outputs.resellers);

  Logger.log(
    "Individual Reseller Outputs: " +
    resellerNames.length
  );


  resellerNames.forEach(
    function (resellerName) {

      Logger.log(
        resellerName +
        " Consolidation: " +
        outputs.resellers[resellerName].length +
        " rows"
      );

    }
  );


  Logger.log(
    "=== GUK OUTPUT SUMMARY COMPLETED ==="
  );
}

// ========================= OUTPUT / SHEET WRITING =========================

// Find existing reseller consolidation or create it.
function findOrCreateGUKResellerConsolidation_(folder, resellerName) {

  const name =
    GUK_CONSOLIDATED_PREFIX +
    resellerName;

  const files =
    folder.getFilesByName(name);

  if (files.hasNext()) {

    return SpreadsheetApp.openById(
      files.next().getId()
    );

  }

  if (GUK_DRY_RUN) {

    Logger.log(
      'WOULD CREATE "' +
      name +
      '"'
    );

    return null;
  }

  const ss =
    SpreadsheetApp.create(name);

  DriveApp
    .getFileById(ss.getId())
    .moveTo(folder);

  ss.getSheets()[0]
    .setName(GUK_DEST_TAB);

  Logger.log(
    'Created "' +
    name +
    '"'
  );

  return ss;
}


// Find existing GUK consolidation or create it.
function findOrCreateGUKConsolidation_() {

  const name =
    GUK_CONSOLIDATION_NAME;

  const folder =
    DriveApp.getFolderById(
      GUK_FOLDER_ID
    );

  const files =
    folder.getFilesByName(name);

  if (files.hasNext()) {

    const file =
      files.next();

    Logger.log(
      'GUK file found in folder: ' +
      folder.getName()
  );

    Logger.log(
      'GUK file URL: ' +
      file.getUrl()
    );

    return SpreadsheetApp.openById(
      file.getId()
    );

  }

  if (GUK_DRY_RUN) {

    Logger.log(
      'WOULD CREATE "' +
      name +
      '" in folder: ' +
      folder.getName()
    );

    return null;
  }

  const ss =
    SpreadsheetApp.create(name);

  // Move newly created file into GUK folder.
  DriveApp
    .getFileById(
      ss.getId()
    )
    .moveTo(folder);

  Logger.log(
    'Created "' +
    name +
    '"'
  );

  Logger.log(
    'GUK file location: ' +
    folder.getName()
  );

  Logger.log(
    'GUK file URL: ' +
    ss.getUrl()
  );

  return ss;
}

// Find existing BD consolidation or create it.
function findOrCreateGUKBDConsolidation_() {

  const name =
    GUK_BD_CONSOLIDATION_NAME;

  const folder =
    DriveApp.getFolderById(
      GUK_FOLDER_ID
    );

  Logger.log(
    'BD target folder: ' +
    folder.getName() +
    ' | ID: ' +
    folder.getId()
  );

  const files =
    folder.getFilesByName(name);

  if (files.hasNext()) {

    const file =
      files.next();

    Logger.log(
      'BD file already exists: ' +
      file.getName()
    );

    Logger.log(
      'BD file URL: ' +
      file.getUrl()
    );

    return SpreadsheetApp.openById(
      file.getId()
    );
  }

  if (GUK_DRY_RUN) {

    Logger.log(
      'DRY RUN - would create BD file "' +
      name +
      '" in folder "' +
      folder.getName() +
      '"'
    );

    return null;
  }

  const ss =
    SpreadsheetApp.create(name);

  DriveApp
    .getFileById(ss.getId())
    .moveTo(folder);

  Logger.log(
    'Created BD file: "' +
    name +
    '"'
  );

  Logger.log(
    'BD file location: ' +
    folder.getName()
  );

  Logger.log(
    'BD file URL: ' +
    ss.getUrl()
  );

  return ss;
}

// Find existing overall reseller consolidation or create it.
function findOrCreateGUKOverallResellerConsolidation_() {

  const folder =
    DriveApp.getFolderById(
      GUK_FOLDER_ID
    );

  const name =
    GUK_RESELLER_CONSOLIDATION_NAME;

  const files =
    folder.getFilesByName(
      name
    );

  if (files.hasNext()) {

    return SpreadsheetApp.openById(
      files.next().getId()
    );

  }

  if (GUK_DRY_RUN) {

    Logger.log(
      'WOULD CREATE "' +
      name +
      '"'
    );

    return null;
  }

  const ss =
    SpreadsheetApp.create(
      name
    );

  DriveApp
    .getFileById(
      ss.getId()
    )
    .moveTo(folder);

  ss.getSheets()[0]
    .setName(
      GUK_DEST_TAB
    );

  Logger.log(
    'Created "' +
    name +
    '"'
  );

  return ss;
}

// Write rows into the selected GUK output sheet.
function writeGUKSheet_(
  destination,
  rows,
  templateFileId,
  headerType
) {

  if (!destination) {
    return;
  }


  if (GUK_DRY_RUN) {

    Logger.log(
      'DRY RUN - would write ' +
      rows.length +
      ' rows to ' +
      destination.getName() +
      ' [' +
      headerType +
      ']'
    );

    return;
  }


  // Select the correct output headers.
  let outputHeaders;


  if (headerType === 'BD') {

    outputHeaders =
      GUK_BD_HEADERS;

  } else if (
    headerType === 'RESELLER_INDIVIDUAL'
  ) {

    outputHeaders =
      GUK_RESELLER_INDIVIDUAL_HEADERS;

  } else if (
    headerType === 'RESELLER_COMPANY'
  ) {

    outputHeaders =
      GUK_RESELLER_COMPANY_HEADERS;

  } else if (
    headerType === 'COUNTRY_CONSOLIDATION'
  ) {

    outputHeaders =
      GUK_COUNTRY_CONSOLIDATION_HEADERS;

  } else {

    Logger.log(
      'Invalid GUK header type: ' +
      headerType
    );

    return;
  }


  // Find or create destination sheet.
  let sheet =
    destination.getSheetByName(
      GUK_DEST_TAB
    );


  if (!sheet) {

    const sheets =
      destination.getSheets();


    if (
      sheets.length === 1 &&
      sheets[0].getName() === 'Sheet1'
    ) {

      sheet =
        sheets[0];

      sheet.setName(
        GUK_DEST_TAB
      );

    } else {

      sheet =
        destination.insertSheet(
          GUK_DEST_TAB
        );

    }

  }


  // Remove old validation.
  sheet
    .getRange(
      1,
      1,
      sheet.getMaxRows(),
      sheet.getMaxColumns()
    )
    .clearDataValidations();


  // Clear previous output.
  sheet.clear();


  // Write selected headers.
  sheet
    .getRange(
      1,
      1,
      1,
      outputHeaders.length
    )
    .setValues([
      outputHeaders
    ]);


  /*
   * Convert rows from GUK_ALL_HEADERS structure
   * into the selected output header structure.
   *
   * This is required because BD, reseller individual,
   * reseller company and country consolidation have
   * different numbers/order of columns.
   */

  const allHeaderNormalized =
    GUK_ALL_HEADERS.map(
      gukNorm_
    );


  const outputHeaderNormalized =
    outputHeaders.map(
      gukNorm_
    );


  const outputColumnIndexes =
    outputHeaderNormalized.map(
      function (header) {

        return allHeaderNormalized.indexOf(
          header
        );

      }
    );


  const outputRows =
    rows.map(
      function (row) {

        return outputColumnIndexes.map(
          function (sourceIndex) {

            if (sourceIndex === -1) {
              return "";
            }

            return row[sourceIndex];

          }
        );

      }
    );


  // Write converted rows.
  if (outputRows.length) {

    sheet
      .getRange(
        2,
        1,
        outputRows.length,
        outputHeaders.length
      )
      .setValues(
        outputRows
      );

  }


  // Format date columns.
  formatGUKDateColumns_(
    sheet,
    outputRows.length,
    outputHeaders
  );


  // Make the Customer Comment column wrap so long comments stay fully readable.
  wrapGUKCommentColumn_(
    sheet,
    outputRows.length,
    outputHeaders
  );


  // Re-apply dropdowns and header formatting.
  applyGUKTemplateStyling_(
    sheet,
    outputRows.length,
    templateFileId,
    outputHeaders
  );


  Logger.log(
    'Written: ' +
    outputRows.length +
    ' rows → ' +
    destination.getName() +
    ' [' +
    headerType +
    ']'
  );
}

// Apply date formatting to configured date columns.
function formatGUKDateColumns_(
  sheet,
  rowCount,
  outputHeaders
) {

  if (!rowCount) {
    return;
  }


  const headers =
    outputHeaders.map(
      gukNorm_
    );


  GUK_DATE_HEADERS.forEach(
    function (headerName) {

      const col =
        headers.indexOf(
          gukNorm_(headerName)
        );


      if (col === -1) {
        return;
      }


      const range =
        sheet.getRange(
          2,
          col + 1,
          rowCount,
          1
        );


      const values =
        range.getValues();


      let changed =
        false;


      values.forEach(
        function (row) {

          const value =
            row[0];


          if (
            value === '' ||
            value === null ||
            value === undefined
          ) {
            return;
          }


          if (value instanceof Date) {
            return;
          }


          let milliseconds =
            null;


          if (
            typeof value === 'number' &&
            isFinite(value)
          ) {

            milliseconds =
              value;

          } else if (
            typeof value === 'string' &&
            /^\d{10,}$/.test(
              value.trim()
            )
          ) {

            milliseconds =
              Number(
                value.trim()
              );

          }


          if (milliseconds === null) {
            return;
          }


          // A bare 0 (empty/placeholder) must NOT become 31 Dec 1969 — leave it.
          if (milliseconds === 0) {
            return;
          }


          if (milliseconds < 1e12) {

            milliseconds *= 1000;

          }


          row[0] =
            new Date(
              milliseconds
            );

          changed = true;

        }
      );


      if (changed) {

        range.setValues(
          values
        );

      }


      range.setNumberFormat(
        GUK_DATE_FORMAT
      );


      // Force a single, consistent alignment on the whole date column.
      // Converted Date cells right-align by default while any leftover
      // raw/text value left-aligns — stamping the range explicitly keeps
      // the column visually uniform regardless of cell content.
      range.setHorizontalAlignment(
        'right'
      );

    }
  );
}


// Make the "Customer Comment" column wrap its text and give it a sensible width,
// so long comments are readable instead of spilling into one clipped line.
function wrapGUKCommentColumn_(sheet, rowCount, outputHeaders) {

  const headers = outputHeaders.map(gukNorm_);
  const col = headers.indexOf(gukNorm_('Customer Comment'));

  if (col === -1) {
    return;
  }

  // A fixed width lets wrapping actually take effect (otherwise the column just
  // keeps widening). ~300px comfortably fits a couple of lines of comment text.
  sheet.setColumnWidth(col + 1, 300);

  const rows = Math.max(rowCount, 1);

  sheet
    .getRange(2, col + 1, rows, 1)
    .setWrap(true)
    .setVerticalAlignment('top');
}

// Apply source-style header formatting and dropdowns.
function applyGUKTemplateStyling_(
  destinationSheet,
  dataRowCount,
  templateFileId,
  outputHeaders
) {

  if (!templateFileId) {
    return;
  }

  let templateSheet;

  try {
    templateSheet =
      SpreadsheetApp
        .openById(templateFileId)
        .getSheetByName(GUK_SOURCE_TAB);
  } catch (error) {
    Logger.log('Could not open template: ' + error.message);
    return;
  }

  if (!templateSheet) {
    return;
  }

  const templateWidth = templateSheet.getLastColumn();

  const templateHeader =
    templateWidth > 0
      ? templateSheet.getRange(1, 1, 1, templateWidth).getValues()[0]
      : [];

  const templateNormalized = templateHeader.map(gukNorm_);
  const outputNormalized = outputHeaders.map(gukNorm_);

  // ---------- Copy header formatting only ----------
  const copyColumns = Math.min(GUK_ALL_HEADERS.length, templateWidth);

  if (copyColumns > 0) {

    const sourceHeaderRange = templateSheet.getRange(1, 1, 1, copyColumns);
    const destinationHeaderRange = destinationSheet.getRange(1, 1, 1, copyColumns);

    destinationHeaderRange
      .setFontWeights(sourceHeaderRange.getFontWeights())
      .setFontColors(sourceHeaderRange.getFontColors())
      .setBackgrounds(sourceHeaderRange.getBackgrounds())
      .setFontSizes(sourceHeaderRange.getFontSizes())
      .setFontFamilies(sourceHeaderRange.getFontFamilies())
      .setFontStyles(sourceHeaderRange.getFontStyles())
      .setHorizontalAlignments(sourceHeaderRange.getHorizontalAlignments())
      .setVerticalAlignments(sourceHeaderRange.getVerticalAlignments())
      .setWraps(sourceHeaderRange.getWraps());
  }

  const rowsToCover = Math.max(dataRowCount, GUK_DROPDOWN_MIN_ROWS);

  // ---------- Apply dropdowns ----------
  const dropdownHeaders =
    GUK_DROPDOWN_HEADERS.filter(
      function (headerName) {

        return outputNormalized.indexOf(
          gukNorm_(headerName)
        ) !== -1;

      }
    );

  dropdownHeaders.forEach(
    function (headerName) {

    const normalizedHeader = gukNorm_(headerName);

    const destinationColumn = outputNormalized.indexOf(normalizedHeader);

    if (destinationColumn === -1) {
      Logger.log('Destination column not found for: ' + headerName);
      return;
    }

    const templateColumn = templateNormalized.indexOf(normalizedHeader);

    let dropdownValues = [];
    let sourceHadDropdown = false;

    // ===== SCENARIO 1: template column has an existing dropdown rule =====
    if (templateColumn !== -1 && templateSheet.getLastRow() >= 2) {

      let sourceRule = null;

      try {
        sourceRule =
          templateSheet.getRange(2, templateColumn + 1).getDataValidation();
      } catch (error) {
        Logger.log('Could not read source validation for ' + headerName + ': ' + error.message);
      }

      if (sourceRule) {

        sourceHadDropdown = true;
        Logger.log('Existing source dropdown found for: ' + headerName);

        try {

          const criteriaType = sourceRule.getCriteriaType();
          const criteriaValues = sourceRule.getCriteriaValues();

          if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {

            // Never copy the rule directly — the referenced range (e.g.
            // Instructions!$F$41:$F$61) may not exist in the destination
            // spreadsheet. Resolve it to real values instead.
            const sourceRange = criteriaValues[0];

            dropdownValues = sourceRange
              .getDisplayValues()
              .flat()
              .map(function (value) { return String(value).trim(); })
              .filter(function (value) { return value !== ''; });

            Logger.log('Converted source range dropdown to local list for: ' + headerName);

          } else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {

            dropdownValues = (criteriaValues[0] || [])
              .map(function (value) { return String(value).trim(); })
              .filter(function (value) { return value !== ''; });

          }

        } catch (error) {
          Logger.log('Could not rebuild source dropdown for ' + headerName + ': ' + error.message);
        }
      }
    }

    // ===== SCENARIO 2: no source dropdown — build list from actual template data =====
    if (!sourceHadDropdown && templateColumn !== -1 && templateSheet.getLastRow() >= 2) {

      const sourceLastRow = templateSheet.getLastRow();

      const sourceValues =
        templateSheet
          .getRange(2, templateColumn + 1, sourceLastRow - 1, 1)
          .getValues()
          .flat();

      dropdownValues = sourceValues
        .map(function (value) { return String(value == null ? '' : value).trim(); })
        .filter(function (value) { return value !== ''; });
    }

    // ===== SCENARIO 3: fallback — template gave us nothing usable =====
    if (dropdownValues.length === 0 && dataRowCount > 0) {

      const destValues =
        destinationSheet
          .getRange(2, destinationColumn + 1, dataRowCount, 1)
          .getValues()
          .flat();

      dropdownValues = destValues
        .map(function (value) { return String(value == null ? '' : value).trim(); })
        .filter(function (value) { return value !== ''; });

      if (dropdownValues.length > 0) {
        Logger.log(
          'Template had no usable values for ' + headerName + '. Built dropdown from destination data instead.'
        );
      }
    }

    // Remove duplicates regardless of which path produced the values.
    dropdownValues = [...new Set(dropdownValues)];

    Logger.log(
      'Dynamic dropdown values for ' + headerName + ': ' + JSON.stringify(dropdownValues)
    );

    const targetRange =
      destinationSheet.getRange(2, destinationColumn + 1, rowsToCover, 1);

    // ===== Apply / retain =====
    if (dropdownValues.length > 0) {

      try {

        const rule =
          SpreadsheetApp.newDataValidation()
            .requireValueInList(dropdownValues, true)
            .setAllowInvalid(true)
            .build();

        targetRange.setDataValidation(rule);

        Logger.log('Dropdown applied successfully for: ' + headerName);

      } catch (error) {
        Logger.log('Could not apply dropdown for ' + headerName + ': ' + error.message);
      }

    } else {

      // No values currently exist to validate against.
      // A VALUE_IN_LIST rule with zero items is invalid, so we do NOT build one.
      // We never touch row 1 or write into the header cell.
      // We just leave row 2+ without a validation rule rather than risk
      // corrupting the sheet with a fake/empty rule.
      try {
        targetRange.clearDataValidations();
      } catch (error) {
        Logger.log('Could not clear stale validation for ' + headerName + ': ' + error.message);
      }

      Logger.log(
        'No values found for ' + headerName + '. No dropdown applied (header and data left untouched).'
      );
    }

  });
}

// ========================= FINAL OUTPUT BUILD =========================

// Build all GUK destination sheets.
function writeAllGUKOutputs_(
  mappingData,
  outputs
) {

  Logger.log(
    '=== GUK OUTPUT WRITING STARTED ==='
  );


  // Find a source template for formatting/dropdowns.
  let templateFileId =
    null;


  for (
    let i = 0;
    i < mappingData.length;
    i++
  ) {

    const source =
      openGUKSource_(
        mappingData[i].sheetLink
      );


    if (
      source &&
      source.header &&
      source.header.length
    ) {

      templateFileId =
        source.fileId;

      break;
    }

  }


  // Overall BD consolidation.
  const bdDestination =
    findOrCreateGUKBDConsolidation_();


  writeGUKSheet_(
    bdDestination,
    convertGUKRowsForOutput_(
      outputs.bd
    ),
    templateFileId,
    'BD'
  );


  // Overall reseller consolidation.
  const resellerDestination =
    findOrCreateGUKOverallResellerConsolidation_();


  writeGUKSheet_(
    resellerDestination,
    convertGUKRowsForOutput_(
      outputs.resellerConsolidation
    ),
    templateFileId,
    'RESELLER_COMPANY'
  );


  // Overall GUK consolidation.
  const gukDestination =
    findOrCreateGUKConsolidation_();


  writeGUKSheet_(
    gukDestination,
    convertGUKRowsForOutput_(
      outputs.gukConsolidation
    ),
    templateFileId,
    'COUNTRY_CONSOLIDATION'
  );


  // =========================================================
  // Individual reseller outputs.
  // Creates a file for EVERY reseller folder,
  // even when there are 0 records.
  // =========================================================

  const gukFolder =
    DriveApp.getFolderById(
      GUK_FOLDER_ID
    );


  const resellerFolders =
    gukFolder.getFoldersByName(
      GUK_RESELLER_FOLDER_NAME
    );


  if (!resellerFolders.hasNext()) {

    Logger.log(
      'ERROR: "Resellers" folder not found inside GUK.'
    );

  } else {

    const resellersFolder =
      resellerFolders.next();


    const resellerNames = [
      ...new Set(
        mappingData
          .map(function (record) {

            return String(
              record.resellerName || ''
            ).trim();

          })
          .filter(function (name) {

            return name !== '';

          })
      )
    ];


    resellerNames.forEach(
      function (resellerName) {

        const folders =
          resellersFolder.getFoldersByName(
            resellerName
          );


        if (!folders.hasNext()) {

          Logger.log(
            'ERROR: Reseller folder not found: ' +
            resellerName
          );

          return;
        }


        const companyFolder =
          folders.next();


        Logger.log(
          'Reseller: ' +
          resellerName +
          ' | Target folder: ' +
          companyFolder.getName()
        );


        // If no records exist, use an empty array.
        // The output file will still be created
        // with the canonical headers.
        const resellerRows =
          outputs.resellers[
            resellerName
          ] || [];


        const destination =
          findOrCreateGUKResellerConsolidation_(
            companyFolder,
            resellerName
          );


        if (!destination) {
          return;
        }


        writeGUKSheet_(
          destination,
          convertGUKRowsForOutput_(
            resellerRows
          ),
          templateFileId,
          'RESELLER_INDIVIDUAL'
        );


        Logger.log(
          'Reseller output completed: ' +
          resellerName +
          ' | Rows: ' +
          resellerRows.length +
          ' | Folder: ' +
          companyFolder.getName() +
          ' | URL: ' +
          destination.getUrl()
        );

      }
    );

  }


  Logger.log(
    '=== GUK OUTPUT WRITING COMPLETED ==='
  );
}
// ========================= TRIGGER =========================

// Install automatic GUK consolidation trigger.
function installGUKConsolidationCron() {

  let exists = false;

  ScriptApp.getProjectTriggers()
    .forEach(function (t) {

      if (
        t.getHandlerFunction() ===
        'buildGUKConsolidation'
      ) {
        exists = true;
      }

    });


  if (exists) {

    Logger.log(
      'GUK consolidation cron already installed.'
    );

    return;
  }


  // Testing: every 5 minutes.
  ScriptApp.newTrigger(
    'buildGUKConsolidation'
  )
    .timeBased()
    .everyMinutes(5)
    .create();


  Logger.log(
    'GUK consolidation cron installed (every 5 min).'
  );
}


// Remove automatic GUK consolidation trigger.
function removeGUKConsolidationCron() {

  let removed = 0;

  ScriptApp.getProjectTriggers()
    .forEach(function (t) {

      if (
        t.getHandlerFunction() ===
        'buildGUKConsolidation'
      ) {

        ScriptApp.deleteTrigger(t);

        removed++;
      }

    });


  Logger.log(
    'Removed ' +
    removed +
    ' GUK consolidation cron trigger(s).'
  );
}
