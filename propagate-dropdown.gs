// ============================================================
// PROPAGATE LEAD STATUS DROPDOWN  (all synced levels)
// ------------------------------------------------------------
// Copies the CORRECT Lead Status dropdown (list + colored chips)
// from ONE known-good source sheet onto every relevant sheet across
// all levels, and remaps old cell values so they don't turn into
// plain text after a rename.
//
// WHY A "COPY" AND NOT A "REBUILD":
//   Apps Script canNOT set the per-value chip COLORS on a dropdown.
//   So instead of rebuilding the list, we lift the WHOLE validation
//   rule from a good sheet (colors ride along) and stamp it on the
//   others. Two-way sync uses setValues() which copies TEXT ONLY —
//   it can never carry a dropdown rule to a clone. This script is the
//   only thing that pushes the rule itself (setDataValidation).
//
// LEVELS COVERED (France + Germany scope ONLY):
//   1. Registry ORIGINALS  (col B) — filtered to FR/DE via mapping sheet
//   2. Registry CLONES     (col C) — filtered to FR/DE via mapping sheet
//   3. Reseller employee sheets in the country folders
//   3b. BD employee sheets (SYNC_FOLDERS_BY_COUNTRY bdFolder)
//   4. CONSOLIDATED files  ("Consolidated - X" + country rollups)
//   Deduped by spreadsheet ID; the source sheet is never stamped.
//
// DELIBERATELY EXCLUDED: the global dashboard - {S} files (Dashboard
// Links tab) — worldwide Master-script system, out of FR/DE scope.
//
// SOURCE OF TRUTH:
//   stephane.vivet's sheet — confirmed correct list + colors.
//
// RECOMMENDED FLOW (safe -> prod)
//   1) pdDryRunAll()          -> touches NOTHING. Logs source list +
//                                per-sheet plan across ALL levels.
//   2) pdRunOne('<sheetId>')  -> writes to ONE sheet only (verify chips!)
//   3) pdRunAll()             -> writes to every sheet, all levels.
//
// Must live in the SAME Apps Script project as consolidation.gs +
// two-way-sync.gs — it reuses their config/helpers (CN_REGION_ROOTS,
// CN_IS_RESELLER_FOLDER, cnListSourceSheets_, CN_CONSOLIDATED_PREFIX,
// SYNC_FOLDERS_BY_COUNTRY, getRegistrySheet_, LINKS_SHEET_NAME,
// normalizeKey_).
// ============================================================

// stephane.vivet's spreadsheet ID (the known-good source).
const PD_SOURCE_SHEET_ID = '1M81P_KR0-UVnB8cp-mYo_SiYIsIqtwut73DTX2uoubA';

// Tab names to try FIRST when locating the Lead Status column. If none
// match, the script scans every tab for a Lead Status header. This makes
// it work across 'Leads Data' (registry/dashboard) and 'leads_data'
// (consolidated) without per-source config.
const PD_CANDIDATE_TABS = ['Leads Data', 'leads_data'];

// Header text(s) that identify the Lead Status column (any casing).
const PD_LEAD_STATUS_HEADERS = ['Lead Status', 'Status (SF)'];

// Old value -> new value. Existing cells holding the old text are
// rewritten so they stay inside the (renamed) dropdown list.
// EXACT string matters — data validation matches char-for-char.
const PD_VALUE_REMAP = {
  'Qualified': 'Qualified (to be converted)',
  'Qualified - to be converted': 'Qualified (to be converted)',  // dash variant → canonical
};

// Labels considered genuinely WRONG (must be fixed). The wrong-label gate
// (pdRunAll / pdDryRunAll) only stamps sheets whose current list contains
// one of these. The dash variant is intentionally NOT here — it's an
// accepted spelling, so dash-variant sheets are left untouched (colors kept).
const PD_WRONG_LABELS = ['Qualified'];

// ========================= ENTRY POINTS =========================

