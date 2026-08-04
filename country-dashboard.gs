/**
 * GETAC — Country Dashboard Aggregation
 * --------------------------------------------------------------------------
 * Populates each COUNTRY sheet's "leads_data" tab by COMBINING the leads from
 * every BD clone + reseller clone in that country's folders.
 *
 * WHY HEADER-MAPPING (not whole-row copy like the sync engine):
 *   The BD sheet and Reseller sheet do NOT have identical columns:
 *     - Reseller "Name"     == BD "Last Name"
 *     - Reseller "Comments" == BD "Getac Sales Comments"
 *     - BD-only: "Reseller Name", "Reseller Email", "3rd Party Data Consent"
 *   The BD layout is the SUPERSET, so it is the canonical layout. Each source
 *   sheet is mapped into the canonical layout BY HEADER NAME (with aliases),
 *   so reseller rows never shift. BD-only fields are blank for reseller rows.
 *
 * DEDUPE: by Record ID (Column A). If the same lead exists on a BD sheet and a
 *   reseller sheet, the BD row wins (it carries the extra fields).
 *
 * TAB NAMES (note the casing difference — intentional, matches the live sheets):
 *   - SOURCE clones use:  "Leads Data"  (space, title case)
 *   - COUNTRY sheet uses: "leads_data"  (underscore, lowercase)
 *
 * The "dashboard" (charts) tab is NOT touched here. Charts are authored once by
 * copying the Main Reseller Dashboard layout, then they recalc off leads_data.
 *
 * RUN ORDER:
 *   1) buildCountryDashboards()  with CD_DRY_RUN = true  → read the log.
 *   2) Flip CD_DRY_RUN = false, run again → writes leads_data.
 *   3) (optional later) installCountryCron() → refresh on a schedule.
 */

// ========================= CONFIG =========================

const CD_SOURCE_TAB = 'Leads Data';   // tab inside each BD/reseller clone
const CD_DEST_TAB   = 'leads_data';   // tab inside each country sheet
const CD_ID_COL     = 1;              // Column A = Record ID

const CD_DRY_RUN = true;              // true = log only, no writes. Flip to false to act.

// Where the canonical (superset) header comes from.
//   true  = always derive from a real BD clone (BD layout = the true schema).
//   false = reuse the country tab's existing row-1 header if it has one.
// We force BD because the country tabs currently hold planning notes in row 1,
// not a real leads header.
const CD_FORCE_BD_HEADER = true;

// Reseller (or any source) header  ->  canonical (BD) header. Compared lowercased/trimmed.
const CD_HEADER_ALIASES = {
  'name':     'last name',
  'comments': 'getac sales comments'
};

// Each country: where its combined data lands + which folders to pull sources from.
const CD_COUNTRIES = {
  'Germany': {
    countrySheetId:  '100H7D3YMLl-2FwI_-UNsbICPaQ5-pjlXt7ZUumt-Tyg',
    bdFolder:        '1o41w3kRJTC4jhQyUT-iz2pA7uxXxTwFq',
    resellerFolders: ['1ARqu2HIc9Pe6lTktz1f7cMZXVfhjVd6S', '1cvNtNZiQK9SpN1gvLNIkOBGarHKI6MC5']
  },
  'France': {
    countrySheetId:  '1-fhoCJRcL8Z5kz_0Z74nEiI0ZHnJRGYCTUbc-OCwRsI',
    bdFolder:        '1a-2hH8tAnnFuID0LJQZxKJJHFaW4sMrd',
    resellerFolders: ['18BHhhYdQYI0KRtWAlpuhLTG6uu88T4w-']
  }
};

// ========================= MAIN =========================

