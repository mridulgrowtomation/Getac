/**
 * GETAC — Consolidation Engine (discovery-based, scalable)
 * --------------------------------------------------------------------------
 * Builds the COUNTRY-level and COMPANY-level consolidated `leads_data` sheets
 * by WALKING THE DRIVE FOLDER TREE — no hardcoded country/company lists.
 *
 * Adding a new country (e.g. Austria) requires ZERO code changes: just drop a
 * country folder with the standard subfolders under the region root. The next
 * run discovers it automatically.
 *
 * STRUCTURE IT EXPECTS (per region root):
 *   REGION ROOT
 *    └ <Country>                       (discovered — any subfolder)
 *       ├ name contains "country"       → country consolidated sheet lives here
 *       ├ name contains "bd" or "sales" → BD employee sheets (sources)
 *       └ name contains "reseller"      → <Company> subfolders:
 *                                           employee sheets (sources)
 *                                           + auto-created "Consolidated - <Company>"
 *
 * WHAT IT PRODUCES:
 *   - COUNTRY consolidated `leads_data` = ALL BD + ALL reseller leads in the country.
 *   - COMPANY consolidated `leads_data` = all of one reseller company's employee leads.
 *   Both deduped by Record ID (Col A), columns mapped BY HEADER NAME into one
 *   canonical layout (the BD superset) so reseller rows never shift.
 *
 * OFFLINE LEADS ONLY (per scope). Online leads live in HubSpot, not these sheets.
 *
 * The `dashboard` (charts) tab is NOT built here — those are native pivot-charts
 * set up once in the Sheets UI (out of code scope). This engine owns the DATA.
 *
 * SUPERSEDES the hardcoded country-dashboard.gs once verified — remove that file
 * after this is confirmed working, so the country build isn't done twice.
 *
 * RUN ORDER:
 *   1) buildAllConsolidations() with CN_DRY_RUN = true  → read the log.
 *   2) Flip CN_DRY_RUN = false, run → creates/writes consolidated sheets.
 *   3) installConsolidationCron() → refresh automatically.
 */

// ========================= CONFIG =========================

const CN_DRY_RUN = true;   // true = log only, no create/write. Flip to false to act.

// The ONLY hardcoded structure: region roots. Each must contain the Country folders.
const CN_REGION_ROOTS = {
  'GDE': '1grKBcc2NjTd4x0tFW2NTbeHkxQmqwNH5',
  'GFR': '1qsUgLjjMgqhfgLdpMQ686TdNAnnthMoT'
};

const CN_SOURCE_TAB = 'Leads Data';   // tab inside each BD/reseller employee sheet
const CN_DEST_TAB   = 'leads_data';   // tab inside each consolidated sheet
const CN_ID_COL     = 1;              // Column A = Record ID

// Source header -> canonical (BD) header. Compared lowercased/trimmed.
const CN_HEADER_ALIASES = { 'name': 'last name', 'comments': 'getac sales comments' };

// Columns (canonical header names, lowercased) that are DROPDOWNS in the source
// sheets. setValues() copies text only, NOT validation rules — so after writing
// we re-apply each column's real dropdown rule, read from a source sheet.
// Add more header names here if other columns are dropdowns.
const CN_DROPDOWN_HEADERS = ['lead status'];

// When a consolidated sheet has few/no rows, still show the dropdown on this many
// rows so the column reads as a dropdown for future entries.
const CN_DROPDOWN_MIN_ROWS = 500;

// Folder-name matchers (lowercased substring). Convention: "01 - Country" etc.
const CN_IS_COUNTRY_FOLDER  = function (n) { return n.indexOf('country') !== -1; };
const CN_IS_BD_FOLDER       = function (n) { return n.indexOf('bd') !== -1 || n.indexOf('sales') !== -1; };
const CN_IS_RESELLER_FOLDER = function (n) { return n.indexOf('reseller') !== -1; };

// Consolidated sheets we create are named with this prefix — used to (a) name them
// and (b) recognise + SKIP them when reading sources (never aggregate a rollup).
const CN_CONSOLIDATED_PREFIX = 'Consolidated - ';

