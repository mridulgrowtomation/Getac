/**
 * GETAC — Two-Way Sync (PILOT, cron-based)
 * --------------------------------------------------------------------------
 * Keeps each ORIGINAL sheet and its CLONE in sync, BOTH directions, via a
 * single 1-minute time trigger (no per-sheet triggers → no 20-trigger ceiling).
 * Scales to full rollout by ADDING ROWS to the registry — no code changes.
 *
 * MECHANISM (per minute, for every registered pair):
 *   - Read both sides' "Leads Data" into {RecordID -> row}.
 *   - Compare each row to a stored signature (snapshot) from the last cycle.
 *       changed on original  → copy original row → clone
 *       changed on clone     → copy clone row    → original
 *       changed on neither   → skip
 *   - Save new signatures.
 *
 * Tab synced:   "Leads Data"
 * Match key:    Record ID in Column A
 * Row copy:     entire row (original & clone have identical columns)
 *
 * EDGE CASE (intentionally NOT handled per decision):
 *   If the SAME row changes on BOTH sides within the same 1-min cycle, we do
 *   not do special conflict resolution. This is rare on these low-traffic
 *   sheets and accepted for now. Revisit at scale if it ever matters.
 *
 * NO SHEET CHANGES: the snapshot store is a hidden helper tab in THIS file
 * (the Main Reseller Dashboard). The synced sheets are untouched structurally.
 *
 * SETUP ORDER:
 *   1) seedRegistryFromPilotClones()  — fill SyncRegistry with original↔clone IDs.
 *   2) (check the SyncRegistry tab looks right)
 *   3) primeSnapshots()               — record current state as baseline so the
 *      FIRST sync cycle doesn't treat every existing row as "changed".
 *   4) installSyncCron()              — install the single 1-minute trigger.
 */

// ========================= CONFIG =========================

const SYNC_TAB_NAME = 'Leads Data';   // tab holding the leads (both sides)
const SYNC_ID_COL   = 1;              // Column A = Record ID
const REGISTRY_TAB  = 'SyncRegistry'; // in this file: A=Label B=OriginalId C=CloneId
const SNAPSHOT_TAB  = '_SyncSnapshots'; // hidden helper: A=FileId|RecordId  B=signature

// Mapping sheet (Google-Sheets format) used to seed pairs.
const SYNC_MAPPING_SHEET_ID = '1fc3PAp8b1UFoDjyYohKPDDvUXMYMnXv-0ZbU50RPgxc';
const SYNC_MAPPING_TAB       = 'Links';
const M_COL_COUNTRY = 1, M_COL_TYPE = 2, M_COL_COMPANY = 4, M_COL_EMAIL = 5, M_COL_LINK = 6;

const SYNC_FOLDERS_BY_COUNTRY = {
  'Germany': {
    bdFolder: '1o41w3kRJTC4jhQyUT-iz2pA7uxXxTwFq',
    resellerFolders: { 'Mettenmeier': '1ARqu2HIc9Pe6lTktz1f7cMZXVfhjVd6S', 'PWA ELECTRONIC': '1cvNtNZiQK9SpN1gvLNIkOBGarHKI6MC5' }
  },
  'France': {
    bdFolder: '1a-2hH8tAnnFuID0LJQZxKJJHFaW4sMrd',
    // Keys MUST match the mapping sheet's Company spelling exactly (not the
    // folder's display name) — the code looks up resellerFolders[company].
    resellerFolders: {
      'Milexia':         '18BHhhYdQYI0KRtWAlpuhLTG6uu88T4w-',
      'Aplus':           '1tofZRFiOEW7DjYg_Y2YCCkqx2RHnz9_W',
      'AtheoIngenierie': '1z7JoAJxU8TYNoImobe4xbMhvnr6tuaK2',
      'Infoproject':     '1MHptBRG5L16sGKLKX9AKysDL4kpN9pZ_',
      'InmacWstore':     '1JrqEQhU1WkL1RRNZ1T_tc9WXsQsr-e56',
      'LAFI':            '1udISQaVHCeJ38EjwdA2RmUdfjttbBfwg',
      'MGSInformatique': '1O-6vA07YMX4lhCDuy29dqld9Mrx_npYs',
      'Orbitica':        '1Ub_bBxLQdrGCpbl5uQJunrBkBmuq4NGS',
      'Rayonance':       '1Kz5fTXGk_QXeFTgDT-FAH8PhVWTndkHE',
      'Timcod':          '1u4WMhch2Vo6fniFfnjNSuPr5WsMd_v5u'
    }
  }
};