// DRY RUN — writes nothing. Reports the source list + per-sheet plan.
// Honors the wrong-label-only gate, so the dry run reflects what the
// wide run will actually touch.
function pdDryRunAll() {
  pdRun_({ dryRun: true, onlyId: null, onlyWrongLabel: true });
}

// TEST — actually writes, but only to ONE sheet (paste its ID).
// FORCES the write (ignores the wrong-label gate) so you can test any sheet.
function pdRunOne(fileId) {
  if (!fileId) { Logger.log('❌ pdRunOne needs a file ID.'); return; }
  pdRun_({ dryRun: false, onlyId: normalizeKey_(fileId), onlyWrongLabel: false });
}

// GO LIVE — writes to every relevant sheet, but ONLY those whose list
// still has the wrong plain "Qualified" label. Sheets already using a
// converted form (parentheses OR dash) are LEFT UNTOUCHED so their
// colored chips are preserved (both spellings are acceptable).
function pdRunAll() {
  pdRun_({ dryRun: false, onlyId: null, onlyWrongLabel: true });
}

// TEST WRAPPER — kaan.karakaya's original. Select this in the function
// dropdown and Run (no argument needed). Delete after testing.
function pdTestKaan() {
  pdRunOne("1_uuKQTB6xrUABcWTCeKbvBBlyp2BiMsvaVpPGJtQHik");
}

// ========================= CORE =========================

function pdRun_(opts) {
  const dryRun = !!opts.dryRun;
  const onlyId = opts.onlyId || null;
  const onlyWrongLabel = !!opts.onlyWrongLabel;   // skip sheets already using a converted form
  const tag = dryRun ? '[DRY RUN] ' : '';

  Logger.log(tag + '======== PROPAGATE LEAD STATUS DROPDOWN ========');

  // 1) Read the CORRECT rule from the source sheet (list + chips).
  const sourceRule = pdGetSourceRule_();
  if (!sourceRule) return;   // pdGetSourceRule_ already logged why
  pdLogRuleValues_(sourceRule, tag);

  // 2) Collect targets.
  let targets;
  if (onlyId) {
    targets = [{ level: 'single', name: '(single target)', id: onlyId }];
  } else {
    targets = pdCollectAllTargets_();
  }
  // Never stamp the source itself.
  targets = targets.filter(function (t) { return t.id !== PD_SOURCE_SHEET_ID; });
  Logger.log(tag + 'Target sheet(s): ' + targets.length);

  // Source list, for orphan detection (values not in it + not remapped).
  const sourceVals = pdRuleValues_(sourceRule) || [];

  let ok = 0, skipped = 0, failed = 0, totalRemap = 0, totalOrphan = 0;
  targets.forEach(function (entry) {
    try {
      const found = pdOpenLeadStatusSheet_(entry.id);
      if (!found) {
        Logger.log(tag + '  ⏭️  [' + entry.level + '] ' + entry.name + ' — no Lead Status tab/header. Skipped.');
        skipped++; return;
      }
      const listState = pdCompareList_(found.sheet, found.col, sourceRule);

      // Wrong-label gate: only touch sheets whose CURRENT list still has a
      // plain wrong label (a PD_VALUE_REMAP key like "Qualified"). Sheets
      // already on a converted form (parentheses or dash) are skipped so
      // their colored chips are preserved. Applied to dry-run + pdRunAll;
      // pdRunOne forces the write (onlyWrongLabel = false).
      if (onlyWrongLabel && !pdHasWrongLabel_(found.sheet, found.col)) {
        Logger.log(tag + '  ⏭️  [' + entry.level + '] ' + entry.name +
          ' — already converted (list ' + listState + '). Left untouched (keeps colors).');
        skipped++; return;
      }

      const res = pdApplyToSheet_(found.sheet, found.col, sourceRule, dryRun, sourceVals);
      totalRemap += res.remapped;
      totalOrphan += res.orphans.length;
      const orphanNote = res.orphans.length
        ? '  ⚠️ ORPHAN cell values (would go plain-text): [' + res.orphans.join(' | ') + ']'
        : '';
      Logger.log(tag + '  ✅ [' + entry.level + '] ' + entry.name + ' — list ' + listState +
        ', rule ' + (dryRun ? 'WOULD apply' : 'applied') +
        ', ' + res.remapped + ' cell(s) ' + (dryRun ? 'WOULD BE ' : '') + 'remapped.' + orphanNote);
      ok++;
    } catch (e) {
      Logger.log(tag + '  ❌ [' + entry.level + '] ' + entry.name + ' (' + entry.id + ') — ' + e.message);
      failed++;
    }
  });

  Logger.log(tag + '──────── SUMMARY ────────');
  Logger.log(tag + 'Sheets OK: ' + ok + '  |  Skipped: ' + skipped + '  |  Failed: ' + failed);
  Logger.log(tag + 'Total cells ' + (dryRun ? 'that WOULD BE ' : '') + 'remapped: ' + totalRemap);
  Logger.log(tag + 'Total ORPHAN cells (would go plain-text — fix remap!): ' + totalOrphan);
  if (dryRun) Logger.log('[DRY RUN] Nothing written. Use pdRunOne(id) then pdRunAll() to apply.');
}

