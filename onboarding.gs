/**
 * GETAC — Automated Onboarding (migration + registration), cron-able
 * --------------------------------------------------------------------------
 * Lives in the SAME project as the two-way sync, so it REUSES the sync helpers
 * (extractFileId_, findFileIdByName_, getRegistrySheet_, openLeads_,
 *  signature_, saveSnapshots_) — no duplicated logic, no name clashes.
 *
 * WHAT IT DOES (per run, for every mapping row):
 *   1) Resolve the person's original sheet + target folder + clone name.
 *   2) If the clone doesn't exist yet → make a full copy (migrate).
 *   3) Upsert the original↔clone pair into SyncRegistry, KEYED BY EMAIL:
 *        - new email      → append a row
 *        - existing email → update its IDs in place (NO duplicate; fixes the
 *          "changed link creates a 2nd row" bug)
 *   4) Prime snapshots for any new/updated pair, so the first sync cycle is a
 *      clean 0-writes (a fresh clone == its original).
 *
 * After onboarding registers a pair, the existing 1-min sync cron keeps it in
 * sync, and the Country Report picks up the new clone automatically.
 *
 * SAFETY: OB_DRY_RUN = true by default → logs what it WOULD migrate/register,
 * creates nothing. Read the log, confirm, then flip to false.
 *
 * SETUP ORDER:
 *   1) onboardAll() with OB_DRY_RUN = true  → review the log.
 *   2) Flip OB_DRY_RUN = false, run once    → migrates + registers + primes.
 *   3) installOnboardCron()                  → run it automatically every 5 min.
 *
 * This supersedes the manual pilot-migration script for ongoing onboarding.
 */

// ========================= CONFIG =========================

const OB_DRY_RUN = true;   // true = log only, create nothing. Flip to false to act.

// Optional allowlist for testing — only these emails are processed.
// Leave EMPTY ([]) to process the whole mapping (full rollout).
const OB_LIMIT_EMAILS = [];

// Reuses from two-way-sync.gs (same project):
//   SYNC_MAPPING_SHEET_ID, SYNC_MAPPING_TAB, M_COL_* , SYNC_FOLDERS_BY_COUNTRY,
//   getRegistrySheet_, openLeads_, signature_, saveSnapshots_,
//   extractFileId_, findFileIdByName_

// ========================= MAIN =========================