const SYNC_PILOT_EMAILS = [
  'andre.arens@getac.com',
  'robust-pc@mettenmeier.de',
  'bilal.mirzoev@getac.com',
  'hugo.ramos@milexia.com'
];

// ========================= MAIN CRON =========================

function syncAllPairs() {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { Logger.log('Locked, skipping this run.'); return; }

  try {
    const pairs = readRegistryPairs_();
    const snaps = loadSnapshots_();      // {key -> signature}
    const snapUpdates = {};              // accumulate this run's new signatures
    let writes = 0;

    pairs.forEach(function (p) {
      writes += syncOnePair_(p, snaps, snapUpdates);
    });

    saveSnapshots_(snapUpdates);
    Logger.log('Sync cycle done. Row writes: ' + writes);
  } catch (e) {
    console.error('syncAllPairs error:', e);
  } finally {
    lock.releaseLock();
  }
}

// Reconcile one original↔clone pair. Returns number of row writes performed.
function syncOnePair_(pair, snaps, snapUpdates) {
  const a = openLeads_(pair.originalId); // "A side" = original
  const b = openLeads_(pair.cloneId);    // "B side" = clone
  if (!a || !b) return 0;

  const lastColA = Math.max(a.sheet.getLastColumn(), b.sheet.getLastColumn());
  let writes = 0;

  // Union of all Record IDs across both sides
  const ids = {};
  Object.keys(a.byId).forEach(function (id) { ids[id] = true; });
  Object.keys(b.byId).forEach(function (id) { ids[id] = true; });

  Object.keys(ids).forEach(function (id) {
    const rowA = a.byId[id];                 // {row:[...], rowNum:n} or undefined
    const rowB = b.byId[id];

    const sigKeyA = pair.originalId + '|' + id;
    const sigKeyB = pair.cloneId + '|' + id;
    const lastSigA = snaps[sigKeyA] || '';
    const lastSigB = snaps[sigKeyB] || '';
    const curSigA = rowA ? signature_(rowA.row) : '';
    const curSigB = rowB ? signature_(rowB.row) : '';

    const changedA = curSigA !== lastSigA;
    const changedB = curSigB !== lastSigB;

    if (changedA && rowA) {
      // original changed → push to clone
      writeRow_(b.sheet, b.byId, id, rowA.row, lastColA);
      snapUpdates[sigKeyA] = curSigA;
      snapUpdates[sigKeyB] = curSigA; // clone now matches original
      writes++;
    } else if (changedB && rowB) {
      // clone changed → push to original
      writeRow_(a.sheet, a.byId, id, rowB.row, lastColA);
      snapUpdates[sigKeyB] = curSigB;
      snapUpdates[sigKeyA] = curSigB;
      writes++;
    } else {
      // no change → keep existing signatures fresh
      if (curSigA) snapUpdates[sigKeyA] = curSigA;
      if (curSigB) snapUpdates[sigKeyB] = curSigB;
    }
  });

  return writes;
}

// ========================= ROW / SHEET HELPERS =========================

function openLeads_(fileId) {
  const ss = SpreadsheetApp.openById(fileId);
  const sheet = ss.getSheetByName(SYNC_TAB_NAME);
  if (!sheet) { Logger.log('⚠️ No "' + SYNC_TAB_NAME + '" in ' + fileId); return null; }

  const data = sheet.getDataRange().getValues();
  const byId = {};
  for (let i = 1; i < data.length; i++) {
    const id = data[i][SYNC_ID_COL - 1];
    if (id === '' || id === null) continue;
    byId[String(id)] = { row: data[i], rowNum: i + 1 };
  }
  return { ss: ss, sheet: sheet, byId: byId };
}

// Write `rowVals` into the row matching `id` (overwrite), or append if absent.
function writeRow_(sheet, byId, id, rowVals, width) {
  const padded = rowVals.slice(0, width);
  while (padded.length < width) padded.push('');
  const existing = byId[String(id)];
  if (existing) {
    sheet.getRange(existing.rowNum, 1, 1, width).setValues([padded]);
  } else {
    sheet.appendRow(padded);
  }
}