// ========================= MAIN =========================

function buildAllConsolidations() {
  Logger.log(CN_DRY_RUN ? '=== CONSOLIDATION DRY RUN (no changes) ===' : '=== CONSOLIDATION LIVE RUN ===');
  Object.keys(CN_REGION_ROOTS).forEach(function (region) {
    const rootId = CN_REGION_ROOTS[region];
    Logger.log('=== REGION ' + region + ' (' + rootId + ') ===');
    let root;
    try { root = DriveApp.getFolderById(rootId); }
    catch (e) { Logger.log('  ❌ cannot open region root: ' + e); return; }

    const countries = root.getFolders();
    while (countries.hasNext()) {
      const cf = countries.next();
      try { buildOneCountry_(cf); }
      catch (e) { Logger.log('  ❌ country "' + cf.getName() + '" failed: ' + e); }
    }
  });
  Logger.log('Done.');
}

function buildOneCountry_(countryFolder) {
  const country = countryFolder.getName();
  Logger.log('— Country: ' + country + ' —');

  // 1) Find the standard subfolders by name convention.
  const subs = { country: null, bd: null, reseller: null };
  const it = countryFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next(); const n = f.getName().toLowerCase();
    if (!subs.country  && CN_IS_COUNTRY_FOLDER(n))  subs.country  = f;
    else if (!subs.bd       && CN_IS_BD_FOLDER(n))       subs.bd       = f;
    else if (!subs.reseller && CN_IS_RESELLER_FOLDER(n)) subs.reseller = f;
  }
  if (!subs.country)  Logger.log('  ⚠️ no "Country" subfolder found — country sheet will be skipped.');
  if (!subs.bd)       Logger.log('  ⚠️ no "BD/Sales" subfolder found.');
  if (!subs.reseller) Logger.log('  ⚠️ no "Reseller" subfolder found.');

  // 2) Find the template source sheet — gives BOTH the canonical (BD superset)
  //    header AND the formatting/dropdown rules to copy onto consolidated sheets.
  const template = cnFindTemplateSource_(subs.bd, subs.reseller);
  if (!template) { Logger.log('  ⚠️ no source has a "Record ID" header — skipping country.'); return; }
  const canonical = template.header;
  const canonNorm = canonical.map(cnNorm_);
  Logger.log('  canonical header: ' + canonical.length + ' cols (template: ' + template.fileId + ')');

  // 3) Gather source files: all BD employee sheets + every reseller company's employee sheets.
  const bdFiles = subs.bd ? cnListSourceSheets_(subs.bd) : [];

  const companyFolders = [];
  if (subs.reseller) {
    const rit = subs.reseller.getFolders();
    while (rit.hasNext()) companyFolders.push(rit.next());
  }

  // 4) COMPANY-level consolidation (one per reseller company) + collect their sources.
  const allResellerFiles = [];
  companyFolders.forEach(function (compFolder) {
    const company = compFolder.getName();
    const empFiles = cnListSourceSheets_(compFolder);
    empFiles.forEach(function (f) { allResellerFiles.push(f); });

    const rows = cnAggregate_(empFiles, canonNorm);
    Logger.log('  [company] ' + company + ': ' + empFiles.length + ' employee sheet(s) → ' + rows.length + ' unique leads');
    const dest = cnFindOrCreateConsolidated_(compFolder, company);
    cnWrite_(dest, canonical, rows, template);
  });

  // 5) COUNTRY-level consolidation = all BD + all reseller sources combined.
  const countryRows = cnAggregate_(bdFiles.concat(allResellerFiles), canonNorm);
  Logger.log('  [country] ' + country + ': ' + bdFiles.length + ' BD + ' + allResellerFiles.length +
             ' reseller sheet(s) → ' + countryRows.length + ' unique leads');
  if (subs.country) {
    const dest = cnFindOrCreateCountrySheet_(subs.country, country);
    cnWrite_(dest, canonical, countryRows, template);
  }
}

