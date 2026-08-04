/**
 * GETAC — Region/Folder Migration (PILOT)
 * --------------------------------------------------------------------------
 * Scope: 1 BD + 1 Reseller for Germany AND France (4 sheets total).
 * What it does: reads the BD & Reseller mapping sheet, and for each pilot
 * person, FULL-COPIES their original Google Sheet into the correct
 * region/country folder, named per the agreed convention.
 *
 * This is PLACEMENT ONLY. No syncing — clones are static snapshots for now.
 * Run manually from the editor. No trigger needed.
 *
 * SAFETY:
 *  - DRY_RUN = true by default → it only LOGS what it would do, changes nothing.
 *    Read the logs, confirm they're correct, THEN set DRY_RUN = false and re-run.
 *  - Idempotent: if a clone with the target name already exists in the folder,
 *    it is skipped (no duplicates) when SKIP_IF_EXISTS = true.
 *  - Placeholder cleanup trashes ONLY files whose name contains '{' or '}'
 *    (the sample sheets), and only inside the specific target folder. Trash is
 *    recoverable (~30 days). Real clones never contain braces, so they're safe.
 */

// ========================= CONFIG =========================

const MAPPING_SHEET_ID = '1fc3PAp8b1UFoDjyYohKPDDvUXMYMnXv-0ZbU50RPgxc';
const MAPPING_TAB_NAME  = 'Links';

// Mapping columns (1-based) — Country, Type of Ownership, Status, Company, Email, Sheet Link
const COL_COUNTRY = 1;
const COL_TYPE    = 2;
const COL_STATUS  = 3;
const COL_COMPANY = 4;
const COL_EMAIL   = 5;
const COL_LINK    = 6;

// Country -> Region (hardcoded, extend later)
const REGION_BY_COUNTRY = {
  'Germany': 'GDE',
  'France':  'GFR'
};

// Destination folders per country.
//  - bdFolder:        where BD clones go (the "02 - BD/Sales" folder)
//  - resellerFolders: company name -> that company's subfolder under "03 - Resellers"
const FOLDERS_BY_COUNTRY = {
  'Germany': {
    bdFolder: '1o41w3kRJTC4jhQyUT-iz2pA7uxXxTwFq',
    resellerFolders: {
      'Mettenmeier':    '1ARqu2HIc9Pe6lTktz1f7cMZXVfhjVd6S',
      'PWA ELECTRONIC': '1cvNtNZiQK9SpN1gvLNIkOBGarHKI6MC5'
    }
  },
  'France': {
    bdFolder: '1a-2hH8tAnnFuID0LJQZxKJJHFaW4sMrd',
    resellerFolders: {
      'Milexia': '18BHhhYdQYI0KRtWAlpuhLTG6uu88T4w-'
    }
  }
};

// PILOT allowlist — only these emails are processed. Empty the array to process all.
const PILOT_EMAILS = [
  'andre.arens@getac.com',     // Germany BD
  'robust-pc@mettenmeier.de',  // Germany Reseller (Mettenmeier)
  'bilal.mirzoev@getac.com',   // France BD
  'hugo.ramos@milexia.com'     // France Reseller (Milexia)
];

// Behaviour flags
const DRY_RUN            = true;  // true = log only, change nothing. Flip to false to act.
const SKIP_IF_EXISTS     = true;  // true = don't re-clone if target name already in folder.
const TRASH_PLACEHOLDERS = false; // SAFEST default: leave sample sheets untouched, clear them by hand.

// ========================= MAIN =========================