function signature_(row) {
  return row.map(function (v) { return v == null ? '' : String(v); }).join('');
}

// ========================= SNAPSHOT STORE =========================

function getSnapshotSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SNAPSHOT_TAB);
  if (!sh) { sh = ss.insertSheet(SNAPSHOT_TAB); sh.hideSheet(); sh.appendRow(['Key', 'Signature']); }
  return sh;
}

function loadSnapshots_() {
  const sh = getSnapshotSheet_();
  const data = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const k = data[i][0]; if (k) map[k] = data[i][1];
  }
  return map;
}

function saveSnapshots_(updates) {
  const sh = getSnapshotSheet_();
  const merged = loadSnapshots_();
  Object.keys(updates).forEach(function (k) { merged[k] = updates[k]; });

  const out = [['Key', 'Signature']];
  Object.keys(merged).forEach(function (k) { out.push([k, merged[k]]); });

  sh.clearContents();
  sh.getRange(1, 1, out.length, 2).setValues(out);
}

// Baseline: record current state so the first cron run doesn't treat every
// existing row as "changed". Run once after seeding.
function primeSnapshots() {
  const pairs = readRegistryPairs_();
  const updates = {};
  pairs.forEach(function (p) {
    [p.originalId, p.cloneId].forEach(function (fid) {
      const ls = openLeads_(fid);
      if (!ls) return;
      Object.keys(ls.byId).forEach(function (id) {
        updates[fid + '|' + id] = signature_(ls.byId[id].row);
      });
    });
  });
  saveSnapshots_(updates);
  Logger.log('Snapshots primed for ' + pairs.length + ' pair(s).');
}

// ========================= REGISTRY =========================

function getRegistrySheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(REGISTRY_TAB);
  if (!sh) { sh = ss.insertSheet(REGISTRY_TAB); sh.appendRow(['Label', 'Original File ID', 'Clone File ID']); }
  return sh;
}

function readRegistryPairs_() {
  const sh = getRegistrySheet_();
  const data = sh.getDataRange().getValues();
  const pairs = [];
  for (let i = 1; i < data.length; i++) {
    const orig = String(data[i][1] || '').trim();
    const clone = String(data[i][2] || '').trim();
    if (orig && clone) pairs.push({ label: String(data[i][0] || '').trim(), originalId: orig, cloneId: clone });
  }
  return pairs;
}

function registryHasOriginal_(sh, originalId) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][1] || '').trim() === originalId) return true;
  return false;
}

// ========================= SEEDING =========================

function seedRegistryFromPilotClones() {
  const reg = getRegistrySheet_();
  const ss = SpreadsheetApp.openById(SYNC_MAPPING_SHEET_ID);
  const sh = ss.getSheetByName(SYNC_MAPPING_TAB);
  if (!sh) throw new Error('Mapping tab "' + SYNC_MAPPING_TAB + '" not found.');

  const values = sh.getDataRange().getValues();
  let added = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const email = String(row[M_COL_EMAIL - 1] || '').trim();
    if (!email || SYNC_PILOT_EMAILS.indexOf(email) === -1) continue;

    const country = String(row[M_COL_COUNTRY - 1] || '').trim();
    const company = String(row[M_COL_COMPANY - 1] || '').trim();
    const type    = String(row[M_COL_TYPE - 1]    || '').trim();
    const link    = String(row[M_COL_LINK - 1]    || '').trim();

    const originalId = extractFileId_(link);
    if (!originalId) { Logger.log('🚩 No original for ' + email); continue; }

    const isBD = /bd/i.test(type) || (!/reseller/i.test(type) && /@getac\.com$/i.test(email));
    const folders = SYNC_FOLDERS_BY_COUNTRY[country];
    if (!folders) { Logger.log('⚠️ No folders for "' + country + '"'); continue; }

    const folderId  = isBD ? folders.bdFolder : folders.resellerFolders[company];
    const cloneName = isBD
      ? ('Offline Leads Management - ' + country + ' - ' + email)
      : ('Offline Leads Management - reseller ' + company + ' - ' + email);
    if (!folderId) { Logger.log('⚠️ No folder for ' + email); continue; }

    const cloneId = findFileIdByName_(folderId, cloneName);
    if (!cloneId) { Logger.log('🚩 Clone not found for ' + email + ' ("' + cloneName + '") — run migration first.'); continue; }

    if (registryHasOriginal_(reg, originalId)) { Logger.log('↩️ Already registered: ' + email); continue; }

    reg.appendRow([email, originalId, cloneId]);
    Logger.log('✅ Registered ' + email);
    added++;
  }
  Logger.log('Seeding done. Added ' + added + ' pair(s).');
}