// Apply the rule to the whole Lead Status column of one sheet, and
// remap existing cell values per PD_VALUE_REMAP. Also detect ORPHANS:
// non-empty cell values that (after remap) are NOT in the new source
// list — those would render as plain text under the new dropdown.
// In dryRun, counts only — writes nothing.
// Returns { remapped, orphans: [distinct orphan values] }.
function pdApplyToSheet_(sheet, col, rule, dryRun, sourceVals) {
  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(lastRow - 1, 1); // >=1 so the dropdown shows
  const range = sheet.getRange(2, col, rowCount, 1);
  const allowed = {};
  (sourceVals || []).forEach(function (v) { allowed[v] = true; });

  let remapped = 0;
  const orphanSet = {};
  let newVals = null;
  if (lastRow > 1) {
    const vals = range.getValues();
    for (let i = 0; i < vals.length; i++) {
      const cur = vals[i][0];
      if (typeof cur !== 'string') continue;
      const trimmed = cur.trim();
      if (trimmed === '') continue;
      if (Object.prototype.hasOwnProperty.call(PD_VALUE_REMAP, trimmed)) {
        vals[i][0] = PD_VALUE_REMAP[trimmed];
        remapped++;
      } else if (sourceVals && sourceVals.length && !allowed[trimmed]) {
        // Won't be remapped AND isn't in the new list → orphan.
        orphanSet[trimmed] = true;
      }
    }
    newVals = vals;
  }

  // ORDER MATTERS: set the new validation rule FIRST, then write the
  // remapped values. The old rule rejects invalid input, so writing
  // "Qualified (to be converted)" before swapping the rule would be
  // rejected by the OLD rule (only allows "Qualified"). New rule first
  // means the remapped values are valid when written.
  if (!dryRun) {
    range.setDataValidation(rule);
    if (remapped > 0 && newVals) range.setValues(newVals);
  }
  return { remapped: remapped, orphans: Object.keys(orphanSet) };
}

// ========================= STAMP ONE CLONE (for onboarding) =========================
// Called by onboarding right after a clone is created, so every new sheet
// is BORN with the correct Lead Status dropdown regardless of what its
// original had. Never throws — logs and returns false on any problem.
var PD_SOURCE_RULE_CACHE_ = null;

function pdGetSourceRule_() {
  if (PD_SOURCE_RULE_CACHE_) return PD_SOURCE_RULE_CACHE_;
  if (!PD_SOURCE_SHEET_ID) { Logger.log('❌ PD_SOURCE_SHEET_ID is empty.'); return null; }
  try {
    const found = pdOpenLeadStatusSheet_(PD_SOURCE_SHEET_ID);
    if (!found) { Logger.log('❌ Source sheet has no Lead Status tab/header.'); return null; }
    const rule = found.sheet.getRange(2, found.col).getDataValidation();
    if (!rule) { Logger.log('❌ No data-validation rule on source Lead Status column.'); return null; }
    PD_SOURCE_RULE_CACHE_ = rule;
    return rule;
  } catch (e) {
    Logger.log('❌ Cannot read source rule — ' + e.message);
    return null;
  }
}

