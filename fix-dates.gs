/**
 * GETAC — Date Normalizer (epoch millis → real dates) for SOURCE sheets
 * --------------------------------------------------------------------------
 * Lives in the SAME project as the two-way sync / onboarding, so it REUSES
 * their helpers (readRegistryPairs_, extractFileId_). No duplicated logic.
 *
 * THE PROBLEM:
 *   HubSpot exports date fields as raw epoch MILLISECONDS (e.g. 1761523200000).
 *   When those land in a sheet they're stored as a plain number, so the cell
 *   shows 1761523200000 instead of a date. This hits the MASTER reseller sheet
 *   (Main Reseller Dashboard File) and every reseller sheet copied from it.
 *   Unlike the consolidated rollups (rebuilt each run by consolidation.gs),
 *   these source sheets are PERMANENT and keep receiving new millis — so the fix
 *   must run repeatedly, not once.
 *
 * HARDCODED TARGETS (per your screenshots — matched by HEADER NAME, so a shifted
 * column position is still found; a sheet lacking the header is simply skipped):
 *   - "Leads Data"      tab → column "Reseller Acknowledgement Date"  (col H)
 *   - "Dashboard Links" tab → column "Date"                          (col D, master only)
 *
 * WHAT IT DOES per target column:
 *   - Converts cells that are epoch-millis (number or numeric string) within a
 *     SAFE date window (2010–2040) into real Dates + stamps a date format. The
 *     window excludes phone numbers (too big) and small ints (too small).
 *   - Only touches the column if it actually contained millis — so a column
 *     that's already proper dates (e.g. Dashboard Links "Date") is left alone.
 *   - PRESERVES FORMULAS: formula cells are written back as formulas, never
 *     flattened — important for the Dashboard Links tab.
 *
 * TARGET SHEETS:
 *   master + every reseller sheet listed in the master's Dashboard Links "ID"
 *   column + registry originals/clones (FR/DE). All deduped.
 *
 * FUTURE-PROOFING:
 *   - installDateCron() re-normalizes newly-arrived millis on a timer.
 *   - onboarding.gs calls fdFixDatesForFile_(cloneId) right after a clone is
 *     made, so brand-new sheets are born clean.
 *
 * SAFETY: FD_DRY_RUN = true by default → logs which sheet/tab/column/sample it
 * WOULD change, writes nothing. Read the log, confirm, then flip to false.
 *
 * RUN ORDER:
 *   1) fdFixAllDates() with FD_DRY_RUN = true  → read the log (before/after list).
 *   2) Flip FD_DRY_RUN = false, run once       → converts + formats.
 *   3) installDateCron()                        → keep new millis normalized.
 */

// ========================= CONFIG =========================

const FD_DRY_RUN = true;   // true = log only, write nothing. Flip to false to act.

// Master reseller sheet (source of truth reseller sheets are copied from).
const FD_MASTER_ID = '1TW4Eq0gIXstPHUPfSphhe9gCcWaEAenvhV8BWYfP5iQ';

// Hardcoded date columns to fix, by TAB → HEADER NAME. Matched case-insensitively
// against row 1, so column position can vary between sheets. A tab/header that
// isn't present on a given sheet is skipped (e.g. reseller sheets have no
// "Dashboard Links" tab).
const FD_DATE_COLUMNS = {
  'Leads Data':      'Reseller Acknowledgement Date',
  'Dashboard Links': 'Date'
};

// Display format per tab. Dashboard Links carries a time component; Leads Data
// is date-only. Change here if the POC wants a different format.
const FD_FORMATS = {
  'Leads Data':      'dd/mm/yyyy',
  'Dashboard Links': 'dd/mm/yyyy hh:mm:ss'
};
const FD_DEFAULT_FORMAT = 'dd/mm/yyyy';

// On the master's Dashboard Links tab, this column holds each reseller sheet's
// raw file ID (screenshot: column C "ID"). Used to enumerate reseller sheets.
const FD_DASHBOARD_LINKS_TAB    = 'Dashboard Links';
const FD_DASHBOARD_ID_HEADER    = 'ID';