function buildCountryDashboards() {
  Logger.log(CD_DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');
  Object.keys(CD_COUNTRIES).forEach(function (country) {
    try {
      buildOneCountry_(country, CD_COUNTRIES[country]);
    } catch (e) {
      Logger.log('❌ ' + country + ' failed: ' + e);
    }
  });
  Logger.log('Done.');
}

function buildOneCountry_(country, cfg) {
  Logger.log('— ' + country + ' —');

  const destSs    = SpreadsheetApp.openById(cfg.countrySheetId);
  const destSheet = destSs.getSheetByName(CD_DEST_TAB);
  if (!destSheet) { Logger.log('  ⚠️ No "' + CD_DEST_TAB + '" tab in country sheet — skipping.'); return; }

  // 1) Decide the canonical header (BD = superset).
  const canonical = resolveCanonicalHeader_(destSheet, cfg.bdFolder);
  if (!canonical || !canonical.length) { Logger.log('  ⚠️ Could not determine canonical header — skipping.'); return; }
  const canonNorm = canonical.map(cdNorm_);

  // 2) Collect source files: BD folder first (BD wins on dedupe), then resellers.
  const bdFiles       = cdListSheetsInFolder_(cfg.bdFolder);
  const resellerFiles = [];
  cfg.resellerFolders.forEach(function (fid) {
    cdListSheetsInFolder_(fid).forEach(function (f) { resellerFiles.push(f); });
  });
  Logger.log('  sources: ' + bdFiles.length + ' BD, ' + resellerFiles.length + ' reseller');

  // 3) Pull + remap rows, dedupe by Record ID (first seen wins → BD wins).
  const byId   = {};   // recordId -> canonical row
  const order  = [];   // preserve insertion order
  const ordered = bdFiles.concat(resellerFiles);

  ordered.forEach(function (f) {
    const got = cdReadAndRemap_(f.id, canonNorm);
    if (!got) { Logger.log('    ⚠️ no "' + CD_SOURCE_TAB + '" in ' + f.name); return; }
    let added = 0, dup = 0;
    got.rows.forEach(function (rec) {
      if (byId[rec.id] === undefined) { byId[rec.id] = rec.row; order.push(rec.id); added++; }
      else dup++;
    });
    Logger.log('    ' + f.name + ': +' + added + ' rows' + (dup ? (', ' + dup + ' dup skipped') : ''));
  });

  const dataRows = order.map(function (id) { return byId[id]; });
  Logger.log('  TOTAL unique leads: ' + dataRows.length);

  if (CD_DRY_RUN) { Logger.log('  (dry run — not written)'); return; }

  // 4) Wipe the whole tab — values AND formatting — so every country tab ends up
  //    visually consistent (no leftover highlights/notes from prior content).
  destSheet.clear();
  destSheet.getRange(1, 1, 1, canonical.length).setValues([canonical]);
  if (dataRows.length) {
    destSheet.getRange(2, 1, dataRows.length, canonical.length).setValues(dataRows);
  }
  Logger.log('  ✅ wrote ' + dataRows.length + ' rows to "' + CD_DEST_TAB + '"');
}

// ========================= HEADER / MAPPING =========================

// Canonical header = the country tab's existing header row if present,
// otherwise the header of the first BD clone (BD layout is the superset).
function resolveCanonicalHeader_(destSheet, bdFolderId) {
  // Reuse the country tab's existing header only if explicitly allowed AND it
  // looks like a real leads header (Column A == "Record ID").
  if (!CD_FORCE_BD_HEADER && destSheet.getLastRow() >= 1 && destSheet.getLastColumn() >= 1) {
    const hdr = destSheet.getRange(1, 1, 1, destSheet.getLastColumn()).getValues()[0];
    if (cdNorm_(hdr[0]) === 'record id') {
      Logger.log('  canonical header: from existing leads_data (' + hdr.length + ' cols)');
      return hdr;
    }
    Logger.log('  (ignoring existing row 1 — not a Record ID header)');
  }

  // Derive from the first BD clone that actually has a "Record ID" header.
  const bd = cdListSheetsInFolder_(bdFolderId);
  for (let i = 0; i < bd.length; i++) {
    const ls = cdOpenSource_(bd[i].id);
    if (ls && ls.header.length && cdNorm_(ls.header[0]) === 'record id') {
      Logger.log('  canonical header: derived from BD clone "' + bd[i].name + '" (' + ls.header.length + ' cols)');
      return ls.header;
    }
  }
  return null;
}

// Open a source clone's "Leads Data": returns {header:[...], data:[[...]]}.
function cdOpenSource_(fileId) {
  const sh = SpreadsheetApp.openById(fileId).getSheetByName(CD_SOURCE_TAB);
  if (!sh) return null;
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return { header: [], data: [] };
  return { header: vals[0], data: vals.slice(1) };
}

// Read a source file and remap every row into the canonical layout (by header).
// Returns { rows: [ {id, row:[canonical-width]} ] }.
function cdReadAndRemap_(fileId, canonNorm) {
  const src = cdOpenSource_(fileId);
  if (!src) return null;

  // Build: canonical column index -> this source's column index (or -1 if absent).
  const srcNorm = src.header.map(function (h) {
    const n = cdNorm_(h);
    return CD_HEADER_ALIASES[n] || n;   // translate aliases into canonical names
  });
  const map = canonNorm.map(function (cn) { return srcNorm.indexOf(cn); });

  const rows = [];
  src.data.forEach(function (r) {
    const id = r[CD_ID_COL - 1];
    if (id === '' || id === null || id === undefined) return;   // skip blank/spacer rows
    const out = map.map(function (si) { return si === -1 ? '' : (r[si] == null ? '' : r[si]); });
    rows.push({ id: String(id), row: out });
  });
  return { rows: rows };
}

function cdNorm_(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

// ========================= DRIVE =========================

// All native Google Sheets directly inside a folder: [{id, name}].
function cdListSheetsInFolder_(folderId) {
  const out = [];
  const it = DriveApp.getFolderById(folderId).getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), name: f.getName() }); }
  return out;
}

// ========================= TRIGGER (optional, for later) =========================

function installCountryCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'buildCountryDashboards') exists = true;
  });
  if (exists) { Logger.log('Country cron already installed.'); return; }
  // TESTING: 1-min for fast feedback. Switch to everyMinutes(5) for production.
  ScriptApp.newTrigger('buildCountryDashboards').timeBased().everyMinutes(1).create();
  Logger.log('✅ Country dashboard cron installed (every 1 min — TESTING).');
}

function removeCountryCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'buildCountryDashboards') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' country cron trigger(s).');
}
