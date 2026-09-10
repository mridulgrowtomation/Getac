/**
 * GETAC — GUK (UK & Nordics) Reseller → BD field sync
 * --------------------------------------------------------------------------
 * ONE-WAY, FIELD-SCOPED sync: pushes ONLY these four fields from each in-scope
 * RESELLER sheet into the routed BD sheet, matched by Record ID:
 *     Lead Status, # of Units, Product/Model, Reseller Comments
 *
 * Because it is ONE-WAY (the reseller is always the source of truth) there is NO
 * conflict resolution to do — that was the thing the old two-way engine couldn't
 * do per-field. Here we simply copy the 4 fields; every OTHER column on the BD
 * sheet (BD's own comments, assignment info, etc.) is NEVER touched.
 *
 * ROUTING (by the reseller's Country in the mapping sheet):
 *   UK / Ireland  reseller → ELLIE's BD sheet
 *   Nordics       reseller → ANGELICA's BD sheet   (Sweden/Denmark/Norway/Finland)
 * The BD sheet links are read from the mapping sheet itself (by BD first name),
 * so nothing is hardcoded — fix a link there and this follows.
 *
 * UPDATE-ONLY: a reseller lead is pushed only if its Record ID ALREADY EXISTS in
 * the BD sheet. We never append new rows to a BD sheet.
 *
 * CHANGE DETECTION: a signature of just the 4 fields is stored per (BD, RecordID)
 * in a hidden tab, so after the first run we only write when one of those 4
 * actually changes — no needless writes every cycle.
 *
 * DATES: the configured date columns are normalised (epoch millis → real Date +
 * dd/mm/yyyy) on both the reseller and BD sheets we touch (POC item #2).
 *
 * WHERE THIS LIVES: bound to the (converted-to-Google-Sheet) "GUK process" mapping
 * file — Extensions → Apps Script. That file is the mapping source AND the home of
 * the hidden snapshot tab. Separate project from the Main Reseller Dashboard.
 *
 * RUN ORDER:
 *   1) Set GS_MAPPING_ID to the converted file's NEW id.
 *   2) gsSyncAll() with GS_DRY_RUN = true  → read the log (routing + matches).
 *   3) Flip GS_DRY_RUN = false, run once   → initial sync (writes differing fields).
 *   4) installGukSyncCron()                → keep it synced automatically.
 */

// ========================= CONFIG =========================

const GS_DRY_RUN = false;   // true = log only, no writes. Flip to false to act.

// Converted GUK process mapping sheet (NATIVE Google Sheet — the .xlsx won't work).
// PASTE the new file id here (from its URL: /spreadsheets/d/<THIS>/edit).
const GS_MAPPING_ID  = '1AXWJRM700muVENMY4eInIuJ0dvDiPEhlGSkbzPjUpVU';
const GS_MAPPING_TAB = 'BD and Reseller List';

// Mapping columns (1-based) per the screenshot:
// A Company | B First | C Last | D Type | E Country | F Email | G Sheet link
const GS_M_COMPANY = 1, GS_M_FIRST = 2, GS_M_LAST = 3,
      GS_M_TYPE = 4, GS_M_COUNTRY = 5, GS_M_EMAIL = 6, GS_M_LINK = 7;

const GS_SOURCE_TAB = 'Leads Data';   // reseller side tab
const GS_BD_TAB     = 'Leads Data';   // BD side tab
const GS_ID_COL     = 1;              // Record ID = Column A

const GS_SNAPSHOT_TAB = '_GukSyncSnapshots';   // hidden helper in THIS (bound) file

// Reseller Country (lowercased) -> BD region key.
const GS_COUNTRY_TO_REGION = {
  'uk': 'uk_ireland', 'united kingdom': 'uk_ireland', 'gb': 'uk_ireland',
  'great britain': 'uk_ireland', 'ireland': 'uk_ireland',
  'sweden': 'nordics', 'denmark': 'nordics', 'norway': 'nordics', 'finland': 'nordics'
};

// BD person (matched by mapping FIRST NAME, lowercased) -> region they own.
// Anyone not listed here (e.g. Alexander) is NOT a sync target and is ignored.
const GS_BD_PERSON_REGION = { 'ellie': 'uk_ireland', 'angelica': 'nordics' };

// The ONLY fields synced (canonical header names, lowercased).
const GS_SYNC_FIELDS = ['lead status', '# of units', 'product/model', 'reseller comments'];