// ========================= AGGREGATION =========================

// Combine source files into canonical rows, deduped by Record ID (first seen wins;
// BD passed first at country level so BD wins over reseller for the same lead).
function cnAggregate_(files, canonNorm) {
  const byId = {}, order = [];
  files.forEach(function (f) {
    const src = cnOpenSource_(f.id);
    if (!src) return;
    const map = cnColumnMap_(src.header, canonNorm);
    src.data.forEach(function (r) {
      const id = r[CN_ID_COL - 1];
      if (id === '' || id === null || id === undefined) return;
      const key = String(id);
      if (byId[key] !== undefined) return;        // dedup: first occurrence wins
      byId[key] = map.map(function (si) { return si === -1 ? '' : (r[si] == null ? '' : r[si]); });
      order.push(key);
    });
  });
  return order.map(function (k) { return byId[k]; });
}

// canonical column index -> source column index (or -1), matching by header name+alias.
function cnColumnMap_(srcHeader, canonNorm) {
  const srcNorm = srcHeader.map(function (h) { const n = cnNorm_(h); return CN_HEADER_ALIASES[n] || n; });
  return canonNorm.map(function (cn) { return srcNorm.indexOf(cn); });
}

// Template source = first source whose Col-A header is "Record ID" — BD folder
// preferred (it's the superset), reseller folders as fallback. Returns the header
// AND the source file ID, so the consolidated sheets can copy its header
// formatting + dropdown rules (setValues alone loses those).
function cnFindTemplateSource_(bdFolder, resellerFolder) {
  const pools = [];
  if (bdFolder) pools.push(cnListSourceSheets_(bdFolder));
  if (resellerFolder) {
    const rit = resellerFolder.getFolders();
    while (rit.hasNext()) pools.push(cnListSourceSheets_(rit.next()));
  }
  for (let p = 0; p < pools.length; p++) {
    for (let i = 0; i < pools[p].length; i++) {
      const src = cnOpenSource_(pools[p][i].id);
      if (src && src.header.length && cnNorm_(src.header[0]) === 'record id') {
        return { header: src.header, fileId: pools[p][i].id };
      }
    }
  }
  return null;
}

// ========================= SHEET I/O =========================

function cnOpenSource_(fileId) {
  const sh = SpreadsheetApp.openById(fileId).getSheetByName(CN_SOURCE_TAB);
  if (!sh) return null;
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return { header: [], data: [] };
  return { header: vals[0], data: vals.slice(1) };
}

// List the EMPLOYEE source sheets in a folder: native Google Sheets, excluding
// placeholders ('{ }') and any consolidated rollup we created.
function cnListSourceSheets_(folder) {
  const out = [];
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) {
    const f = it.next(); const name = f.getName();
    if (name.indexOf('{') !== -1 || name.indexOf('}') !== -1) continue;       // placeholder
    if (name.indexOf(CN_CONSOLIDATED_PREFIX) === 0) continue;                  // our rollup
    out.push({ id: f.getId(), name: name });
  }
  return out;
}

// Company rollup: find existing "Consolidated - <Company>" in the company folder, else create.
function cnFindOrCreateConsolidated_(folder, company) {
  const name = CN_CONSOLIDATED_PREFIX + company;
  const ex = folder.getFilesByName(name);
  if (ex.hasNext()) return SpreadsheetApp.openById(ex.next().getId());
  if (CN_DRY_RUN) { Logger.log('    WOULD CREATE "' + name + '"'); return null; }
  const ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  ss.getSheets()[0].setName(CN_DEST_TAB);
  Logger.log('    ✅ created "' + name + '"');
  return ss;
}

