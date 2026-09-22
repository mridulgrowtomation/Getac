/**
 * GETAC — GUK (UK & Nordics) Reseller → BD field sync
 * --------------------------------------------------------------------------
 * ONE-WAY, FIELD-SCOPED sync: pushes ONLY these four fields from each in-scope
 * RESELLER sheet into the routed BD sheet, matched by DEAL ID (the go-forward unique
 * key — one per enquiry). A reseller row must carry a Deal ID that maps to exactly one
 * BD row; rows with no Deal ID, or a Deal ID on >1 BD row, are skipped + logged.
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
 * UPDATE-ONLY: a reseller lead is pushed only if its Deal ID ALREADY EXISTS in
 * the BD sheet. We never append new rows to a BD sheet.
 *
 * DEAL ID (BD → reseller): Deal ID is the HubSpot-enriched unique key — one per
 * enquiry, so the SAME Record ID can appear on many rows, each with its own Deal ID.
 * HubSpot enriches it into the BD sheets only, so this script also PROPAGATES it back
 * onto the reseller rows (the ONE place it writes to a reseller sheet). It is safe +
 * non-destructive: it only fills an EMPTY reseller Deal ID, and only when exactly one
 * BD row and one reseller row share the Record ID (unambiguous). Multi-enquiry Record
 * IDs (>1 row on either side) are skipped + logged for manual enrichment until the
 * assignment step that creates the reseller row carries Deal ID itself.
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
  'sweden': 'nordics', 'denmark': 'nordics', 'norway': 'nordics', 'finland': 'nordics',
  'iceland': 'nordics'
};

// BD person (matched by mapping FIRST NAME, lowercased) -> region they own.
// Anyone not listed here (e.g. Alexander) is NOT a sync target and is ignored.
const GS_BD_PERSON_REGION = { 'ellie': 'uk_ireland', 'angelica': 'nordics' };

// Resellers to EXCLUDE from the sync (by file id and/or email, case-insensitive).
// jonas.oldfors@lexit.se sits on a broken/wrong template (header "Status" not "Lead
// Status", no "# of Units"/"Product/Model") AND is being reshaped every minute by an
// external, non-Apps-Script writer we could not locate. Syncing it is pointless until
// the sheet is rebuilt on the correct template. REMOVE from here once that's done.
const GS_SKIP_RESELLER_IDS    = ['1d8KHvkVQw_59b6yCxVSiYMvtSEWXYOb3GlU51cU172U'];
const GS_SKIP_RESELLER_EMAILS = ['jonas.oldfors@lexit.se'];

// The ONLY fields synced (canonical header names, lowercased).
const GS_SYNC_FIELDS = ['lead status', '# of units', 'product/model', 'reseller comments'];

// Deal ID = the go-forward unique lookup key (one per enquiry). HubSpot enriches it
// into the BD sheets; gsPropagateDealIds_ copies it BD → reseller. Matched via aliases.
const GS_DEALID_HEADER = 'deal id';

// Source/BD header -> canonical, compared lowercased/trimmed. Covers the spelling
// drift we've already seen across these sheets. Add more here if the dry run logs
// a field as "missing" on a side that clearly has it under another name.
const GS_HEADER_ALIASES = {
  'status (sf)': 'lead status',
  'reseller comment': 'reseller comments',
  'product model': 'product/model',
  'product / model': 'product/model',
  'number of units': '# of units', 'no. of units': '# of units',
  'no of units': '# of units', 'units': '# of units', '#units': '# of units',
  'dealid': 'deal id', 'deal id (hubspot)': 'deal id', 'hubspot deal id': 'deal id'
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
        gsReportMissingFields_('reseller ' + r.company + ' [' + (r.email || 'no-email') + ' | id=' + r.id + ']', srcFieldCols);

        gsPropagateDealIds_(r, src, bd);   // BD → reseller: backfill Deal ID on unambiguous rows

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
  let matched = 0, changed = 0, noDeal = 0, ambiguous = 0;

  // Deal ID is the ONLY match key (per decision). A reseller row is pushed to BD only
  // when its Deal ID matches exactly one BD row's Deal ID. Rows with no Deal ID, or whose
  // Deal ID is not (uniquely) in BD, are skipped + counted below.
  const srcDealCol = gsDealIdCol_(src.header);
  if (srcDealCol === -1) {
    Logger.log('    [reseller] ' + r.company + ': no "Deal ID" column — nothing can be matched to BD by Deal ID. Skipped.');
    return 0;
  }

  src.data.forEach(function (row) {
    const rawDeal = row[srcDealCol];
    if (rawDeal === '' || rawDeal === null || rawDeal === undefined) { noDeal++; return; }  // no key → skip
    const dealId = String(rawDeal).trim();

    const bdMatches = bd.byDealIdAll[dealId] || [];
    if (bdMatches.length === 0) return;             // update-only: this Deal ID not in BD → skip
    if (bdMatches.length > 1) { ambiguous++; return; } // same Deal ID on >1 BD row → ambiguous, hands off
    const bdEntry = bdMatches[0];
    matched++;

    // Signature of just the 4 fields (in fixed order).
    const vals = GS_SYNC_FIELDS.map(function (f) {
      const si = srcFieldCols[f];
      return (si === undefined || si === null) ? '' : (row[si] == null ? '' : row[si]);
    });
    const sig = vals.map(function (v) { return String(v); }).join('||');
    const key = target.id + '|' + dealId;

    if (snaps[key] === sig) { snapUpdates[key] = sig; return; }   // unchanged

    // Changed → write each field present on BOTH sides.
    const changes = [];
    GS_SYNC_FIELDS.forEach(function (f) {
      const bcol = bdFieldCols[f], scol = srcFieldCols[f];
      if (bcol === undefined || bcol === null || scol === undefined || scol === null) return;
      const sval = (row[scol] == null ? '' : row[scol]);
      // Blank-overwrite guard: never wipe a BD cell with an empty source value — an
      // empty reseller cell is almost always "not filled in yet", not a deliberate
      // clear. (Reversible: delete this line for strict source-mirroring.)
      if (String(sval).trim() === '') return;
      changes.push({ col: bcol + 1, header: f, value: sval });
    });

    let rejected = 0;
    if (changes.length) {
      if (GS_DRY_RUN) {
        Logger.log('    [would update] ' + r.company + ' → ' + target.name +
                   '  dealId=' + dealId + '  ' + changes.map(function (c) { return c.header + '="' + c.value + '"'; }).join(', '));
        changed++;
      } else {
        changes.forEach(function (c) {
          try {
            bd.sheet.getRange(bdEntry.rowNum, c.col).setValue(c.value);
            // Flush per write so a data-validation rejection surfaces HERE (catchable),
            // not batched to end-of-run where it would abort the whole sync.
            SpreadsheetApp.flush();
          } catch (e) {
            rejected++;
            Logger.log('    ⚠️ BD validation REJECTED ' + target.name + ' row ' + bdEntry.rowNum +
                       ' col ' + c.col + ' (' + c.header + ')="' + c.value + '": ' + e.message +
                       ' — BD cell left unchanged. Add this value to that column\'s dropdown, or fix the reseller entry.');
          }
        });
        if (rejected < changes.length) changed++;
      }
    }
    // Only remember this signature if nothing was rejected. If a value was rejected we leave
    // it unsnapshotted so the row is retried next run (e.g. after the BD dropdown is fixed).
    if (rejected === 0) snapUpdates[key] = sig;
  });

  Logger.log('    [reseller] ' + r.company + ' [' + (r.email || 'no-email') + ' | id=' + r.id + '] (' + r.country +
             ') → ' + target.name + ': ' + src.data.length + ' rows, ' + matched + ' matched by Deal ID, ' + changed + ' changed' +
             (noDeal ? ', ' + noDeal + ' skipped (no Deal ID)' : '') +
             (ambiguous ? ', ' + ambiguous + ' skipped (Deal ID on >1 BD row)' : '') + '.');
  return changed;
}

// Propagate Deal ID from the BD sheet onto the reseller sheet. Deal ID is the go-forward
// unique key but HubSpot enriches it into BD only, so we (1) create a "Deal ID" column on
// the reseller sheet if it has none, then (2) backfill it onto reseller rows. STRICTLY
// UNAMBIGUOUS on the fill:
//   - only fills a reseller Deal ID that is currently EMPTY (never overwrites),
//   - only when the Record ID maps to exactly ONE BD row AND ONE reseller row,
//   - skips (and logs) any Record ID with multiple rows on either side — that's the
//     multi-enquiry case, enriched by hand until the assignment step carries Deal ID,
//   - skips rows where the BD side has no Deal ID yet (not enriched → nothing to copy).
// Returns the number of reseller rows filled.
function gsPropagateDealIds_(r, src, bd) {
  const bdDealCol = gsDealIdCol_(bd.header);
  if (bdDealCol === -1) { Logger.log('    ⚠️ BD sheet has no "Deal ID" column — cannot propagate Deal IDs to ' + r.company + '.'); return 0; }

  let srcDealCol = gsDealIdCol_(src.header);
  if (srcDealCol === -1) {
    // No Deal ID column on the reseller sheet yet — create one (append after the last
    // column) so Deal IDs have a home and consolidation can read them later. Idempotent:
    // once created, later runs detect it by header and skip creation.
    const newCol = src.sheet.getLastColumn() + 1;
    if (GS_DRY_RUN) {
      Logger.log('    [would add column] "Deal ID" → ' + r.company + ' at column ' + newCol + '.');
    } else {
      src.sheet.getRange(1, newCol).setValue('Deal ID');
      Logger.log('    ➕ added "Deal ID" column to ' + r.company + ' at column ' + newCol + '.');
    }
    srcDealCol = newCol - 1;   // 0-based index of the (new) column for the fill loop below
  }

  let filled = 0, ambiguous = 0;
  src.data.forEach(function (row, i) {
    const rawId = row[GS_ID_COL - 1];
    if (rawId === '' || rawId === null || rawId === undefined) return;
    const id = String(rawId).trim();

    const existing = String(row[srcDealCol] == null ? '' : row[srcDealCol]).trim();
    if (existing) return;                          // reseller row already has a Deal ID → leave it

    const bdRows  = bd.byIdAll[id]  || [];
    const srcRows = src.byIdAll[id] || [];
    if (bdRows.length === 0) return;               // no BD origin (e.g. offline lead born in reseller) → nothing to copy
    if (bdRows.length !== 1 || srcRows.length !== 1) { ambiguous++; return; }  // multi-enquiry → ambiguous, hands off

    const dealId = String(bdRows[0].row[bdDealCol] == null ? '' : bdRows[0].row[bdDealCol]).trim();
    if (!dealId) return;                           // BD not yet enriched → skip (lookup key absent)

    const rowNum = i + 2;                          // src.data is 0-based starting at sheet row 2
    if (GS_DRY_RUN) {
      Logger.log('    [would fill Deal ID] ' + r.company + ' row ' + rowNum + ' (record ' + id + ') ← ' + dealId);
    } else {
      src.sheet.getRange(rowNum, srcDealCol + 1).setValue(dealId);
      row[srcDealCol] = dealId;                     // keep in-memory copy consistent for the rest of this run
    }
    filled++;
  });

  Logger.log('    [Deal ID → reseller] ' + r.company + ': ' + filled + (GS_DRY_RUN ? ' would be' : '') + ' filled' +
             (ambiguous ? ', ' + ambiguous + ' skipped (multiple rows share a Record ID — enrich by hand)' : '') + '.');
  return filled;
}

// ========================= DIAGNOSTIC (read-only) =========================

// Explain a reseller's "0 matched in BD" per row. Read-only — writes NOTHING.
// Usage from the editor:
//   gsDiagDealId('<resellerFileId>')                 // compares against Angelica (Nordics)
//   gsDiagDealId('<resellerFileId>', '<bdFileId>')   // compare against a specific BD sheet
// Prints: both header rows (so you can SEE which column is Record ID / Deal ID), then per
// reseller row its column-A value, whether that ID exists in the BD sheet, and the BD Deal ID.
function gsDiagDealId(resellerId, bdId) {
  const NORDICS_BD = '19uO9NDWBFb2BwNon6quF800Rijr1RJtZ7kiXm5zD6P4';   // Angelica (default)
  bdId = bdId || NORDICS_BD;

  const src = gsOpenLeads_(resellerId);
  const bd  = gsOpenLeads_(bdId);
  if (!src) { Logger.log('❌ cannot open reseller ' + resellerId); return; }
  if (!bd)  { Logger.log('❌ cannot open BD ' + bdId); return; }

  // All column indices whose header normalises to "record id" (there can be >1 —
  // the GTC-Automation block appends its own Record ID / Status / Timestamp).
  const recIdCols = function (header) {
    const out = [];
    header.forEach(function (h, idx) { if (gsNorm_(h) === 'record id') out.push(idx); });
    return out;
  };
  const srcRecCols = recIdCols(src.header);
  const bdRecCols  = recIdCols(bd.header);
  const srcDealCol = gsDealIdCol_(src.header);
  const bdDealCol  = gsDealIdCol_(bd.header);

  // Index BD by EVERY record-id column so we can test each reseller candidate id.
  const bdIndex = {};   // value -> [row objects]
  bd.data.forEach(function (row) {
    bdRecCols.forEach(function (c) {
      const v = String(row[c] == null ? '' : row[c]).trim();
      if (v) (bdIndex[v] = bdIndex[v] || []).push(row);
    });
  });

  Logger.log('=== DEAL ID DIAGNOSTIC (read-only) ===');
  Logger.log('reseller "Record ID" column indices (0-based): ' + JSON.stringify(srcRecCols) + ' | BD: ' + JSON.stringify(bdRecCols));
  Logger.log('reseller "Deal ID" col idx: ' + srcDealCol + ' | BD "Deal ID" col idx: ' + bdDealCol);
  Logger.log('reseller rows: ' + src.data.length + ' | BD rows: ' + bd.data.length);
  Logger.log('BD sample col-A Record IDs: ' + JSON.stringify(bd.data.slice(0, 5).map(function (r) { return String(r[GS_ID_COL - 1] == null ? '' : r[GS_ID_COL - 1]).trim(); })));

  src.data.forEach(function (row, i) {
    // Every candidate id this reseller row carries, per record-id column.
    const cands = srcRecCols.map(function (c) { return { col: c, val: String(row[c] == null ? '' : row[c]).trim() }; });
    let hit = null;
    cands.forEach(function (cd) { if (cd.val && bdIndex[cd.val] && !hit) hit = cd; });
    const bdDeal = (hit && bdDealCol !== -1) ? String(bdIndex[hit.val][0][bdDealCol] == null ? '' : bdIndex[hit.val][0][bdDealCol]).trim() : '';
    const srcDeal = (srcDealCol !== -1) ? String(row[srcDealCol] == null ? '' : row[srcDealCol]).trim() : '(no col)';
    Logger.log('  row ' + (i + 2) + ': ' +
               cands.map(function (cd) { return 'col' + cd.col + '="' + cd.val + '"'; }).join(' , ') +
               ' | matches BD via: ' + (hit ? ('col' + hit.col + ' → BD Deal ID "' + bdDeal + '"') : 'NONE') +
               ' | reseller Deal ID now: "' + srcDeal + '"');
  });
  Logger.log('=== end diagnostic ===');
}

// Your proposed algorithm, read-only: for EACH BD Record ID, search the WHOLE reseller
// sheet (every row, every column) for that value. Proves whether the leads are shared at
// all. Usage: gsDiagReverse('<resellerFileId>'[, '<bdFileId>'])  (BD defaults to Angelica).
function gsDiagReverse(resellerId, bdId) {
  const NORDICS_BD = '19uO9NDWBFb2BwNon6quF800Rijr1RJtZ7kiXm5zD6P4';   // Angelica (default)
  bdId = bdId || NORDICS_BD;

  const src = gsOpenLeads_(resellerId);
  const bd  = gsOpenLeads_(bdId);
  if (!src) { Logger.log('❌ cannot open reseller ' + resellerId); return; }
  if (!bd)  { Logger.log('❌ cannot open BD ' + bdId); return; }

  // Every non-empty value anywhere in the reseller sheet -> which column it lives in.
  const resellerValues = {};
  src.data.forEach(function (row) {
    row.forEach(function (cell, c) {
      const v = String(cell == null ? '' : cell).trim();
      if (v) resellerValues[v] = c;   // last column wins if duplicated; fine for a presence check
    });
  });

  const bdDealCol = gsDealIdCol_(bd.header);
  Logger.log('=== REVERSE DIAGNOSTIC (BD → reseller, read-only) ===');
  Logger.log('BD rows: ' + bd.data.length + ' | reseller rows: ' + src.data.length);

  let hits = 0;
  bd.data.forEach(function (row, i) {
    const recId = String(row[GS_ID_COL - 1] == null ? '' : row[GS_ID_COL - 1]).trim();
    if (!recId) return;
    const dealId = (bdDealCol !== -1) ? String(row[bdDealCol] == null ? '' : row[bdDealCol]).trim() : '';
    if (resellerValues.hasOwnProperty(recId)) {
      hits++;
      Logger.log('  ✅ BD row ' + (i + 2) + ' Record ID ' + recId + ' FOUND in reseller sheet (column index ' + resellerValues[recId] + ') → would paste Deal ID "' + dealId + '"');
    }
  });
  Logger.log(hits === 0
    ? '  ❌ NONE of the ' + bd.data.length + ' BD Record IDs appear ANYWHERE in this reseller sheet — the leads are not shared, so there is nothing to paste a Deal ID onto.'
    : '  → ' + hits + ' BD Record ID(s) found in the reseller sheet.');
  Logger.log('=== end reverse diagnostic ===');
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
    const email   = String(row[GS_M_EMAIL - 1] || '').trim();
    const company = String(row[GS_M_COMPANY - 1] || '').trim() || email;
    if (!id) return;                                       // no link (e.g. the "GUK Folder" row) → skip
    if (gsIsSkipped_(id, email)) { Logger.log('  ⏭️ reseller "' + company + '" [' + (email || 'no-email') + ' | id=' + id + '] is on the SKIP list — not synced (see GS_SKIP_RESELLER_*).'); return; }
    if (!region) { Logger.log('  ⚠️ reseller "' + company + '" country "' + country + '" not routed (not UK/Ireland/Nordics) — skipped.'); return; }
    out.push({ company: company, country: country, region: region, id: id, email: email });
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
  if (!vals.length) return { sheet: sh, header: [], data: [], byId: {}, byIdAll: {}, byDealId: {}, byDealIdAll: {} };
  const header = vals[0], data = vals.slice(1);
  const dealCol = gsDealIdCol_(header);   // 0-based Deal ID column (-1 if none)
  const byId = {}, byIdAll = {};
  const byDealId = {}, byDealIdAll = {};
  for (let i = 0; i < data.length; i++) {
    const id = data[i][GS_ID_COL - 1];
    if (id !== '' && id !== null && id !== undefined) {
      const key = String(id).trim();
      if (byId[key] === undefined) byId[key] = { row: data[i], rowNum: i + 2 };   // +2: header + 1-based
      (byIdAll[key] = byIdAll[key] || []).push({ row: data[i], rowNum: i + 2 });  // ALL rows per Record ID (multi-enquiry detection)
    }
    // Deal ID index — the go-forward unique lookup key for the reseller ↔ BD sync.
    if (dealCol !== -1) {
      const rawDeal = data[i][dealCol];
      if (rawDeal !== '' && rawDeal !== null && rawDeal !== undefined) {
        const dkey = String(rawDeal).trim();
        if (byDealId[dkey] === undefined) byDealId[dkey] = { row: data[i], rowNum: i + 2 };
        (byDealIdAll[dkey] = byDealIdAll[dkey] || []).push({ row: data[i], rowNum: i + 2 });
      }
    }
  }
  return { sheet: sh, header: header, data: data, byId: byId, byIdAll: byIdAll, byDealId: byDealId, byDealIdAll: byDealIdAll };
}

// canonical field name -> 0-based column index in this header (only for fields present).
function gsFieldColumns_(header) {
  const norm = header.map(function (h) { const n = gsNorm_(h); return GS_HEADER_ALIASES[n] || n; });
  const out = {};
  GS_SYNC_FIELDS.forEach(function (f) { const i = norm.indexOf(f); if (i !== -1) out[f] = i; });
  return out;
}

// 0-based column index of the Deal ID column in this header (-1 if absent). Matched
// via the same alias table as the synced fields, so header spelling drift is tolerated.
function gsDealIdCol_(header) {
  const norm = header.map(function (h) { const n = gsNorm_(h); return GS_HEADER_ALIASES[n] || n; });
  return norm.indexOf(GS_DEALID_HEADER);
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
    if (changed) {
      // Guard: a reject-invalid (setAllowInvalid(false)) rule on a date column would
      // make setValues THROW. Stash the rules, clear them, write, then restore —
      // restoring a rule onto an out-of-list value never throws, so validation is
      // preserved and the date write can't be blocked. (Same pattern as two-way-sync.)
      const rules = range.getDataValidations();
      range.clearDataValidations();
      range.setValues(vals);
      range.setDataValidations(rules);
    }
    range.setNumberFormat(GS_DATE_FORMAT);
    range.setHorizontalAlignment('right');   // keep the date column visually uniform
  });
}

function gsNorm_(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

// True if this reseller is on the skip list (by file id or email).
function gsIsSkipped_(id, email) {
  if (id && GS_SKIP_RESELLER_IDS.indexOf(id) !== -1) return true;
  const e = String(email || '').trim().toLowerCase();
  if (e && GS_SKIP_RESELLER_EMAILS.some(function (x) { return String(x).trim().toLowerCase() === e; })) return true;
  return false;
}

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

// ========================= MAINTENANCE: remove "Last Updated" =========================
// The POC does not want a "Last Updated" column on the GUK working sheets, but an
// external importer (not in this codebase) keeps re-adding it. This deletes any
// "Last Updated"-style column (matched by HEADER, all spelling variants) from the
// "Leads Data" tab of EVERY sheet in the GUK mapping — both BD and reseller.
//
// Our own GUK scripts are all header-driven, so dropping the column is safe for them.
// It IS structural + destructive (removes the whole column and its data), so it is
// GS_DRY_RUN-gated: dry-run first, read the log, then flip and run. Run it manually,
// or install the hourly cron below if the importer keeps re-adding the column.
const GS_LAST_UPDATED_HEADERS = ['last update', 'last updated', 'last modified', 'updated at'];

function gsRemoveLastUpdatedColumns() {
  Logger.log(GS_DRY_RUN ? '=== REMOVE "Last Updated" DRY RUN (no deletes) ===' : '=== REMOVE "Last Updated" LIVE ===');
  const rows = gsReadMapping_();
  if (!rows) return;

  const seen = {};
  let sheets = 0, dropped = 0;
  rows.forEach(function (row) {
    const id = gsExtractFileId_(String(row[GS_M_LINK - 1] || ''));
    if (!id || seen[id]) return;                 // skip non-sheet rows (e.g. the GUK folder) + duplicates
    seen[id] = true;

    let sh;
    try { sh = SpreadsheetApp.openById(id).getSheetByName(GS_SOURCE_TAB); }
    catch (e) { Logger.log('  ⚠️ cannot open ' + id + ': ' + e); return; }
    if (!sh) { Logger.log('  ⚠️ no "' + GS_SOURCE_TAB + '" tab in ' + id); return; }
    sheets++;

    const label = (String(row[GS_M_COMPANY - 1] || '').trim() || id);
    dropped += gsDeleteLastUpdatedOnSheet_(sh, label);
  });
  Logger.log('Done. scanned ' + sheets + ' sheet(s), removed ' + dropped + ' "Last Updated" column(s)' +
             (GS_DRY_RUN ? ' (dry run — nothing deleted)' : '') + '.');
}

// Delete every "Last Updated"-style column on one sheet. Deletes RIGHT-TO-LEFT so an
// earlier deletion never shifts the index of a column still queued for removal.
function gsDeleteLastUpdatedOnSheet_(sheet, label) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 0;
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(gsNorm_);
  const hits = [];
  for (let c = 0; c < header.length; c++) {
    if (GS_LAST_UPDATED_HEADERS.indexOf(header[c]) !== -1) hits.push(c + 1);   // 1-based column
  }
  if (!hits.length) return 0;
  hits.sort(function (a, b) { return b - a; });   // right-to-left
  hits.forEach(function (col) {
    if (GS_DRY_RUN) {
      Logger.log('  [would delete] "Last Updated" column ' + col + ' on ' + label);
    } else {
      sheet.deleteColumn(col);
      Logger.log('  🗑️ deleted "Last Updated" column ' + col + ' on ' + label);
    }
  });
  return hits.length;
}

function installLastUpdatedCleanupCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gsRemoveLastUpdatedColumns') exists = true;
  });
  if (exists) { Logger.log('"Last Updated" cleanup cron already installed.'); return; }
  ScriptApp.newTrigger('gsRemoveLastUpdatedColumns').timeBased().everyHours(1).create();
  Logger.log('✅ Hourly "Last Updated" cleanup cron installed.');
}

function removeLastUpdatedCleanupCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gsRemoveLastUpdatedColumns') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' "Last Updated" cleanup trigger(s).');
}