function pdStampClone_(cloneId) {
  const rule = pdGetSourceRule_();
  if (!rule) return false;
  try {
    const found = pdOpenLeadStatusSheet_(cloneId);
    if (!found) { Logger.log('pdStampClone_: clone ' + cloneId + ' has no Lead Status tab/header.'); return false; }
    const res = pdApplyToSheet_(found.sheet, found.col, rule, false, pdRuleValues_(rule) || []);
    Logger.log('   🎨 stamped dropdown on clone ' + cloneId + ' (' + res.remapped + ' cell(s) remapped).');
    return true;
  } catch (e) {
    Logger.log('pdStampClone_: failed on clone ' + cloneId + ' — ' + e.message);
    return false;
  }
}

// ========================= TARGET DISCOVERY =========================

// Gather every target across all levels, deduped by spreadsheet ID.
// Each entry: { level, name, id }.
function pdCollectAllTargets_() {
  const out = [];
  const seen = {};
  function add(level, name, id) {
    id = normalizeKey_(id);
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push({ level: level, name: name || '(unnamed)', id: id });
  }

  // SCOPE = France + Germany ONLY. The mapping sheet is the source of
  // truth for country, so we build the set of in-scope emails from it and
  // use that to filter the (country-less) SyncRegistry.
  const inScopeEmails = pdInScopeEmails_();  // Set-like {emailLower: true}

  // 1+2) Registry originals (col B) + clones (col C) — FR/DE rows only.
  try {
    const reg = getRegistrySheet_();
    const data = reg.getDataRange().getValues();
    let kept = 0, dropped = 0;
    for (let i = 1; i < data.length; i++) {
      const label = normalizeKey_(data[i][0]);
      if (!inScopeEmails[label.toLowerCase()]) { dropped++; continue; } // out of FR/DE scope
      add('orig',  'orig: ' + label,  data[i][1]);
      add('clone', 'clone: ' + label, data[i][2]);
      kept++;
    }
    Logger.log('  registry: kept ' + kept + ' FR/DE row(s), dropped ' + dropped + ' out-of-scope.');
  } catch (e) {
    Logger.log('  ⚠️ could not read SyncRegistry: ' + e.message);
  }

  // 3) Reseller employee sheets + 4) consolidated files, by walking the tree.
  Object.keys(CN_REGION_ROOTS).forEach(function (region) {
    let root;
    try { root = DriveApp.getFolderById(CN_REGION_ROOTS[region]); }
    catch (e) { Logger.log('  ⚠️ region root ' + region + ' unreadable: ' + e.message); return; }

    const countries = root.getFolders();
    while (countries.hasNext()) {
      const country = countries.next();
      const subs = country.getFolders();
      while (subs.hasNext()) {
        const sub = subs.next();
        const subName = sub.getName().toLowerCase();

        if (CN_IS_RESELLER_FOLDER(subName)) {
          // company subfolders → employee sheets + any consolidated rollup
          const companies = sub.getFolders();
          while (companies.hasNext()) {
            const comp = companies.next();
            cnListSourceSheets_(comp).forEach(function (f) {   // excludes consolidated + placeholders
              add('reseller', comp.getName() + ' / ' + f.name, f.id);
            });
            pdListConsolidated_(comp).forEach(function (f) {
              add('consol', f.name, f.id);
            });
          }
        }
        // country subfolder (or anywhere) may hold a consolidated country sheet
        pdListConsolidated_(sub).forEach(function (f) {
          add('consol', f.name, f.id);
        });
      }
    }
  });

  // 3b) BD employee sheets — walk the BD folders from SYNC_FOLDERS_BY_COUNTRY.
  Object.keys(SYNC_FOLDERS_BY_COUNTRY).forEach(function (country) {
    const bdFolderId = SYNC_FOLDERS_BY_COUNTRY[country].bdFolder;
    if (!bdFolderId) return;
    try {
      const folder = DriveApp.getFolderById(bdFolderId);
      const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      while (it.hasNext()) {
        const f = it.next();
        const name = f.getName();
        if (name.indexOf('{') !== -1 || name.indexOf('}') !== -1) continue; // placeholder
        add('bd', country + ' BD / ' + name, f.getId());
      }
    } catch (e) {
      Logger.log('  ⚠️ ' + country + ' BD folder unreadable: ' + e.message);
    }
  });

  // NOTE: dashboard - {S} files are DELIBERATELY EXCLUDED — they belong to
  // the global Master-script dashboard system (worldwide), outside the
  // France/Germany offline-leads scope, and most never had this dropdown.

  return out;
}

