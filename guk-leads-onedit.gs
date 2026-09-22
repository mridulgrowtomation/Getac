/**
 * GETAC — GUK BD/Reseller working-sheet script (replaces "24 Hour lead script.gs")
 * --------------------------------------------------------------------------
 * Bound to each individual "Leads Data" working sheet (e.g. Ellie's / Angelica's
 * "Offline and Online Leads Assignment - <person>@getac.com"). Fixes the two
 * client-reported dropdown issues + the mis-wired status timestamp.
 *
 * WHY THIS REWRITE:
 *   - The old script hard-coded Lead Status = col M(13) and timestamp = col Q(17).
 *     On these sheets M = Telephone Number and Q = Lead Qualification GUK, so the
 *     old onEdit dumped a Date into the Lead Qualification dropdown when a phone #
 *     was edited and NEVER timestamped a real status change. All column lookups
 *     here are HEADER-DRIVEN so they follow the sheet, not fixed positions.
 *   - The Reseller Name -> Reseller Email dependent dropdown was commented out and
 *     never replaced on these sheets, so the email column was blank + free-text.
 *
 * WHAT IT DOES (single onEdit — Apps Script allows only ONE onEdit per project):
 *   1) Lead Status change  -> stamp "Last Updated" with now() (correct columns).
 *   2) Reseller Name change -> look up that name in the hidden "ResellerData" tab
 *      (source of truth, same file). One matching email -> auto-fill + lock the
 *      cell to it; several (e.g. Lexit group/Idnet has 3) -> a dropdown of just
 *      those emails; none -> clear it. The email cell is ALWAYS validated with
 *      allowInvalid=false so a user can't hand-type a value ("lock it down").
 *
 * "RANDOM MISSING DROPDOWN" FIX (root-cause, no cron): validation on these sheets
 * was inherited from a template, never script-created, so it got stripped by
 * (a) full-cell paste (Ctrl+V overwrites the target's rule with the copied cell's).
 * Fixed at source: the Reseller Name rule is applied to the WHOLE column (row 2 ->
 * max rows), so it persists column-wide (setValues-appended rows keep it), and
 * onEdit re-stamps the edited rows to heal a paste-clobber the instant it happens.
 *
 * ONE-TIME: run ldStampAllRows() once to apply the Reseller Name dropdown + the
 * dependent Reseller Email to every EXISTING row (onEdit only fires on manual edits).
 * AFTER THAT it stays current on its own: editing the ResellerData tab auto-re-runs
 * ldStampAllRows (see onEdit), so adding/changing a reseller needs no manual re-run.
 *
 * SCOPE NOTE: the 24-hour hide functions (checkLeadStatus / rehideInvalidRows /
 * unhideAllRows) are intentionally LEFT AS-IS for now (still reference the legacy
 * M/Q columns, so they remain inert — same as before this change). Reworking that
 * behaviour was deferred by the client. Fix them in a later pass if the auto-hide
 * is wanted (make header-driven, un-hide on reopen, decide hide-vs-delete).
 */

// ========================= CONFIG =========================

const LD_LEADS_TAB         = 'Leads Data';
const LD_RESELLER_DATA_TAB = 'ResellerData';

// Header names matched on the Leads Data tab (case/space-insensitive).
const LD_H_STATUS       = 'Lead Status';
const LD_H_RES_NAME     = 'Reseller Name';
const LD_H_RES_EMAIL    = 'Reseller Email';

// The timestamp column is spelled differently across sheets ("Last Update" on
// Ellie's, "Last Updated" on others). Match ANY of these (first one found wins).
const LD_H_LAST_UPDATED_ALIASES = ['Last Update', 'Last Updated', 'Last Modified', 'Updated At'];