// SAFE epoch-millis window — a numeric cell is treated as a date ONLY if it
// falls inside this range. Keeps us from converting phone numbers (far larger)
// or small integers like "# of Units" (far smaller).
const FD_MS_MIN = 1262304000000;  // 2010-01-01
const FD_MS_MAX = 2208988800000;  // 2040-01-01

// --- Resumability (opening ~171 sheets alone exceeds the 6-min limit, so the
// backfill runs in time-boxed chunks and continues itself) ---
// Stop processing new files once this many ms have elapsed in a run, leaving
// headroom under the 6-min (360s) ceiling to finish the current file + reschedule.
const FD_TIME_BUDGET_MS = 300000;               // 5 min
// Script Property key storing the resume cursor (index into the target list).
const FD_CURSOR_PROP    = 'FD_CURSOR';
// DEDICATED handler for the self-scheduled one-shot continuation trigger. It's a
// DIFFERENT name from fdFixAllDates on purpose: the backfill's continuation
// triggers can be found + deleted by this name WITHOUT touching the recurring
// installDateCron trigger (which uses fdFixAllDates).
const FD_CONTINUE_FN    = 'fdContinueBackfill';

// ========================= MAIN =========================

// Time-boxed + resumable. Processes targets starting at the saved cursor until
// the time budget is hit, saves progress, and — if more remain — schedules a
// one-shot trigger to continue. Re-running (or the trigger firing) picks up
// exactly where it stopped; a completed pass resets the cursor. Idempotent:
// already-converted cells are real Dates and get skipped, so nothing is redone.
function fdFixAllDates() {
  const start = Date.now();
  Logger.log(FD_DRY_RUN ? '=== DATE FIX DRY RUN (no changes) ===' : '=== DATE FIX LIVE RUN ===');

  const ids = fdCollectTargetIds_();
  const props = PropertiesService.getScriptProperties();
  let cursor = parseInt(props.getProperty(FD_CURSOR_PROP) || '0', 10);
  if (isNaN(cursor) || cursor < 0 || cursor >= ids.length) cursor = 0;
  Logger.log('Targets: ' + ids.length + ' sheet(s). Resuming at index ' + cursor + '.');

  let filesTouched = 0, cellsConverted = 0, i = cursor;
  for (; i < ids.length; i++) {
    if (Date.now() - start > FD_TIME_BUDGET_MS) {
      Logger.log('⏸️ Time budget reached at index ' + i + ' — pausing.');
      break;
    }
    const id = ids[i];
    let ss;
    try { ss = SpreadsheetApp.openById(id); }
    catch (e) { Logger.log('  ❌ cannot open ' + id + ': ' + e); continue; }

    const name = ss.getName();
    let fileConverted = 0;
    Object.keys(FD_DATE_COLUMNS).forEach(function (tab) {
      const res = fdFixColumn_(ss, tab, FD_DATE_COLUMNS[tab]);
      if (!res || res.count === 0) return;
      Logger.log('  ' + name + ' | "' + tab + '" | col ' + res.col + ' "' + res.header +
                 '" | ' + res.count + ' date cell(s) | sample ' + res.sample +
                 (FD_DRY_RUN ? '  ← WOULD FIX' : '  ✅ fixed'));
      fileConverted += res.count;
    });
    if (fileConverted > 0) { filesTouched++; cellsConverted += fileConverted; }
  }

  // Persist progress + (re)schedule continuation. Always clear stale one-shot
  // continuation triggers first so they can't pile up. Dry run never schedules —
  // it's just a preview — so it always reports as a single pass.
  fdClearContinueTriggers_();
  if (!FD_DRY_RUN && i < ids.length) {
    props.setProperty(FD_CURSOR_PROP, String(i));
    ScriptApp.newTrigger(FD_CONTINUE_FN).timeBased().after(60000).create();  // continue in ~1 min
    Logger.log('This chunk — files affected: ' + filesTouched + ', cells converted: ' + cellsConverted +
               '. ▶️ Scheduled continuation from index ' + i + ' (' + (ids.length - i) + ' left).');
  } else {
    props.deleteProperty(FD_CURSOR_PROP);
    Logger.log((FD_DRY_RUN ? 'DRY RUN — ' : '✅ ALL DONE — ') + 'this pass files affected: ' + filesTouched +
               ', cells ' + (FD_DRY_RUN ? 'to convert' : 'converted') + ': ' + cellsConverted +
               (FD_DRY_RUN ? '.' : '. Cursor reset.'));
  }
}