// Build the set of in-scope emails (France + Germany) from the mapping
// sheet. Returns { emailLower: true }. Used to filter the country-less
// SyncRegistry so we never touch out-of-scope (e.g. Nordic) sheets.
function pdInScopeEmails_() {
  const set = {};
  try {
    const ss = SpreadsheetApp.openById(SYNC_MAPPING_SHEET_ID);
    const sh = ss.getSheetByName(SYNC_MAPPING_TAB);
    if (!sh) { Logger.log('  ⚠️ mapping tab not found — registry scope will be empty.'); return set; }
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      const country = String(v[i][M_COL_COUNTRY - 1] || '').trim().toLowerCase();
      const email   = String(v[i][M_COL_EMAIL - 1]   || '').trim().toLowerCase();
      if (!email) continue;
      if (country === 'france' || country === 'germany') set[email] = true;
    }
  } catch (e) {
    Logger.log('  ⚠️ could not read mapping for scope: ' + e.message);
  }
  return set;
}

// List Google Sheets in a folder whose name starts with the consolidated
// prefix (the rollups consolidation.gs creates).
function pdListConsolidated_(folder) {
  const out = [];
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(CN_CONSOLIDATED_PREFIX) === 0) {
      out.push({ id: f.getId(), name: f.getName() });
    }
  }
  return out;
}

// ========================= HELPERS =========================

// Open a spreadsheet by ID and return { sheet, col } for the tab holding
// the Lead Status column. Tries PD_CANDIDATE_TABS first, then scans all
// tabs. Returns null if no tab has a Lead Status header.
function pdOpenLeadStatusSheet_(id) {
  const ss = SpreadsheetApp.openById(id);

  // Preferred tabs first (fast path).
  for (let i = 0; i < PD_CANDIDATE_TABS.length; i++) {
    const sh = ss.getSheetByName(PD_CANDIDATE_TABS[i]);
    if (sh) {
      const col = pdFindHeaderColumn_(sh);
      if (col !== -1) return { sheet: sh, col: col };
    }
  }
  // Fallback: scan every tab.
  const all = ss.getSheets();
  for (let i = 0; i < all.length; i++) {
    const col = pdFindHeaderColumn_(all[i]);
    if (col !== -1) return { sheet: all[i], col: col };
  }
  return null;
}

// Find a column index (1-based) matching ANY name in
// PD_LEAD_STATUS_HEADERS, case-insensitive + space-normalized. -1 if none.
function pdFindHeaderColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const targets = PD_LEAD_STATUS_HEADERS.map(function (h) {
    return normalizeKey_(h).toLowerCase();
  });
  for (let i = 0; i < headers.length; i++) {
    const cell = normalizeKey_(headers[i]).toLowerCase();
    if (targets.indexOf(cell) !== -1) return i + 1;
  }
  return -1;
}

// True if the sheet's CURRENT Lead Status list contains a wrong label —
// a PD_VALUE_REMAP key that maps to something different (e.g. plain
// "Qualified"). Used by the wrong-label gate: sheets already using a
// converted form return false and are left untouched (colors preserved).
function pdHasWrongLabel_(sheet, col) {
  const cur = sheet.getRange(2, col).getDataValidation();
  if (!cur) return false;                 // no rule → leave alone (would only ADD a colorless dropdown)
  const vals = pdRuleValues_(cur);
  if (vals === null) return false;        // not a list rule → don't clobber it
  for (let i = 0; i < vals.length; i++) {
    if (PD_WRONG_LABELS.indexOf(vals[i]) !== -1) return true;  // carries a genuinely wrong label
  }
  return false;
}