// ========================= onEdit (simple trigger) =========================

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  // Editing the ResellerData source (e.g. the POC adds/edits a reseller) -> refresh
  // the Reseller Name dropdown list + dependent emails on Leads Data automatically.
  // Event-driven, so no cron and no manual ldStampAllRows re-run is needed. Fires on
  // manual edits; a script that ever populates ResellerData should call ldStampAllRows
  // itself. Programmatic writes below don't re-fire onEdit, so there's no loop.
  if (sheet.getName() === LD_RESELLER_DATA_TAB) { ldStampAllRows(); return; }

  if (sheet.getName() !== LD_LEADS_TAB) return;

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(ldNorm_);
  const statusCol      = headers.indexOf(ldNorm_(LD_H_STATUS)) + 1;        // 0 if missing
  const lastUpdatedCol = ldFindCol_(headers, LD_H_LAST_UPDATED_ALIASES);   // 0 if none match
  const resNameCol     = headers.indexOf(ldNorm_(LD_H_RES_NAME)) + 1;
  const resEmailCol    = headers.indexOf(ldNorm_(LD_H_RES_EMAIL)) + 1;

  const firstCol = e.range.getColumn();
  const lastEditedCol = firstCol + e.range.getNumColumns() - 1;
  const firstRow = e.range.getRow();
  const lastEditedRow = firstRow + e.range.getNumRows() - 1;

  const spans = function (col) { return col && firstCol <= col && lastEditedCol >= col; };

  // 1) Lead Status changed -> (was) stamp "Last Updated". DISABLED: the POC asked for the
  // "Last Updated" field to be removed from the GUK sheets, so we no longer write a
  // timestamp into it (writing would just re-populate a column we're deleting — see
  // gsRemoveLastUpdatedColumns() in guk-sync.gs). Re-enable by uncommenting if the field
  // is ever reinstated.
  // if (spans(statusCol) && lastUpdatedCol) {
  //   for (let r = Math.max(firstRow, 2); r <= lastEditedRow; r++) {
  //     sheet.getRange(r, lastUpdatedCol).setValue(new Date());
  //   }
  // }

  // 2) Reseller Name changed -> rebuild the dependent Reseller Email.
  if (spans(resNameCol) && resEmailCol) {
    const rd = ldGetResellerData_(e.source);
    const startRow = Math.max(firstRow, 2);
    // Heal any Name-dropdown rule a paste may have wiped on the edited rows.
    if (rd.names.length) {
      sheet.getRange(startRow, resNameCol, lastEditedRow - startRow + 1, 1)
        .setDataValidation(ldNameRule_(rd.names));
    }
    for (let r = startRow; r <= lastEditedRow; r++) {
      const name = String(sheet.getRange(r, resNameCol).getValue() || '').trim();
      ldApplyEmailForRow_(sheet, r, resEmailCol, name, rd.map);
    }
  }
}

// ========================= DEPENDENT EMAIL LOGIC =========================

// Read the hidden ResellerData tab -> { map: {name(lower): [emails]}, names: [distinct names] }.
function ldGetResellerData_(ss) {
  const out = { map: {}, names: [] };
  const sh = ss.getSheetByName(LD_RESELLER_DATA_TAB);
  if (!sh) return out;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return out;

  const vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const h = vals[0].map(ldNorm_);
  const nameCol  = h.indexOf(ldNorm_(LD_H_RES_NAME));
  const emailCol = h.indexOf(ldNorm_(LD_H_RES_EMAIL));
  if (nameCol === -1 || emailCol === -1) return out;

  for (let i = 1; i < vals.length; i++) {
    const nm = String(vals[i][nameCol]  || '').trim();
    const em = String(vals[i][emailCol] || '').trim();
    if (!nm) continue;
    const key = nm.toLowerCase();
    if (!out.map[key]) { out.map[key] = []; out.names.push(nm); }
    if (em && out.map[key].indexOf(em) === -1) out.map[key].push(em);
  }
  return out;
}

// Apply the correct Reseller Email validation (+ value) for one row.
//   0 emails  -> clear the cell + drop validation (name isn't a known reseller).
//   1 email   -> auto-fill it and lock the cell to that single value.
//   2+ emails -> dropdown of just those emails; clear the value if it isn't one of them.
// The rule is always allowInvalid=false, so a user can never hand-type an email.
function ldApplyEmailForRow_(sheet, row, emailCol, name, map) {
  const cell = sheet.getRange(row, emailCol);
  const emails = name ? (map[name.toLowerCase()] || []) : [];

  if (!emails.length) {
    cell.setDataValidation(null);
    cell.clearContent();
    return;
  }

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(emails, true)
    .setAllowInvalid(false)
    .build();
  cell.setDataValidation(rule);

  if (emails.length === 1) {
    cell.setValue(emails[0]);
  } else {
    const cur = String(cell.getValue() || '').trim();
    if (emails.indexOf(cur) === -1) cell.clearContent();
  }
}