function runPilotMigration() {
  Logger.log(DRY_RUN ? '=== DRY RUN (no changes will be made) ===' : '=== LIVE RUN ===');

  const rows = readMappingRows_();
  let processed = 0, skipped = 0, missing = 0;

  rows.forEach(function (r) {
    // Pilot filter
    if (PILOT_EMAILS.length && PILOT_EMAILS.indexOf(r.email) === -1) return;

    const region = REGION_BY_COUNTRY[r.country];
    if (!region) { Logger.log('⚠️ No region mapped for country "' + r.country + '" (email ' + r.email + ') — skipping.'); skipped++; return; }

    // Missing original sheet link (the "#N/A" / "N/A" cases to flag)
    const srcId = extractFileId_(r.link);
    if (!srcId) { Logger.log('🚩 MISSING original sheet for ' + r.email + ' (link="' + r.link + '") — flagged, skipping.'); missing++; return; }

    const isBD = isBd_(r);
    const folderCfg = FOLDERS_BY_COUNTRY[r.country];
    if (!folderCfg) { Logger.log('⚠️ No folders configured for country "' + r.country + '" — skipping ' + r.email); skipped++; return; }

    let destFolderId, targetName;
    if (isBD) {
      destFolderId = folderCfg.bdFolder;
      targetName   = bdSheetName_(r.country, r.email);
    } else {
      destFolderId = folderCfg.resellerFolders[r.company];
      targetName   = resellerSheetName_(r.company, r.email);
      if (!destFolderId) { Logger.log('⚠️ No reseller folder for company "' + r.company + '" (' + r.email + ') — skipping.'); skipped++; return; }
    }

    placeClone_(srcId, destFolderId, targetName, r.email);
    processed++;
  });

  Logger.log('Done. processed=' + processed + ', skipped=' + skipped + ', missingOriginals=' + missing);
}

// ========================= CORE =========================

function placeClone_(srcId, destFolderId, targetName, who) {
  const folder = DriveApp.getFolderById(destFolderId);

  // 1) Optional: trash sample placeholder sheets ('{...}') in this folder
  if (TRASH_PLACEHOLDERS) trashPlaceholders_(folder);

  // 2) Idempotency: skip if a clone with this name already exists
  if (SKIP_IF_EXISTS && folderHasFileNamed_(folder, targetName)) {
    Logger.log('↩️ Exists, skipping: "' + targetName + '" (' + who + ')');
    return;
  }

  // 3) Full-file copy into the destination folder
  if (DRY_RUN) {
    Logger.log('WOULD COPY ' + who + ' → folder ' + destFolderId + ' as "' + targetName + '"');
    return;
  }

  const src = DriveApp.getFileById(srcId);
  src.makeCopy(targetName, folder);
  Logger.log('✅ Copied ' + who + ' → "' + targetName + '"');
}

function trashPlaceholders_(folder) {
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    if (name.indexOf('{') !== -1 || name.indexOf('}') !== -1) {
      if (DRY_RUN) {
        Logger.log('WOULD TRASH placeholder: "' + name + '"');
      } else {
        f.setTrashed(true);
        Logger.log('🗑️ Trashed placeholder: "' + name + '"');
      }
    }
  }
}

function folderHasFileNamed_(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext();
}

// ========================= HELPERS =========================

function readMappingRows_() {
  const ss = SpreadsheetApp.openById(MAPPING_SHEET_ID);
  const sh = ss.getSheetByName(MAPPING_TAB_NAME);
  if (!sh) throw new Error('Mapping tab "' + MAPPING_TAB_NAME + '" not found.');

  const values = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) { // skip header row
    const row = values[i];
    const email = String(row[COL_EMAIL - 1] || '').trim();
    if (!email) continue; // skip blank/spacer rows
    out.push({
      country: String(row[COL_COUNTRY - 1] || '').trim(),
      type:    String(row[COL_TYPE - 1]    || '').trim(),
      status:  String(row[COL_STATUS - 1]  || '').trim(),
      company: String(row[COL_COMPANY - 1] || '').trim(),
      email:   email,
      link:    String(row[COL_LINK - 1]    || '').trim()
    });
  }
  return out;
}

// BD vs Reseller: trust the Type column, fall back to @getac.com rule.
function isBd_(r) {
  if (/bd/i.test(r.type)) return true;
  if (/reseller/i.test(r.type)) return false;
  return /@getac\.com$/i.test(r.email);
}

// Pull the file ID out of a Google Sheets URL. Returns null for #N/A / blank / junk.
function extractFileId_(link) {
  if (!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

// Naming conventions (matching the sample placeholders, braces removed).
//  BD:       "Offline Leads Management - {country} - {BD}"
//  Reseller: "Offline Leads Management - reseller {company} - {rep}"
// The mapping has no name column, so the {BD}/{rep} slot uses the Email field
// as-is (a real source value — nothing invented/derived).
function bdSheetName_(country, email) {
  return 'Offline Leads Management - ' + country + ' - ' + email;
}

function resellerSheetName_(company, email) {
  return 'Offline Leads Management - reseller ' + company + ' - ' + email;
}