// Compare a sheet's current dropdown list to the source rule's list.
// Returns 'MATCHES', 'DIFFERS: [...]', 'NO RULE', or 'NOT-A-LIST'.
function pdCompareList_(sheet, col, sourceRule) {
  const cur = sheet.getRange(2, col).getDataValidation();
  if (!cur) return 'NO RULE (would gain dropdown)';
  const curVals = pdRuleValues_(cur);
  const srcVals = pdRuleValues_(sourceRule);
  if (curVals === null) return 'NOT-A-LIST rule';
  if (curVals.join('') === srcVals.join('')) return 'MATCHES';
  return 'DIFFERS: [' + curVals.join(' | ') + ']';
}

// Return the allowed-values array of a VALUE_IN_LIST rule, or null.
function pdRuleValues_(rule) {
  try {
    const args = rule.getCriteriaValues();
    if (args && args[0] && args[0].join) return args[0];
    return null;
  } catch (e) { return null; }
}

// Log the allowed values inside a rule (dry run proof).
function pdLogRuleValues_(rule, tag) {
  try {
    const crit = rule.getCriteriaType();
    const args = rule.getCriteriaValues();
    Logger.log(tag + 'Source rule type: ' + crit);
    if (args && args[0] && args[0].join) {
      Logger.log(tag + 'Allowed values: [' + args[0].join(' | ') + ']');
    }
  } catch (e) {
    Logger.log(tag + '(could not read rule values: ' + e.message + ')');
  }
}

// ========================= BD SCAN (READ-ONLY) =========================
// Walks the BD folders and reports each BD sheet's current Lead Status
// list. Writes NOTHING — pure investigation.
function pdScanBDClones() {
  Logger.log('======== BD CLONE SCAN (read-only) ========');
  let count = 0, missingRule = 0, hasQualifiedPlain = 0;

  Object.keys(SYNC_FOLDERS_BY_COUNTRY).forEach(function (country) {
    const bdFolderId = SYNC_FOLDERS_BY_COUNTRY[country].bdFolder;
    if (!bdFolderId) return;
    let folder;
    try { folder = DriveApp.getFolderById(bdFolderId); }
    catch (e) { Logger.log('  ❌ ' + country + ' BD folder unreadable: ' + e.message); return; }

    Logger.log('— ' + country + ' BD folder (' + bdFolderId + ') —');
    const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      if (name.indexOf('{') !== -1 || name.indexOf('}') !== -1) continue;   // placeholder
      count++;
      try {
        const found = pdOpenLeadStatusSheet_(f.getId());
        if (!found) { Logger.log('  ⏭️  ' + name + ' — no Lead Status tab/header.'); continue; }
        const rule = found.sheet.getRange(2, found.col).getDataValidation();
        if (!rule) { Logger.log('  ⚠️  ' + name + ' — NO dropdown rule.'); missingRule++; continue; }
        const vals = pdRuleValues_(rule);
        if (vals === null) { Logger.log('  ⚠️  ' + name + ' — not a value-list rule.'); continue; }
        const hasPlain = vals.indexOf('Qualified') !== -1;
        if (hasPlain) hasQualifiedPlain++;
        Logger.log('  ' + (hasPlain ? '❌' : '✅') + '  ' + name + ' — [' + vals.join(' | ') + ']');
      } catch (e) {
        Logger.log('  ❌ ' + name + ' (' + f.getId() + ') — ' + e.message);
      }
    }
  });

  Logger.log('──────── SCAN SUMMARY ────────');
  Logger.log('BD sheets scanned: ' + count +
    '  |  with plain "Qualified": ' + hasQualifiedPlain +
    '  |  missing rule: ' + missingRule);
}