// ========================= TRIGGER =========================

function installSyncCron() {
  // avoid duplicates
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAllPairs') exists = true;
  });
  if (exists) { Logger.log('Cron already installed.'); return; }

  ScriptApp.newTrigger('syncAllPairs').timeBased().everyMinutes(1).create();
  Logger.log('✅ 1-minute sync cron installed.');
}

function removeSyncCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAllPairs') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' cron trigger(s).');
}

// ========================= DEBUG =========================
// Prints, for every pair, each Record ID's stored snapshot vs current signature
// on both sides — so you can see exactly what the engine thinks changed.
// Run after editing a sheet, BEFORE running syncAllPairs.
function debugInspect() {
  const pairs = readRegistryPairs_();
  const snaps = loadSnapshots_();
  pairs.forEach(function (p) {
    Logger.log('— PAIR: ' + p.label + ' —');
    Logger.log('  originalId=' + p.originalId + '  cloneId=' + p.cloneId);
    const a = openLeads_(p.originalId), b = openLeads_(p.cloneId);
    if (!a || !b) { Logger.log('  (could not open one side)'); return; }
    const ids = {};
    Object.keys(a.byId).forEach(function (id){ids[id]=1;});
    Object.keys(b.byId).forEach(function (id){ids[id]=1;});
    Object.keys(ids).forEach(function (id) {
      const ca = a.byId[id] ? signature_(a.byId[id].row) : '(absent)';
      const cb = b.byId[id] ? signature_(b.byId[id].row) : '(absent)';
      const sa = snaps[p.originalId + '|' + id] || '(none)';
      const sb = snaps[p.cloneId   + '|' + id] || '(none)';
      const origChanged = (a.byId[id] ? signature_(a.byId[id].row) : '') !== (snaps[p.originalId+'|'+id]||'');
      const cloneChanged = (b.byId[id] ? signature_(b.byId[id].row) : '') !== (snaps[p.cloneId+'|'+id]||'');
      Logger.log('  id=' + id + '  origChanged=' + origChanged + '  cloneChanged=' + cloneChanged);
    });
  });
}

// ========================= REGISTRY HEALTH CHECK =========================
// Reports duplicate Original IDs, duplicate Clone IDs, and any clone mapped to
// more than one original (the bilal case). Read-only — changes nothing.
function checkRegistryHealth() {
  const sh = getRegistrySheet_();
  const data = sh.getDataRange().getValues();
  const byOrig = {}, byClone = {};
  for (let i = 1; i < data.length; i++) {
    const label = String(data[i][0] || '').trim();
    const orig  = String(data[i][1] || '').trim();
    const clone = String(data[i][2] || '').trim();
    if (!orig && !clone) continue;
    (byOrig[orig]  = byOrig[orig]  || []).push({ rowNum: i + 1, label: label, clone: clone });
    (byClone[clone]= byClone[clone]|| []).push({ rowNum: i + 1, label: label, orig: orig });
  }
  let problems = 0;
  Object.keys(byOrig).forEach(function (o) {
    if (byOrig[o].length > 1) { problems++; Logger.log('⚠️ Original ' + o + ' appears in rows ' + byOrig[o].map(function(x){return x.rowNum;}).join(', ')); }
  });
  Object.keys(byClone).forEach(function (c) {
    if (byClone[c].length > 1) {
      problems++;
      Logger.log('⚠️ Clone ' + c + ' mapped to ' + byClone[c].length + ' originals — rows ' +
        byClone[c].map(function(x){return x.rowNum + '(orig ' + x.orig + ')';}).join(', '));
    }
  });
  Logger.log(problems === 0 ? '✅ Registry clean — no duplicates.' : '❌ ' + problems + ' problem(s) found. Fix before syncing.');
}

// ========================= MISC HELPERS =========================

function extractFileId_(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function findFileIdByName_(folderId, name) {
  const it = DriveApp.getFolderById(folderId).getFilesByName(name);
  return it.hasNext() ? it.next().getId() : null;
}
