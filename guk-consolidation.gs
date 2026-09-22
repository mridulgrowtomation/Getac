// ========================================
// GUK CONSOLIDATION - CONFIGURATION
// ========================================

// ---------- Execution ----------

const GUK_DRY_RUN = true;

// ---------- Mapping / Source Configuration ----------

// Single source of truth: the SAME mapping file guk-sync reads (GS_MAPPING_ID).
// Was "1afWzwlqEus7z7DuVxUgJS0EfWW9KlsZU" — a STALE copy with only 12 rows (9
// resellers) that never got the new resellers (GTMN, Ingram Micro ×4, Jarltech,
// Edico), so consolidation silently missed them. Both scripts now read one file
// so POC onboards a reseller in ONE place and both systems pick it up.
const GUK_MAPPING_SHEET_ID = "1AXWJRM700muVENMY4eInIuJ0dvDiPEhlGSkbzPjUpVU";
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

// Deal ID is the GO-FORWARD dedup/lookup key (phase 2). Record ID is NO LONGER the
// dedup key: the SAME Record ID can legitimately appear on multiple rows (one contact,
// several enquiries), each carrying a UNIQUE Deal ID — those must stay as SEPARATE rows.
// We dedupe on Deal ID instead, and SKIP any row that has no Deal ID (lookup property
// absent — e.g. the 2 known test offline records).
const GUK_DEAL_ID_HEADER = "Deal ID";

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
  "Deal ID"
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
  "Deal ID"
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
  "Deal ID"
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
  "Deal ID"
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
  'status (sf)': 'lead status',
  'dealid': 'deal id',
  'deal id (hubspot)': 'deal id',
  'hubspot deal id': 'deal id'
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
        String(row[sheetLinkCol] || "").trim(),

      rowNumber: (i + 1)
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

    // A Drive *folder* link is never a readable source (e.g. the "GUK Folder"
    // row pointing at the output folder). Skip these quietly so they don't
    // surface as errors.
    if (/\/folders\//.test(record.sheetLink)) {

      Logger.log(
        "Skipping row " +
        (i + 1) +
        " (" + (record.resellerName || "?") +
        "): Google Sheet Link is a Drive folder, not a spreadsheet."
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
  let skippedNoDealId = 0;

  // DIAGNOSTIC (dry-run aid): remember which sheet + Record ID each no-Deal-ID skip
  // came from, so we can confirm the drops are genuine local-ID/offline test records
  // and not a Deal ID column that failed to map on some sheet.
  const skippedSamples = [];
  const recordIdIndex =
    GUK_ALL_HEADERS.indexOf(GUK_RECORD_ID_HEADER);


  mappingData.forEach(function (record) {

    const source =
      openGUKSource_(record.sheetLink);


    if (!source) {
      // Name the mapping row whose sheet could not be opened (e.g. a Drive folder
      // link pasted into "Google Sheet Link") so the POC can fix that exact row.
      const folderMatch =
        String(record.sheetLink || "").match(/\/folders\/([a-zA-Z0-9-_]+)/);
      const folderId = folderMatch ? folderMatch[1] : "";
      Logger.log(
        "SOURCE NOT READ: mapping row " +
        (record.rowNumber || "?") +
        " | name: " + (record.resellerName || "?") +
        " / " + (record.email || "?") +
        (folderId
          ? " | THIS IS A DRIVE FOLDER, NOT A SHEET — folder ID: " + folderId
          : "") +
        " | link: " + record.sheetLink
      );
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


      // Collect EVERY normalized row here (no skipping yet). The Deal ID skip runs
      // AFTER the loop, so that reseller rows carrying a HubSpot Record ID but no Deal
      // ID can first be enriched with the Deal ID from the BD sheets (Angelica / Ellie
      // / Alexander) — see the enrichment pass below. Only rows that STILL have no Deal
      // ID after enrichment (genuine local/offline records with no HubSpot identity) are
      // dropped.
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


  // ---------- Deal ID enrichment (BD -> reseller) ----------
  // Deal ID lands on the BD sheets (HubSpot-enriched) and must flow onto each reseller's
  // rows so the reseller-wise consolidation carries it. We match on RECORD ID (the only
  // shared key available today). When a Record ID maps to several BD deals (the repeated-
  // enquiry case), we disambiguate by CREATE DATE; if even the Create Date is identical
  // across candidates we cannot tell them apart, so we SKIP that row and flag it in the
  // log. Done here (not just in guk-sync) so the consolidation is self-healing on every
  // rebuild regardless of whether the upstream reseller sheet was backfilled.
  const dealIdIndex = GUK_ALL_HEADERS.indexOf(GUK_DEAL_ID_HEADER);
  const createDateIndex = GUK_ALL_HEADERS.indexOf("Create Date");

  const hasDealId = function (row) {
    return dealIdIndex !== -1 &&
      String(row.data[dealIdIndex] || "").trim() !== "";
  };
  const getRecordId = function (row) {
    return recordIdIndex !== -1
      ? String(row.data[recordIdIndex] || "").trim()
      : "";
  };
  const getCreateKey = function (row) {
    return createDateIndex !== -1
      ? gukNormalizeDateKey_(row.data[createDateIndex])
      : "";
  };

  // BD index: Record ID -> [ { dealId, createKey } ] for every BD row that carries both a
  // Record ID and a Deal ID. Reseller rows are never a Deal ID source.
  const bdByRecordId = {};
  allRows.forEach(function (row) {
    if (String(row.role || "").trim().toLowerCase() !== "bd") return;
    const rid = getRecordId(row);
    if (!rid || !hasDealId(row)) return;
    (bdByRecordId[rid] = bdByRecordId[rid] || []).push({
      dealId: String(row.data[dealIdIndex]).trim(),
      createKey: getCreateKey(row)
    });
  });

  // --- Diagnostics: understand WHY enrichment finds matches or not ---
  let diagBdWithBoth = 0;   // BD rows carrying both a Record ID and a Deal ID (the index source)
  let diagResTotal = 0;     // reseller rows seen
  let diagResHasDealId = 0; // reseller rows already carrying a Deal ID (read directly from source)
  let diagResNoId = 0;      // reseller rows with a blank Record ID (unmatchable by Record ID)
  let diagResHasId = 0;     // reseller rows with a Record ID (matchable)
  allRows.forEach(function (row) {
    const r = String(row.role || "").trim().toLowerCase();
    if (r === "bd") {
      if (getRecordId(row) && hasDealId(row)) diagBdWithBoth++;
      return;
    }
    if (r !== "reseller") return;
    diagResTotal++;
    if (hasDealId(row)) diagResHasDealId++;
    else if (getRecordId(row)) diagResHasId++;
    else diagResNoId++;
  });
  Logger.log(
    "Enrichment inputs: BD rows with Record ID + Deal ID = " + diagBdWithBoth +
    " (" + Object.keys(bdByRecordId).length + " distinct Record IDs) | " +
    "reseller rows = " + diagResTotal +
    " (already have Deal ID: " + diagResHasDealId +
    ", have Record ID to match: " + diagResHasId +
    ", blank Record ID: " + diagResNoId + ")"
  );

  let enrichedSingle = 0;   // Record ID hit exactly one BD deal
  let enrichedByDate = 0;   // multiple BD deals, resolved uniquely by Create Date
  let flaggedAmbiguous = 0; // multiple BD deals, Create Date could not resolve
  const flaggedSamples = [];

  allRows.forEach(function (row) {
    if (String(row.role || "").trim().toLowerCase() !== "reseller") return;
    if (hasDealId(row)) return;                 // already has one — nothing to do
    const rid = getRecordId(row);
    if (!rid) return;                           // no key — handled by the skip pass below

    const candidates = bdByRecordId[rid];
    if (!candidates || !candidates.length) return;   // not in any BD sheet — skip pass handles it

    if (candidates.length === 1) {
      row.data[dealIdIndex] = candidates[0].dealId;
      enrichedSingle++;
      return;
    }

    // Repeated-enquiry: same Record ID, several BD deals. Disambiguate by Create Date.
    const rowKey = getCreateKey(row);
    const dateMatches = rowKey
      ? candidates.filter(function (c) { return c.createKey && c.createKey === rowKey; })
      : [];

    if (dateMatches.length === 1) {
      row.data[dealIdIndex] = dateMatches[0].dealId;
      enrichedByDate++;
      return;
    }

    // 0 matches (Create Date absent/different) or >1 (identical Create Dates) → cannot tell
    // which deal this row is → skip + flag.
    flaggedAmbiguous++;
    row._dealIdFlagged = true;   // so the skip pass below doesn't re-count/re-list it
    if (flaggedSamples.length < 40) {
      flaggedSamples.push(
        (row.sourceFile || "?") +
        " | Record ID=" + rid +
        " | " + candidates.length + " BD deals, " +
        dateMatches.length + " match Create Date '" + rowKey + "'"
      );
    }
  });


  // ---------- Skip rows still lacking a Deal ID ----------
  // After enrichment, anything without a Deal ID has no HubSpot identity we can key on
  // (blank Record ID, local offline IDs not in BD, or the flagged-ambiguous rows above).
  const keptRows = allRows.filter(function (row) {
    if (hasDealId(row)) return true;
    if (row._dealIdFlagged) return false;   // already counted/listed in the flagged pass
    skippedNoDealId++;
    if (skippedSamples.length < 40) {
      skippedSamples.push(
        (row.sourceFile || "?") +
        " | Record ID=" + (getRecordId(row) || "(blank)")
      );
    }
    return false;
  });


  Logger.log(
    "Source Collection: " +
    sourcesProcessed +
    " sources | " +
    totalSourceRows +
    " rows read | " +
    totalNormalizedRows +
    " rows normalized | " +
    (enrichedSingle + enrichedByDate) +
    " enriched from BD (" + enrichedSingle + " by Record ID, " +
    enrichedByDate + " by Create Date tiebreak) | " +
    flaggedAmbiguous +
    " flagged (unresolved multi-enquiry) | " +
    skippedNoDealId +
    " rows skipped (no Deal ID)"
  );

  if (flaggedSamples.length) {
    Logger.log(
      "FLAGGED — same Record ID + same/absent Create Date, cannot assign a Deal ID — up to 40 shown:\n" +
      flaggedSamples.join("\n")
    );
  }

  if (skippedSamples.length) {
    Logger.log(
      "Skipped (no Deal ID, no BD match) — up to 40 shown:\n" +
      skippedSamples.join("\n")
    );
  }


  return keptRows;
}

// Normalize a Create Date cell to a day-level key for tiebreak comparison. HubSpot ships
// dates as epoch millis, Google may hand back a Date object, and hand-typed sheets hold
// strings — reduce all three to "yyyy-mm-dd" so BD and reseller rows compare on the same
// footing. Unparseable values fall back to their trimmed lowercase string.
function gukNormalizeDateKey_(value) {
  if (value === null || value === undefined || value === "") return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return isNaN(value.getTime()) ? "" : gukDayKey_(value);
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : gukDayKey_(d);
  }

  const str = String(value).trim();
  if (!str) return "";
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? str.toLowerCase() : gukDayKey_(parsed);
}

function gukDayKey_(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

// ========================= GROUPING & DEDUPLICATION =========================

// Group normalized rows into BD and Reseller collections.
function groupGUKRows_(allRows) {

  const groups = {
    bd: [],
    resellers: {}
  };

  // The "Reseller Name" DATA column on BD (Ellie/Angelica) assignment rows names the
  // reseller each lead is assigned to. Those BD rows carry the Deal ID, so routing them
  // into the assigned reseller's group is how Deal IDs reach the reseller sheets.
  const assignColIndex = GUK_ALL_HEADERS.indexOf("Reseller Name");
  const bdAssignCounts = {};   // assigned reseller name -> # BD rows (diagnostic)

  allRows.forEach(function (row) {

    const role =
      String(row.role || "").trim().toLowerCase();

    if (role === "bd") {

      groups.bd.push(row);

      // Also place the assignment row in its reseller's Consolidated group.
      const assigned = assignColIndex !== -1
        ? String(row.data[assignColIndex] || "").trim()
        : "";

      if (assigned) {
        if (!groups.resellers[assigned]) {
          groups.resellers[assigned] = [];
        }
        groups.resellers[assigned].push(row);
        bdAssignCounts[assigned] = (bdAssignCounts[assigned] || 0) + 1;
      }
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

  // Diagnostic: show how BD-assigned leads spread across resellers. If a name here does
  // NOT match a reseller folder in the mapping, that reseller's leads won't be written —
  // this log is how we catch a "CI Distribution" vs "CI Distribution (UK)" style mismatch.
  const assignSummary = Object.keys(bdAssignCounts)
    .map(function (name) { return name + " (" + bdAssignCounts[name] + ")"; })
    .join(", ");
  Logger.log(
    "BD assignment routing: " +
    Object.keys(bdAssignCounts).length +
    " reseller(s) named on BD rows -> " +
    (assignSummary || "(none)")
  );

  return groups;
}


// Deduplicate rows using DEAL ID (phase 2 — was Record ID).
// Two rows that share a Record ID but have DIFFERENT Deal IDs are DIFFERENT enquiries
// and both survive; only rows sharing the SAME Deal ID collapse to one.
// Online/Campaigns has priority over Offline/Events on a Deal ID collision.
function deduplicateGUKRows_(rows) {

  const dealIdIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_DEAL_ID_HEADER
    );

  const contactSourceIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_CONTACT_SOURCE_HEADER
    );

  const records = {};

  let duplicateCount = 0;
  let offlineSkipped = 0;

  // Clone so we never mutate a source object (a BD assignment row is shared between the BD
  // group and a reseller group). fillBlanks_ copies any value the donor has into a cell the
  // keeper left blank — so a field that exists ONLY on the losing duplicate (e.g. a Lead
  // Status set on the BD assignment row but blank on the reseller row) SURVIVES the merge
  // instead of being discarded with the losing row. Never overwrites a non-blank keeper cell.
  const cloneRow = function (row) {
    const copy = {};
    for (const k in row) { if (Object.prototype.hasOwnProperty.call(row, k)) copy[k] = row[k]; }
    copy.data = row.data.slice();
    return copy;
  };
  const fillBlanks = function (keeper, donor) {
    const k = keeper.data, d = donor.data;
    for (let c = 0; c < k.length; c++) {
      const blank = (k[c] === '' || k[c] === null || k[c] === undefined);
      const donorHas = !(d[c] === '' || d[c] === null || d[c] === undefined);
      if (blank && donorHas) k[c] = d[c];
    }
  };

  rows.forEach(function (row) {

    const dealId =
      String(
        row.data[dealIdIndex] || ""
      ).trim();

    const contactSource =
      String(
        row.data[contactSourceIndex] || ""
      ).trim().toLowerCase();


    // No Deal ID → not keyable → skip (should not occur; collection already filters
    // these out, this is a defensive guard).
    if (!dealId) {
      return;
    }


    // First occurrence of the Deal ID.
    if (!records[dealId]) {

      records[dealId] = cloneRow(row);
      return;
    }


    const existingRow =
      records[dealId];

    const existingSource =
      String(existingRow.data[contactSourceIndex] || "" ).trim().toLowerCase();


    const existingIsOnline =
      existingSource === GUK_ONLINE_SOURCE.toLowerCase();

    const currentIsOnline =
      contactSource === GUK_ONLINE_SOURCE.toLowerCase();


    // Online always wins over Offline — the online row becomes the base, but we still fill
    // its blanks from the offline row so no field is lost.
    if (
      currentIsOnline &&
      !existingIsOnline
    ) {
      const winner = cloneRow(row);
      fillBlanks(winner, existingRow);
      records[dealId] = winner;

      duplicateCount++;

      offlineSkipped++;

      return;
    }


    // Existing Online record stays — fill its blanks from the current (offline) row.
    if (
      existingIsOnline &&
      !currentIsOnline
    ) {
      fillBlanks(existingRow, row);

      duplicateCount++;

      offlineSkipped++;

      return;
    }
    // Both Online or both Offline → keep the first occurrence, but still fill its blanks
    // from this duplicate so a value present only here survives.
    fillBlanks(existingRow, row);
    duplicateCount++;

  });


  return {
    rows:
      Object.keys(records)
        .map(function (dealId) {
          return records[dealId];
        }),

    duplicates:
      duplicateCount,

    offlineSkipped:
      offlineSkipped
  };
}

// Merge rows that share a DEAL ID into ONE complete row (phase 2 — was Record ID).
// Unlike deduplicateGUKRows_ (which picks a single winning row), this fills
// each column from the FIRST non-blank value seen across all rows with that
// Deal ID — so a lead that appears on both a BD sheet and a reseller sheet (SAME
// Deal ID) becomes one row that keeps BOTH the BD-side fields (Getac Sales, etc.)
// and the reseller-side fields (Reseller Comments). First occurrence wins on any
// genuinely conflicting shared cell; blanks are filled from later occurrences.
// Two rows with the same Record ID but DIFFERENT Deal IDs are separate enquiries and
// are NOT merged (they get distinct keys). Rows without a Deal ID cannot be keyed and
// are dropped (should not occur — collection already filters them out).
function mergeGUKRowsById_(rows) {

  const dealIdIndex =
    GUK_ALL_HEADERS.indexOf(
      GUK_DEAL_ID_HEADER
    );

  const order = [];      // preserve first-seen order of Deal IDs
  const byId = {};       // dealId -> merged row object (cloned)
  let mergedCount = 0;

  rows.forEach(function (row) {

    const dealId =
      String(
        row.data[dealIdIndex] || ""
      ).trim();

    if (!dealId) {
      return;
    }

    if (!byId[dealId]) {

      // Clone so we never mutate the caller's row object.
      byId[dealId] = {
        data: row.data.slice(),
        role: row.role,
        country: row.country,
        resellerName: row.resellerName
      };

      order.push(dealId);
      return;
    }

    // Same Deal ID again → fill only the cells still blank in the kept row.
    const kept = byId[dealId].data;

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
        .map(function (id) { return byId[id]; }),
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


    // Only genuine reseller rows get an individual folder + Consolidated sheet.
    // BD rows are excluded so auto-provisioning never creates a folder for a BD
    // entity (or any non-reseller row) that happens to carry a name.
    const resellerNames = [
      ...new Set(
        mappingData
          .filter(function (record) {

            return String(record.role || '')
              .trim()
              .toLowerCase() === 'reseller';

          })
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


        let companyFolder;

        if (folders.hasNext()) {

          companyFolder =
            folders.next();

        } else if (GUK_DRY_RUN) {

          // New reseller from the mapping with no folder yet.
          // Don't create anything in a dry run — just report it,
          // then skip (nothing to write into).
          Logger.log(
            'WOULD CREATE reseller folder + "' +
            GUK_CONSOLIDATED_PREFIX +
            resellerName +
            '": ' +
            resellerName
          );

          return;

        } else {

          // Auto-provision the folder so a brand-new reseller row in
          // the GUK mapping gets its own folder + Consolidated sheet
          // on the next run — no manual folder creation needed.
          companyFolder =
            resellersFolder.createFolder(
              resellerName
            );

          Logger.log(
            'Created reseller folder: ' +
            resellerName
          );

        }


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