function onboardAll() {
  Logger.log(OB_DRY_RUN ? '=== ONBOARD DRY RUN (no changes) ===' : '=== ONBOARD LIVE RUN ===');

  const rows     = obReadMapping_();
  const reg      = getRegistrySheet_();
  const regIndex = obIndexRegistryByEmail_(reg);   // emailLower -> {rowNum, orig, clone}
  const toPrime  = [];

  let migrated = 0, registered = 0, updated = 0, skipped = 0, missing = 0;

  rows.forEach(function (r) {
    if (OB_LIMIT_EMAILS.length && OB_LIMIT_EMAILS.indexOf(r.email) === -1) return;

    // 1) Original sheet link (skip #N/A / blank / junk, and report).
    const originalId = extractFileId_(r.link);
    if (!originalId) { Logger.log('🚩 No/NA link for ' + r.email + ' (link="' + r.link + '") — skipping.'); missing++; return; }

    // 2) Target folder + clone name (BD vs reseller).
    const folders = SYNC_FOLDERS_BY_COUNTRY[r.country];
    if (!folders) { Logger.log('⚠️ No folders configured for country "' + r.country + '" (' + r.email + ') — skipping.'); skipped++; return; }

    const isBD = /bd/i.test(r.type) || (!/reseller/i.test(r.type) && /@getac\.com$/i.test(r.email));
    const folderId  = isBD ? folders.bdFolder : folders.resellerFolders[r.company];
    if (!folderId) { Logger.log('⚠️ No folder for ' + r.email + ' (company "' + r.company + '") — skipping.'); skipped++; return; }

    const cloneName = isBD
      ? ('Offline Leads Management - ' + r.country + ' - ' + r.email)
      : ('Offline Leads Management - reseller ' + r.company + ' - ' + r.email);

    // 3) Find or create the clone (idempotent: skip copy if it already exists).
    let cloneId = findFileIdByName_(folderId, cloneName);
    if (!cloneId) {
      if (OB_DRY_RUN) {
        Logger.log('WOULD MIGRATE ' + r.email + ' → folder ' + folderId + ' as "' + cloneName + '"');
      } else {
        cloneId = DriveApp.getFileById(originalId)
                          .makeCopy(cloneName, DriveApp.getFolderById(folderId))
                          .getId();
        Logger.log('✅ Migrated ' + r.email + ' → "' + cloneName + '"');
        migrated++;
        // Stamp the canonical Lead Status dropdown so the new clone is born
        // correct regardless of what its original had. (Defined in
        // propagate-dropdown.gs — same project. Never throws.)
        pdStampClone_(cloneId);
      }
    }

    // 4) Email-keyed registry upsert.
    const key = r.email.toLowerCase();
    const existing = regIndex[key];

    if (existing) {
      // Same email already registered — update IN PLACE only if IDs changed.
      const wantOrig  = originalId;
      const wantClone = cloneId || existing.clone;   // keep old clone if dry-run hasn't made one
      if (existing.orig !== wantOrig || existing.clone !== wantClone) {
        if (!OB_DRY_RUN) reg.getRange(existing.rowNum, 2, 1, 2).setValues([[wantOrig, wantClone]]);
        Logger.log('♻️ Updated registry for ' + r.email + (OB_DRY_RUN ? ' (would)' : ''));
        updated++;
        if (cloneId) toPrime.push({ originalId: wantOrig, cloneId: wantClone });
      }
    } else if (cloneId) {
      if (!OB_DRY_RUN) reg.appendRow([r.email, originalId, cloneId]);
      Logger.log('✅ Registered ' + r.email + (OB_DRY_RUN ? ' (would)' : ''));
      registered++;
      toPrime.push({ originalId: originalId, cloneId: cloneId });
    } else {
      // dry-run: clone doesn't exist yet, so we can't register it (no clone ID).
      Logger.log('   (dry-run) would register ' + r.email + ' after migration.');
    }
  });

  // 5) Prime snapshots for new/updated pairs so the first sync cycle = 0 writes.
  if (!OB_DRY_RUN && toPrime.length) obPrimePairs_(toPrime);

  Logger.log('Onboard done. migrated=' + migrated + ', registered=' + registered +
             ', updated=' + updated + ', skipped=' + skipped + ', missingLinks=' + missing);
}

// ========================= HELPERS =========================

function obReadMapping_() {
  const ss = SpreadsheetApp.openById(SYNC_MAPPING_SHEET_ID);
  const sh = ss.getSheetByName(SYNC_MAPPING_TAB);
  if (!sh) throw new Error('Mapping tab "' + SYNC_MAPPING_TAB + '" not found.');

  const v = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const email = String(v[i][M_COL_EMAIL - 1] || '').trim();
    if (!email) continue;
    out.push({
      country: String(v[i][M_COL_COUNTRY - 1] || '').trim(),
      type:    String(v[i][M_COL_TYPE - 1]    || '').trim(),
      company: String(v[i][M_COL_COMPANY - 1] || '').trim(),
      email:   email,
      link:    String(v[i][M_COL_LINK - 1]    || '').trim()
    });
  }
  return out;
}

// Index the registry by email (Column A = Label = email). Last row wins if dupes
// already exist (checkRegistryHealth() flags those separately).
function obIndexRegistryByEmail_(reg) {
  const data = reg.getDataRange().getValues();
  const idx = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').trim().toLowerCase();
    if (!key) continue;
    idx[key] = { rowNum: i + 1, orig: String(data[i][1] || '').trim(), clone: String(data[i][2] || '').trim() };
  }
  return idx;
}

// Baseline current state of given pairs (reuses sync's snapshot store).
function obPrimePairs_(pairs) {
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
  Logger.log('   primed snapshots for ' + pairs.length + ' new/updated pair(s).');
}

// ========================= TRIGGER =========================

function installOnboardCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onboardAll') exists = true;
  });
  if (exists) { Logger.log('Onboard cron already installed.'); return; }
  ScriptApp.newTrigger('onboardAll').timeBased().everyMinutes(5).create();
  Logger.log('✅ Onboard cron installed (every 5 min).');
}

function removeOnboardCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onboardAll') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' onboard cron trigger(s).');
}