// Country rollup: reuse the existing country sheet in the Country folder (prefer one
// that already has a leads_data tab), else create a "<Country> - Consolidated".
function cnFindOrCreateCountrySheet_(folder, country) {
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  let firstSheet = null;
  while (it.hasNext()) {
    const f = it.next(); const name = f.getName();
    if (name.indexOf('{') !== -1 || name.indexOf('}') !== -1) continue;
    const ss = SpreadsheetApp.openById(f.getId());
    if (!firstSheet) firstSheet = ss;
    if (ss.getSheetByName(CN_DEST_TAB)) return ss;     // existing leads_data tab → use it
  }
  if (firstSheet) return firstSheet;                    // fall back to the first sheet present
  if (CN_DRY_RUN) { Logger.log('    WOULD CREATE "' + country + ' - Consolidated"'); return null; }
  const ss = SpreadsheetApp.create(country + ' - Consolidated');
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  ss.getSheets()[0].setName(CN_DEST_TAB);
  Logger.log('    ✅ created "' + country + ' - Consolidated"');
  return ss;
}

// Write canonical header + rows into the dest sheet's leads_data tab (wipe first),
// then re-apply the template's HEADER FORMATTING and DROPDOWN rules — setValues
// copies text only, so without this the header isn't bold and dropdowns show as text.
function cnWrite_(dest, canonical, rows, template) {
  if (!dest) return;                                    // dry-run: nothing created
  if (CN_DRY_RUN) { Logger.log('    (dry run — not written)'); return; }
  let sh = dest.getSheetByName(CN_DEST_TAB);
  if (!sh) sh = dest.insertSheet(CN_DEST_TAB);
  // clear() removes CONTENT but NOT data-validation rules. A reject-style
  // rule left on the Lead Status column from a PREVIOUS run makes the
  // setValues below THROW when a raw source value (e.g. plain "Qualified")
  // doesn't match it — aborting the whole country build. So strip ALL
  // validations UNCONDITIONALLY, using getMaxRows/Cols (which stay non-zero
  // after clear(), unlike getLastRow which becomes 0). Order: validations
  // gone BEFORE any values are written.
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.clear();
  sh.getRange(1, 1, 1, canonical.length).setValues([canonical]);
  if (rows.length) sh.getRange(2, 1, rows.length, canonical.length).setValues(rows);

  if (template && template.fileId) cnApplyTemplateStyling_(sh, canonical, rows.length, template.fileId);
  Logger.log('    ✅ wrote ' + rows.length + ' rows to "' + dest.getName() + '"');
}