// ========================= ONE-TIME / MAINTENANCE PASS =========================

// Apply the Reseller Name dropdown + the dependent Reseller Email to every existing
// row. Run this once after pasting the script (onEdit won't fire on rows that are
// already there). Safe to re-run any time.
function ldStampAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LD_LEADS_TAB);
  if (!sheet) { Logger.log('No "' + LD_LEADS_TAB + '" tab.'); return; }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(ldNorm_);
  const nameCol  = headers.indexOf(ldNorm_(LD_H_RES_NAME)) + 1;
  const emailCol = headers.indexOf(ldNorm_(LD_H_RES_EMAIL)) + 1;
  if (!nameCol || !emailCol) { Logger.log('Reseller Name/Email header not found.'); return; }

  const rd = ldGetResellerData_(ss);
  if (!rd.names.length) { Logger.log('ResellerData missing/empty — nothing to apply.'); return; }

  const lastRow = sheet.getLastRow();
  const rows = Math.max(lastRow - 1, 1);

  // Standing Reseller Name dropdown across the WHOLE column (row 2 -> max rows) so
  // rows appended later (manually or by the consolidation/sync) already have it.
  const maxRows = sheet.getMaxRows();
  sheet.getRange(2, nameCol, maxRows - 1, 1).setDataValidation(ldNameRule_(rd.names));

  if (lastRow < 2) { Logger.log('Applied Reseller Name dropdown; no data rows for email pass.'); return; }

  const nameVals = sheet.getRange(2, nameCol, rows, 1).getValues();
  for (let i = 0; i < nameVals.length; i++) {
    const name = String(nameVals[i][0] || '').trim();
    ldApplyEmailForRow_(sheet, i + 2, emailCol, name, rd.map);
  }
  Logger.log('Applied Reseller Name dropdown + dependent Reseller Email to ' + rows + ' row(s).');
}

// ========================= HELPERS =========================

function ldNorm_(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

// Find the 1-based column for the first matching header name (0 if none). `headers`
// is already normalised via ldNorm_. Used for headers that vary across sheets.
function ldFindCol_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const idx = headers.indexOf(ldNorm_(names[i]));
    if (idx !== -1) return idx + 1;
  }
  return 0;
}

// Reseller Name dropdown rule. allowInvalid=true so legacy/typed names only warn,
// never get blocked (the LOCK is on the email cell, not the name cell).
function ldNameRule_(names) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(names, true)
    .setAllowInvalid(true)
    .build();
}

// ========================= 24-HOUR MAINTENANCE (UNCHANGED — see SCOPE NOTE) =========================
// Left exactly as they were: still reference the legacy M(13)/Q(17) columns, so they
// remain inert on these sheets. Rework deferred (header-driven + un-hide on reopen).

function checkLeadStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads Data");
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now = new Date();

  const statusCol = 13;     // Column M
  const timestampCol = 17;  // Column Q

  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    const status = data[i][statusCol - 1];
    const lastUpdated = data[i][timestampCol - 1];

    if (!status || !lastUpdated || !(lastUpdated instanceof Date)) continue;

    const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);

    if (status !== "Open" && status !== "In Process" && hoursPassed >= 24) {
      sheet.hideRows(row);
      sheet.getRange(row, statusCol).setNote(`Row hidden at ${now.toLocaleTimeString()}`);
    }
  }
}

function unhideAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads Data");
  const lastRow = sheet.getLastRow();
  sheet.showRows(2, lastRow - 1); // Keep header visible
}

function rehideInvalidRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads Data");
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const statusCol = 13;     // Column M
  const timestampCol = 17;  // Column Q

  for (let i = 1; i < data.length; i++) {
    const row = i + 1;
    const status = data[i][statusCol - 1];
    const lastUpdated = data[i][timestampCol - 1];

    if (!status || !lastUpdated || !(lastUpdated instanceof Date)) continue;

    const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);
    if (status !== "Open" && status !== "In Process" && hoursPassed >= 24) {
      sheet.hideRows(row);
    }
  }
}