// Source/BD header -> canonical, compared lowercased/trimmed. Covers the spelling
// drift we've already seen across these sheets. Add more here if the dry run logs
// a field as "missing" on a side that clearly has it under another name.
const GS_HEADER_ALIASES = {
  'status (sf)': 'lead status',
  'reseller comment': 'reseller comments',
  'product model': 'product/model',
  'product / model': 'product/model',
  'number of units': '# of units', 'no. of units': '# of units',
  'no of units': '# of units', 'units': '# of units', '#units': '# of units'
};

// Date columns to normalise on every sheet we touch (header names, lowercased).
const GS_DATE_HEADERS = [
  'created date', 'create date', 'last updated', 'timestamp',
  'reseller acknowledgement date', 'reseller acknowledgment date',
  'lead assignment date'
];
const GS_DATE_FORMAT = 'dd/mm/yyyy';

// ========================= MAIN =========================

function gsSyncAll() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { Logger.log('Locked, skipping this run.'); return; }

  try {
    Logger.log(GS_DRY_RUN ? '=== GUK SYNC DRY RUN (no writes) ===' : '=== GUK SYNC LIVE RUN ===');
    const rows = gsReadMapping_();
    if (!rows) return;

    const bdTargets = gsResolveBdTargets_(rows);      // region -> {id, name}
    Object.keys(bdTargets).forEach(function (rgn) {
      Logger.log('  BD target [' + rgn + '] = ' + bdTargets[rgn].name + ' (' + bdTargets[rgn].id + ')');
    });
    if (!Object.keys(bdTargets).length) { Logger.log('  ❌ no BD targets resolved — check mapping (Type=BD, first name Ellie/Angelica).'); return; }

    const resellers = gsCollectResellers_(rows);      // [{company,country,region,id}]
    const snaps = gsLoadSnapshots_();
    const snapUpdates = {};
    let totalChanged = 0;

    Object.keys(bdTargets).forEach(function (region) {
      const target = bdTargets[region];
      const bd = gsOpenLeads_(target.id);
      if (!bd) { Logger.log('  ⚠️ cannot open BD sheet for ' + target.name + ' — skipping region ' + region); return; }

      const bdFieldCols = gsFieldColumns_(bd.header);
      gsReportMissingFields_('BD ' + target.name, bdFieldCols);
      gsFormatDatesOnSheet_(bd.sheet, target.name + ' (BD)');

      const mine = resellers.filter(function (r) { return r.region === region; });
      mine.forEach(function (r) {
        const src = gsOpenLeads_(r.id);
        if (!src) { Logger.log('    ⚠️ ' + r.company + ' (' + r.country + '): cannot open reseller sheet — skipped.'); return; }

        gsFormatDatesOnSheet_(src.sheet, r.company + ' (reseller)');
        const srcFieldCols = gsFieldColumns_(src.header);
        gsReportMissingFields_('reseller ' + r.company, srcFieldCols);

        const n = gsSyncSourceToBd_(r, src, bd, srcFieldCols, bdFieldCols, target, snaps, snapUpdates);
        totalChanged += n;
      });
    });

    gsSaveSnapshots_(snapUpdates);
    Logger.log((GS_DRY_RUN ? 'DRY RUN: ' : '') + 'records with field changes ' +
               (GS_DRY_RUN ? 'that WOULD be' : '') + ' pushed: ' + totalChanged);
    Logger.log('Done.');
  } catch (e) {
    console.error('gsSyncAll error:', e);
    Logger.log('❌ ' + e);
  } finally {
    lock.releaseLock();
  }
}