// Continuation entry point. A one-shot trigger fires this; it just re-enters the
// main loop (which resumes from the saved cursor). Separate name from
// fdFixAllDates so we can delete these triggers without disturbing the recurring
// installDateCron trigger.
function fdContinueBackfill() {
  fdFixAllDates();
}

// Delete only the one-shot continuation triggers (handler = FD_CONTINUE_FN).
// Leaves the recurring installDateCron trigger (handler = fdFixAllDates) intact.
function fdClearContinueTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === FD_CONTINUE_FN) ScriptApp.deleteTrigger(t);
  });
}

// Reset the resume cursor manually (e.g. to force a full re-sweep from scratch).
function fdResetCursor() {
  PropertiesService.getScriptProperties().deleteProperty(FD_CURSOR_PROP);
  Logger.log('Cursor reset — next run starts from index 0.');
}

// Single-file entry point used by onboarding.gs right after a clone is made,
// so a brand-new sheet is normalized immediately. Never throws.
function fdFixDatesForFile_(fileId) {
  try {
    const ss = SpreadsheetApp.openById(fileId);
    Object.keys(FD_DATE_COLUMNS).forEach(function (tab) {
      fdFixColumn_(ss, tab, FD_DATE_COLUMNS[tab]);
    });
  } catch (e) {
    Logger.log('fdFixDatesForFile_ skipped ' + fileId + ': ' + e);
  }
}

// ========================= CORE =========================

// Find `headerName` on `tabName` and convert its epoch-millis cells to Dates +
// stamp the tab's date format. Returns {col, header, count, sample} or null if
// the tab/header/data is absent. Honors FD_DRY_RUN. Preserves formulas.
function fdFixColumn_(ss, tabName, headerName) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) return null;                                   // tab not on this sheet

  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return null;

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const want   = fdNorm_(headerName);
  let col = -1;
  for (let c = 0; c < lastCol; c++) { if (fdNorm_(header[c]) === want) { col = c; break; } }
  if (col === -1) return null;                            // header not present here

  const nRows    = lastRow - 1;
  const values   = sh.getRange(2, col + 1, nRows, 1).getValues();
  const formulas = sh.getRange(2, col + 1, nRows, 1).getFormulas();
  const out = [];
  let count = 0, sample = null;

  for (let r = 0; r < nRows; r++) {
    const f = formulas[r][0];
    if (f) { out.push([f]); continue; }                   // keep formula cells intact
    const v  = values[r][0];
    const ms = fdAsMillis_(v);
    if (ms !== null) {
      if (sample === null) sample = v;
      count++;
      out.push([new Date(ms)]);
    } else {
      out.push([v]);
    }
  }

  if (count > 0 && !FD_DRY_RUN) {
    const rng = sh.getRange(2, col + 1, nRows, 1);
    rng.setValues(out);                                   // formulas restored, millis→Date
    rng.setNumberFormat(FD_FORMATS[tabName] || FD_DEFAULT_FORMAT);
  }
  return { col: col + 1, header: header[col], count: count, sample: sample };
}

