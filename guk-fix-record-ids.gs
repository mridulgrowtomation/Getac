/**
 * GETAC — GUK source Record ID audit / repair (one-off utility)
 * --------------------------------------------------------------------------
 * Scans every GUK source "Leads Data" tab (via the GUK mapping sheet) and lists
 * every row whose Record ID is INVALID — blank, 0, a stray date (e.g. the
 * 12/31/1969 epoch-0 artifact), or any non-numeric value — together with that
 * row's identifying fields (name / company / email) so the correct record can
 * be confirmed against HubSpot.
 *
 * TWO MODES (both gated by GF_DRY_RUN):
 *   1) AUDIT  — leave GF_FIXES empty. Just logs the bad rows + where they live.
 *   2) REPAIR — fill GF_FIXES with { email(lowercase): 'correctRecordId' }.
 *               It matches the bad row by email and writes the correct ID
 *               (as text, so a big number can't drift) into the source cell.
 *
 * SAFETY: it only ever touches a cell whose CURRENT Record ID is invalid, so it
 * can never overwrite a good ID. Fully self-contained (GF_/gf prefixes) — safe
 * to paste as a NEW file into the GUK Apps Script project without collisions.
 *
 * RUN ORDER:
 *   1) gfAuditAndFix() with GF_DRY_RUN=true, GF_FIXES={}  → read the log, find Ed Knight.
 *   2) Look up the real HubSpot Record ID(s) → put them in GF_FIXES.
 *   3) gfAuditAndFix() with GF_DRY_RUN=true                → confirm "[would fix]" lines.
 *   4) Flip GF_DRY_RUN=false, run once                     → writes the correct ID(s).
 */

const GF_DRY_RUN = true;   // true = report only. Flip to false to actually write.

const GF_MAPPING_ID  = '1afWzwlqEus7z7DuVxUgJS0EfWW9KlsZU';   // GUK mapping sheet
const GF_MAPPING_TAB = 'BD and Reseller List';
const GF_LINK_HEADER = 'Google Sheet Link';                  // mapping column with each source link
const GF_SOURCE_TAB  = 'Leads Data';

// Header names used to locate columns on each source sheet (matched by name).
const GF_ID_HEADER      = 'Record ID';
const GF_EMAIL_HEADER   = 'Email';
const GF_FIRST_HEADER   = 'First Name';
const GF_LAST_HEADER    = 'Last Name';
const GF_COMPANY_HEADER = 'Company Name';

// email (lowercased) -> correct HubSpot Record ID (as a string).
// Empty = AUDIT-ONLY. Example:
//   'contact@pendrake.ai': '1234567890'
const GF_FIXES = {
};

function gfAuditAndFix() {
  Logger.log(GF_DRY_RUN ? '=== GUK Record ID AUDIT (no writes) ===' : '=== GUK Record ID REPAIR (writing) ===');

  let mapSheet;
  try { mapSheet = SpreadsheetApp.openById(GF_MAPPING_ID).getSheetByName(GF_MAPPING_TAB); }
  catch (e) { Logger.log('❌ cannot open mapping ' + GF_MAPPING_ID + ': ' + e); return; }
  if (!mapSheet) { Logger.log('❌ mapping tab "' + GF_MAPPING_TAB + '" not found.'); return; }

  const mrows = mapSheet.getDataRange().getValues();
  if (mrows.length < 2) { Logger.log('❌ mapping is empty.'); return; }
  const mhead = mrows[0].map(gfNorm_);
  const linkCol = mhead.indexOf(gfNorm_(GF_LINK_HEADER));
  if (linkCol === -1) { Logger.log('❌ no "' + GF_LINK_HEADER + '" column in mapping.'); return; }

  const seen = {};
  let badTotal = 0, fixedTotal = 0, sourcesScanned = 0;

  for (let i = 1; i < mrows.length; i++) {
    const sid = gfExtractId_(String(mrows[i][linkCol] || ''));
    if (!sid || seen[sid]) continue;
    seen[sid] = true;

    let ss;
    try { ss = SpreadsheetApp.openById(sid); }
    catch (e) { Logger.log('⚠️ cannot open source ' + sid + ': ' + e); continue; }

    const sh = ss.getSheetByName(GF_SOURCE_TAB);
    if (!sh) { continue; }
    const vals = sh.getDataRange().getValues();
    if (vals.length < 2) { continue; }
    sourcesScanned++;

    const h = vals[0].map(gfNorm_);
    const cId    = h.indexOf(gfNorm_(GF_ID_HEADER));
    const cEmail = h.indexOf(gfNorm_(GF_EMAIL_HEADER));
    const cFirst = h.indexOf(gfNorm_(GF_FIRST_HEADER));
    const cLast  = h.indexOf(gfNorm_(GF_LAST_HEADER));
    const cComp  = h.indexOf(gfNorm_(GF_COMPANY_HEADER));
    if (cId === -1) { continue; }

    for (let r = 1; r < vals.length; r++) {
      const idStr = String(vals[r][cId] == null ? '' : vals[r][cId]).trim();
      const validId = /^\d+$/.test(idStr) && idStr !== '0';
      if (validId) { continue; }

      const email = cEmail !== -1 ? String(vals[r][cEmail] || '').trim() : '';
      const first = cFirst !== -1 ? String(vals[r][cFirst] || '').trim() : '';
      const last  = cLast  !== -1 ? String(vals[r][cLast]  || '').trim() : '';
      const comp  = cComp  !== -1 ? String(vals[r][cComp]  || '').trim() : '';

      // Ignore fully-blank filler rows — only report rows that carry real data.
      if (!email && !first && !last && !comp) { continue; }

      badTotal++;
      Logger.log('BAD ID | ' + ss.getName() + ' | row ' + (r + 1) +
                 ' | current="' + idStr + '" | ' + first + ' ' + last +
                 ' | ' + comp + ' | ' + email);

      const fix = GF_FIXES[email.toLowerCase()];
      if (fix) {
        if (GF_DRY_RUN) {
          Logger.log('   [would fix] set Record ID = ' + fix);
        } else {
          const cell = sh.getRange(r + 1, cId + 1);
          cell.setNumberFormat('@');          // plain text — keeps a long id intact
          cell.setValue(String(fix));
          Logger.log('   [fixed] Record ID set to ' + fix);
          fixedTotal++;
        }
      }
    }
  }

  Logger.log('=== scanned ' + sourcesScanned + ' source sheet(s) | bad rows: ' + badTotal +
             ' | fixed: ' + fixedTotal + (GF_DRY_RUN ? ' (DRY RUN)' : '') + ' ===');
}

function gfNorm_(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

function gfExtractId_(link) {
  const t = String(link || '').trim();
  if (!t) return '';
  const m = t.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(t) ? t : '';
}