// Copy the source header's formatting onto row 1, and re-apply each dropdown
// column's data-validation rule down the data rows. Read from the template source
// once; matched to consolidated columns by header NAME (positions can differ).
function cnApplyTemplateStyling_(destSheet, canonical, dataRowCount, templateFileId) {
  let tplSheet;
  try { tplSheet = SpreadsheetApp.openById(templateFileId).getSheetByName(CN_SOURCE_TAB); }
  catch (e) { Logger.log('    ⚠️ could not open template for styling: ' + e); return; }
  if (!tplSheet) return;

  const tplWidth  = tplSheet.getLastColumn();
  const tplHeader = tplSheet.getRange(1, 1, 1, tplWidth).getValues()[0];
  const tplNorm   = tplHeader.map(cnNorm_);

  // 1) Header row formatting — copyTo() only works WITHIN one spreadsheet, and the
  //    template is a different file, so copy format PROPERTIES manually (cross-file safe).
  const copyCols  = Math.min(canonical.length, tplWidth);
  const tplHdrRng = tplSheet.getRange(1, 1, 1, copyCols);
  destSheet.getRange(1, 1, 1, copyCols)
    .setFontWeights(tplHdrRng.getFontWeights())
    .setFontColors(tplHdrRng.getFontColors())
    .setBackgrounds(tplHdrRng.getBackgrounds())
    .setFontSizes(tplHdrRng.getFontSizes())
    .setFontFamilies(tplHdrRng.getFontFamilies())
    .setFontStyles(tplHdrRng.getFontStyles())
    .setHorizontalAlignments(tplHdrRng.getHorizontalAlignments())
    .setVerticalAlignments(tplHdrRng.getVerticalAlignments())
    .setWraps(tplHdrRng.getWraps());

  // 2) Dropdown rules — for each configured dropdown header, lift the rule from the
  //    template's first data cell in that column and apply it down our data rows.
  const rowsToCover = Math.max(dataRowCount, CN_DROPDOWN_MIN_ROWS);
  if (tplSheet.getLastRow() < 2) return;                 // template has no data row to read a rule from

  // For the Lead Status column, prefer the CANONICAL rule from the shared
  // source sheet (stephane.vivet's, via pdGetSourceRule_ in
  // propagate-dropdown.gs) so consolidated sheets stay consistent with every
  // other sheet and DON'T revert to a stale BD-template value each run.
  // Falls back to the BD template rule if the canonical source is unavailable.
  let canonicalLeadRule = null;
  try { canonicalLeadRule = (typeof pdGetSourceRule_ === 'function') ? pdGetSourceRule_() : null; }
  catch (e) { canonicalLeadRule = null; }

  CN_DROPDOWN_HEADERS.forEach(function (hName) {
    const destCol = canonical.map(cnNorm_).indexOf(hName);
    const tplCol  = tplNorm.indexOf(hName);
    if (destCol === -1 || tplCol === -1) return;          // column not present on one side

    // Use the canonical rule for 'lead status'; template rule otherwise.
    const useCanonical = (hName === 'lead status' && canonicalLeadRule);
    let rule = useCanonical ? canonicalLeadRule : null;
    if (!rule) rule = tplSheet.getRange(2, tplCol + 1).getDataValidation();
    if (!rule) { Logger.log('    (no dropdown rule on "' + hName + '" in template)'); return; }

    // For 'lead status' under the canonical (parens) rule, the raw source
    // values may be plain "Qualified" or the dash variant — both invalid
    // under the parens-only list. Remap the WRITTEN data cells to canonical
    // FIRST so values match the rule (consolidated is a rebuilt rollup, so
    // rewriting values here is safe and never flows back to sources).
    if (useCanonical && dataRowCount > 0) {
      cnRemapLeadStatusValues_(destSheet, destCol + 1, dataRowCount);
    }

    // Apply as SHOW-WARNING (allowInvalid=true), NOT reject. A single odd
    // source value (e.g. a non-standard status one reseller typed) must not
    // abort the whole country rebuild — with reject-invalid, setDataValidation
    // THROWS on any pre-existing out-of-list cell. Warning mode: such a cell
    // shows plain (with a small warning corner) but the build completes.
    let applied = rule;
    try { applied = rule.copy().setAllowInvalid(true).build(); } catch (e) { applied = rule; }
    try {
      destSheet.getRange(2, destCol + 1, rowsToCover, 1).setDataValidation(applied);
    } catch (e) {
      Logger.log('    ⚠️ could not apply "' + hName + '" dropdown: ' + e.message);
    }
  });
}

// Rewrite consolidated Lead Status cells to the canonical value so they
// sit inside the canonical dropdown list (avoids plain/dash values being
// flagged invalid). Mirrors propagate-dropdown.gs's PD_VALUE_REMAP.
function cnRemapLeadStatusValues_(sheet, col1based, dataRowCount) {
  const remap = {
    'Qualified': 'Qualified (to be converted)',
    'Qualified - to be converted': 'Qualified (to be converted)'
  };
  const range = sheet.getRange(2, col1based, dataRowCount, 1);
  const vals = range.getValues();
  let changed = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (Object.prototype.hasOwnProperty.call(remap, t)) { vals[i][0] = remap[t]; changed++; }
  }
  if (changed > 0) range.setValues(vals);
}

function cnNorm_(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

// ========================= TRIGGER =========================

function installConsolidationCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'buildAllConsolidations') exists = true;
  });
  if (exists) { Logger.log('Consolidation cron already installed.'); return; }
  // TESTING: 1-min. Switch to everyMinutes(5) (or longer) for production.
  ScriptApp.newTrigger('buildAllConsolidations').timeBased().everyMinutes(5).create();
  Logger.log('✅ Consolidation cron installed (every 5 min).');
}

function removeConsolidationCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'buildAllConsolidations') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' consolidation cron trigger(s).');
}
