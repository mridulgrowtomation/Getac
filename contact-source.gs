/**
 * GETAC — Contact Source dropdown (Column U) for the MASTER reseller sheet
 * --------------------------------------------------------------------------
 * Lives in the SAME project as the sync/onboarding/date scripts.
 *
 * GOAL (step 1 of the online-leads work):
 *   Turn Column U ("Contact Source") oan the master's "Leads Data" tab into a
 *   dropdown with values:
 *       - Online/Campaigns
 *       - Offline/Events
 *   and, because EVERY lead in the master sheet is an ONLINE lead, set every
 *   data row's value to "Online/Campaigns".
 *
 * WHY THE MASTER IS ALL "Online/Campaigns":
 *   The Main Reseller Dashboard holds all ONLINE leads; the per-rep folder
 *   sheets hold the OFFLINE ones. So Contact Source isn't detected per row — it's
 *   decided by which sheet the row lives in. On the master that's always online.
 *
 * FUTURE-PROOFING:
 *   csEnsureMasterSource() (cron-able) re-applies the dropdown to new rows and
 *   fills any BLANK Contact Source cell with "Online/Campaigns" — so new HubSpot
 *   rows are labelled automatically. It only touches blanks, never stomping a
 *   value someone set by hand.
 *
 * SAFETY: CS_DRY_RUN = true by default → logs what's currently in U (header +
 * sample) and what it WOULD write, changes nothing. Confirm the column is right,
 * then flip to false.
 *
 * RUN ORDER:
 *   1) csSetupMasterSource() with CS_DRY_RUN = true  → verify U1/header + sample.
 *   2) Flip CS_DRY_RUN = false, run once             → header + dropdown + values.
 *   3) installContactSourceCron()                     → keep new rows labelled.
 */

// ========================= CONFIG =========================

const CS_DRY_RUN = true;   // true = log only, write nothing. Flip to false to act.

const CS_MASTER_ID = '1TW4Eq0gIXstPHUPfSphhe9gCcWaEAenvhV8BWYfP5iQ';
const CS_TAB       = 'Leads Data';
const CS_COL       = 21;                 // Column U (A=1 … U=21)
const CS_HEADER    = 'Contact Source';

// Dropdown options (order shown in the menu).
const CS_VALUES = ['Online/Campaigns', 'Offline/Events'];

// The master is 100% online, so every row gets this.
const CS_MASTER_DEFAULT = 'Online/Campaigns';

// Apply the dropdown rule down to at least this many rows so rows added LATER
// already carry the dropdown (grows with the data — never shrinks below this).
const CS_MIN_VALIDATION_ROWS = 5000;

// ========================= MAIN =========================

// One-time setup: name the header, stamp the dropdown, set every data row to the
// master default. Idempotent — safe to re-run.
function csSetupMasterSource() {
  Logger.log(CS_DRY_RUN ? '=== CONTACT SOURCE SETUP — DRY RUN (no changes) ===' : '=== CONTACT SOURCE SETUP — LIVE ===');
  csApplyMaster_('all');
}

// Cron entry point: keep new rows labelled. Re-stamps the dropdown to cover new
// rows and fills only BLANK Contact Source cells (with a Record ID) — never
// overwrites an existing value.
function csEnsureMasterSource() {
  csApplyMaster_('blanks');
}

// Core. mode 'all'   → set every data row (with a Record ID) to CS_MASTER_DEFAULT.
//       mode 'blanks'→ only fill blank Contact Source cells (with a Record ID).
function csApplyMaster_(mode) {
  let ss;
  try { ss = SpreadsheetApp.openById(CS_MASTER_ID); }
  catch (e) { Logger.log('❌ cannot open master ' + CS_MASTER_ID + ': ' + e); return; }

  const sh = ss.getSheetByName(CS_TAB);
  if (!sh) { Logger.log('❌ tab "' + CS_TAB + '" not found on master.'); return; }

  const lastRow = sh.getLastRow();
  const nData   = Math.max(lastRow - 1, 0);

  // Report what's in U now so we can confirm the column before writing.
  const curHeader = sh.getRange(1, CS_COL, 1, 1).getValue();
  Logger.log('Column U (' + CS_COL + ') current header = "' + curHeader + '". Data rows = ' + nData + '.');

  // 1) Header.
  if (String(curHeader).trim() !== CS_HEADER) {
    Logger.log((CS_DRY_RUN ? 'WOULD set' : 'Setting') + ' U1 header → "' + CS_HEADER + '"' +
               (curHeader ? ' (was "' + curHeader + '")' : ''));
    if (!CS_DRY_RUN) sh.getRange(1, CS_COL, 1, 1).setValue(CS_HEADER);
  }

  // 2) Dropdown rule over data + buffer (built as show-warning so a stray legacy
  //    value never blocks the write; we set everything to a valid value anyway).
  const validationRows = Math.max(nData, CS_MIN_VALIDATION_ROWS);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CS_VALUES, true)   // true = show dropdown chip
    .setAllowInvalid(true)
    .build();
  Logger.log((CS_DRY_RUN ? 'WOULD apply' : 'Applying') + ' dropdown [' + CS_VALUES.join(', ') +
             '] to U2:U' + (validationRows + 1) + '.');
  if (!CS_DRY_RUN) sh.getRange(2, CS_COL, validationRows, 1).setDataValidation(rule);

  // 3) Values. Only rows that have a Record ID in Col A are real leads.
  if (nData > 0) {
    const ids  = sh.getRange(2, 1, nData, 1).getValues();          // Col A
    const cur  = sh.getRange(2, CS_COL, nData, 1).getValues();     // Col U
    const out  = [];
    let willWrite = 0;
    for (let i = 0; i < nData; i++) {
      const hasId = String(ids[i][0] == null ? '' : ids[i][0]).trim() !== '';
      const val   = cur[i][0];
      const blank = (val === '' || val === null || val === undefined);
      let next = val;
      if (hasId) {
        if (mode === 'all') { next = CS_MASTER_DEFAULT; }
        else if (mode === 'blanks' && blank) { next = CS_MASTER_DEFAULT; }
      }
      if (next !== val) willWrite++;
      out.push([next]);
    }
    Logger.log((CS_DRY_RUN ? 'WOULD set' : 'Setting') + ' ' + willWrite + ' cell(s) to "' +
               CS_MASTER_DEFAULT + '" (mode=' + mode + ').');
    if (!CS_DRY_RUN && willWrite > 0) sh.getRange(2, CS_COL, nData, 1).setValues(out);
  }

  Logger.log(CS_DRY_RUN ? '(dry run — nothing written)' : '✅ Contact Source applied to master.');
}

// ========================= TRIGGER =========================
//
// Daily is plenty: new HubSpot rows land blank in Contact Source and get
// labelled on the next run. Same reasoning as the date-fix cron — cheap,
// off-hours, safe on quota. (Only one sheet here, so it's fast regardless.)
const CS_CRON_HOUR = 3;

function installContactSourceCron() {
  let exists = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'csEnsureMasterSource') exists = true;
  });
  if (exists) { Logger.log('Contact Source cron already installed.'); return; }
  ScriptApp.newTrigger('csEnsureMasterSource').timeBased().everyDays(1).atHour(CS_CRON_HOUR).create();
  Logger.log('✅ Contact Source cron installed (daily at ~' + CS_CRON_HOUR + ':00).');
}

function removeContactSourceCron() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'csEnsureMasterSource') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('Removed ' + removed + ' Contact Source cron trigger(s).');
}