// Push the 4 fields from one reseller sheet into its routed BD sheet. Update-only
// (Record ID must already exist in the BD sheet). Returns # records changed.
function gsSyncSourceToBd_(r, src, bd, srcFieldCols, bdFieldCols, target, snaps, snapUpdates) {
  let matched = 0, changed = 0;

  src.data.forEach(function (row) {
    const rawId = row[GS_ID_COL - 1];
    if (rawId === '' || rawId === null || rawId === undefined) return;
    const id = String(rawId).trim();

    const bdEntry = bd.byId[id];
    if (!bdEntry) return;                 // update-only: not in BD → skip
    matched++;

    // Signature of just the 4 fields (in fixed order).
    const vals = GS_SYNC_FIELDS.map(function (f) {
      const si = srcFieldCols[f];
      return (si === undefined || si === null) ? '' : (row[si] == null ? '' : row[si]);
    });
    const sig = vals.map(function (v) { return String(v); }).join('||');
    const key = target.id + '|' + id;

    if (snaps[key] === sig) { snapUpdates[key] = sig; return; }   // unchanged

    // Changed → write each field present on BOTH sides.
    const changes = [];
    GS_SYNC_FIELDS.forEach(function (f) {
      const bcol = bdFieldCols[f], scol = srcFieldCols[f];
      if (bcol === undefined || bcol === null || scol === undefined || scol === null) return;
      changes.push({ col: bcol + 1, header: f, value: (row[scol] == null ? '' : row[scol]) });
    });

    if (changes.length) {
      if (GS_DRY_RUN) {
        Logger.log('    [would update] ' + r.company + ' → ' + target.name +
                   '  id=' + id + '  ' + changes.map(function (c) { return c.header + '="' + c.value + '"'; }).join(', '));
      } else {
        changes.forEach(function (c) { bd.sheet.getRange(bdEntry.rowNum, c.col).setValue(c.value); });
      }
      changed++;
    }
    snapUpdates[key] = sig;
  });

  Logger.log('    [reseller] ' + r.company + ' (' + r.country + ') → ' + target.name +
             ': ' + src.data.length + ' rows, ' + matched + ' matched in BD, ' + changed + ' changed.');
  return changed;
}

// ========================= MAPPING =========================

function gsReadMapping_() {
  let sh;
  try { sh = SpreadsheetApp.openById(GS_MAPPING_ID).getSheetByName(GS_MAPPING_TAB); }
  catch (e) { Logger.log('❌ cannot open mapping sheet ' + GS_MAPPING_ID + ': ' + e); return null; }
  if (!sh) { Logger.log('❌ mapping tab "' + GS_MAPPING_TAB + '" not found.'); return null; }
  return sh.getDataRange().getValues();   // includes header row(s); non-link rows are ignored downstream
}

// region -> { id, name } for the two in-scope BD people, read from the mapping.
function gsResolveBdTargets_(rows) {
  const out = {};
  rows.forEach(function (row) {
    const type  = String(row[GS_M_TYPE - 1]  || '').trim().toLowerCase();
    if (type.indexOf('bd') === -1) return;                 // BD rows only
    const first = String(row[GS_M_FIRST - 1] || '').trim().toLowerCase();
    const region = GS_BD_PERSON_REGION[first];
    if (!region) return;                                   // not Ellie/Angelica → ignore (e.g. Alexander)
    const id = gsExtractFileId_(String(row[GS_M_LINK - 1] || ''));
    if (!id) { Logger.log('  ⚠️ BD "' + first + '" has no usable link — skipped.'); return; }
    if (!out[region]) out[region] = { id: id, name: (String(row[GS_M_FIRST - 1] || '') + ' ' + String(row[GS_M_LAST - 1] || '')).trim() };
  });
  return out;
}

// [{ company, country, region, id }] for every in-scope RESELLER row with a link.
function gsCollectResellers_(rows) {
  const out = [];
  rows.forEach(function (row) {
    const type = String(row[GS_M_TYPE - 1] || '').trim().toLowerCase();
    if (type.indexOf('reseller') === -1) return;           // reseller rows only
    const country = String(row[GS_M_COUNTRY - 1] || '').trim();
    const region  = GS_COUNTRY_TO_REGION[country.toLowerCase()];
    const id      = gsExtractFileId_(String(row[GS_M_LINK - 1] || ''));
    const company = String(row[GS_M_COMPANY - 1] || '').trim() || String(row[GS_M_EMAIL - 1] || '').trim();
    if (!id) return;                                       // no link (e.g. the "GUK Folder" row) → skip
    if (!region) { Logger.log('  ⚠️ reseller "' + company + '" country "' + country + '" not routed (not UK/Ireland/Nordics) — skipped.'); return; }
    out.push({ company: company, country: country, region: region, id: id });
  });
  return out;
}

// ========================= SHEET I/O =========================