// Return the epoch-millis value of a cell IF it looks like a date, else null.
// Accepts a number or a pure-digit string; both must land in the safe window.
function fdAsMillis_(v) {
  let ms = null;
  if (typeof v === 'number' && isFinite(v)) ms = v;
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) ms = Number(v.trim());
  if (ms === null || !isFinite(ms)) return null;
  return (ms >= FD_MS_MIN && ms <= FD_MS_MAX) ? ms : null;
}

function fdNorm_(h) { return String(h == null ? '' : h).trim().toLowerCase(); }

// ========================= TARGETS =========================

// Master + every reseller sheet ID listed in the master's Dashboard Links "ID"
// column + registry originals/clones (FR/DE). Deduped. Consolidated/country
// rollups are handled by consolidation.gs, so they're intentionally excluded.
function fdCollectTargetIds_() {
  const seen = {}, out = [];
  const add = function (id) {
    id = String(id || '').trim();
    if (id && !seen[id]) { seen[id] = true; out.push(id); }
  };

  add(FD_MASTER_ID);

  // Reseller sheets from the master's Dashboard Links "ID" column.
  try {
    fdReadDashboardIds_().forEach(add);
  } catch (e) {
    Logger.log('⚠️ could not read Dashboard Links IDs: ' + e);
  }

  // FR/DE originals + clones from the sync registry (may overlap — dedup handles it).
  try {
    readRegistryPairs_().forEach(function (p) { add(p.originalId); add(p.cloneId); });
  } catch (e) {
    Logger.log('⚠️ could not read registry (need the Main Dashboard project): ' + e);
  }
  return out;
}

// Pull raw reseller file IDs from the master's Dashboard Links "ID" column.
// Falls back to parsing the "Links" column via extractFileId_ if an ID cell is
// blank but a link exists in the neighbouring column.
function fdReadDashboardIds_() {
  const sh = SpreadsheetApp.openById(FD_MASTER_ID).getSheetByName(FD_DASHBOARD_LINKS_TAB);
  if (!sh) return [];
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(fdNorm_);
  const idCol   = header.indexOf(fdNorm_(FD_DASHBOARD_ID_HEADER));
  const linkCol = header.indexOf('links');
  if (idCol === -1 && linkCol === -1) return [];

  const data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const ids = [];
  data.forEach(function (row) {
    let id = idCol !== -1 ? String(row[idCol] || '').trim() : '';
    if (!id && linkCol !== -1) id = extractFileId_(String(row[linkCol] || '')) || '';
    if (id) ids.push(id);
  });
  return ids;
}

// ========================= TRIGGER (ongoing integration) =========================
//
// WHY DAILY, NOT EVERY-FEW-MINUTES:
//   A full sweep opens ~171 sheets and takes ~6 min. Running that every 10 min
//   would consume the daily script-execution quota and start failing. This fix
//   is DISPLAY-ONLY (new HubSpot rows still hold the correct instant, just shown
//   as a number until normalized), so same-day normalization is plenty. A daily
//   sweep costs ~one full pass/day — cheap and safe on quota.
//
//   The sweep itself is still time-boxed + resumable (fdFixAllDates), so even the
//   daily run chunks itself under the 6-min ceiling via the continuation trigger.
//   Idempotent: already-converted cells are skipped, so each daily run only does
//   real work on the handful of NEW rows HubSpot added since yesterday.
//
//   New CLONES don't wait for the daily sweep — onboarding.gs calls
//   fdFixDatesForFile_(cloneId) at creation, so a new reseller sheet is correct
//   immediately.

// Hour of day (0–23, script timezone) for the daily sweep. 3 = 3 AM, off-hours.
const FD_CRON_HOUR = 3;

function installDateCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'fdFixAllDates') exists = true;
  });
  if (exists) { Logger.log('Date-fix cron already installed.'); return; }
  ScriptApp.newTrigger('fdFixAllDates').timeBased().everyDays(1).atHour(FD_CRON_HOUR).create();
  Logger.log('✅ Date-fix cron installed (daily at ~' + FD_CRON_HOUR + ':00).');
}

function removeDateCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'fdFixAllDates') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' date-fix cron trigger(s).');
}