function gsOpenLeads_(fileId) {
  let sh;
  try { sh = SpreadsheetApp.openById(fileId).getSheetByName(GS_SOURCE_TAB); }
  catch (e) { Logger.log('    ⚠️ cannot open ' + fileId + ': ' + e); return null; }
  if (!sh) { Logger.log('    ⚠️ no "' + GS_SOURCE_TAB + '" tab in ' + fileId); return null; }
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return { sheet: sh, header: [], data: [], byId: {} };
  const header = vals[0], data = vals.slice(1);
  const byId = {};
  for (let i = 0; i < data.length; i++) {
    const id = data[i][GS_ID_COL - 1];
    if (id === '' || id === null || id === undefined) continue;
    const key = String(id).trim();
    if (byId[key] === undefined) byId[key] = { row: data[i], rowNum: i + 2 };   // +2: header + 1-based
  }
  return { sheet: sh, header: header, data: data, byId: byId };
}

// canonical field name -> 0-based column index in this header (only for fields present).
function gsFieldColumns_(header) {
  const norm = header.map(function (h) { const n = gsNorm_(h); return GS_HEADER_ALIASES[n] || n; });
  const out = {};
  GS_SYNC_FIELDS.forEach(function (f) { const i = norm.indexOf(f); if (i !== -1) out[f] = i; });
  return out;
}

function gsReportMissingFields_(label, fieldCols) {
  const missing = GS_SYNC_FIELDS.filter(function (f) { return fieldCols[f] === undefined; });
  if (missing.length) Logger.log('    ⚠️ ' + label + ' is MISSING field column(s): ' + missing.join(', ') +
                                 ' (those fields will be skipped for this sheet — add an alias if it exists under another name).');
}

// Normalise the configured date columns to real Dates + a date format. Skips blanks
// and already-Date cells. No writes in dry run.
function gsFormatDatesOnSheet_(sheet, label) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const norm = header.map(gsNorm_);
  const dataRows = lastRow - 1;

  GS_DATE_HEADERS.forEach(function (hName) {
    const col = norm.indexOf(hName);
    if (col === -1) return;
    if (GS_DRY_RUN) { Logger.log('    [dates] would normalise "' + header[col] + '" on ' + label); return; }

    const range = sheet.getRange(2, col + 1, dataRows, 1);
    const vals = range.getValues();
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i][0];
      if (v === '' || v === null || v === undefined) continue;
      if (v instanceof Date) continue;
      let ms = null;
      if (typeof v === 'number' && isFinite(v)) ms = v;
      else if (typeof v === 'string' && /^\d{10,}$/.test(v.trim())) ms = Number(v.trim());
      if (ms === null) continue;
      if (ms === 0) continue;             // a bare 0 must not become 31 Dec 1969
      if (ms < 1e12) ms = ms * 1000;      // seconds → millis guard
      vals[i][0] = new Date(ms);
      changed = true;
    }
    if (changed) range.setValues(vals);
    range.setNumberFormat(GS_DATE_FORMAT);
    range.setHorizontalAlignment('right');   // keep the date column visually uniform
  });
}

function gsNorm_(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

function gsExtractFileId_(link) {
  if (!link) return null;
  const m = String(link).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

// ========================= SNAPSHOT STORE =========================

function gsGetSnapshotSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(GS_SNAPSHOT_TAB);
  if (!sh) { sh = ss.insertSheet(GS_SNAPSHOT_TAB); sh.hideSheet(); sh.appendRow(['Key', 'Signature']); }
  return sh;
}

function gsLoadSnapshots_() {
  const sh = gsGetSnapshotSheet_();
  const data = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) { const k = data[i][0]; if (k) map[k] = data[i][1]; }
  return map;
}

function gsSaveSnapshots_(updates) {
  if (GS_DRY_RUN) return;                       // don't persist snapshots on a dry run
  if (!updates || !Object.keys(updates).length) return;
  const sh = gsGetSnapshotSheet_();
  const merged = gsLoadSnapshots_();
  Object.keys(updates).forEach(function (k) { merged[k] = updates[k]; });
  const out = [['Key', 'Signature']];
  Object.keys(merged).forEach(function (k) { out.push([k, merged[k]]); });
  sh.clearContents();
  sh.getRange(1, 1, out.length, 2).setValues(out);
}

// ========================= TRIGGER =========================

function installGukSyncCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gsSyncAll') exists = true;
  });
  if (exists) { Logger.log('GUK sync cron already installed.'); return; }
  ScriptApp.newTrigger('gsSyncAll').timeBased().everyMinutes(1).create();
  Logger.log('✅ 1-minute GUK sync cron installed.');
}

function removeGukSyncCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gsSyncAll') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' GUK sync trigger(s).');
}
