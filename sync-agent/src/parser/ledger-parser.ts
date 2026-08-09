import { safeText, safeNumber, safeGuid, extractTallyMessage, diagnoseXmlResponse } from './xml-parser.js';

export interface ParsedLedger {
  tally_guid: string; master_id: string; name: string; parent_group: string; parent_group_id: string;
  opening_balance: number; closing_balance: number; balance_type: 'Dr' | 'Cr'; classification: string;
  address: string; gstin: string; state_name: string; pin_code: string; contact_person: string; phone: string; email: string; pan: string;
}

function extractItemList(parent: Record<string, unknown>, tagName: string): unknown[] {
  const val = parent[tagName];
  if (Array.isArray(val)) return val as unknown[];
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const list = obj['LIST']; if (Array.isArray(list)) return list as unknown[];
    const coll = obj['COLLECTION']; if (Array.isArray(coll)) return coll as unknown[];
    const env = obj['ENVELOPE'];
    if (env && typeof env === 'object') {
      const eo = env as Record<string, unknown>;
      const eb = eo['BODY'] as Record<string, unknown> | undefined;
      if (eb) {
        const d = eb['DATA'] as Record<string, unknown> | undefined;
        if (d) {
          const dc = d['COLLECTION']; if (Array.isArray(dc)) return dc as unknown[];
          const na = d['NA'] ?? d['AM']; if (Array.isArray(na)) return na as unknown[];
        }
      }
    }
    if (Object.keys(obj).some(k => k === 'LEDGERNAME' || k === 'NAME')) return [obj];
  }
  return [];
}

export function parseLedgers(xmlData: Record<string, unknown>): ParsedLedger[] {
  const ledgers: ParsedLedger[] = [];
  try {
    diagnoseXmlResponse('LEDGER', xmlData);
    const lm = extractTallyMessage(xmlData);
    if (Object.keys(lm).length === 0) { console.log('[LedgerParser] No TALLYMESSAGE. Deep search...'); return deepSearch(xmlData); }
    const ll = extractItemList(lm, 'LEDGER');
    console.log(`[LedgerParser] Found ${ll.length} items in TALLYMESSAGE`);
    if (ll.length === 0) { console.log('[LedgerParser] No LEDGER collection. Deep search...'); return deepSearch(xmlData); }
    for (const item of ll) {
      const l = item as Record<string, unknown>;
      if (!l || (!l['LEDGERNAME'] && !l['NAME'])) continue;
      const pg = safeText(l['PARENT']);
      let c = 'general'; if (pg === 'Sundry Debtors') c = 'customer'; else if (pg === 'Sundry Creditors') c = 'supplier'; else if (pg === 'Bank Accounts') c = 'bank'; else if (pg === 'Cash-in-Hand') c = 'cash';
      const cb = safeNumber(l['CLOSINGBALANCE']);
      ledgers.push({ tally_guid: safeGuid(l['GUID']), master_id: safeText(l['MASTERID']), name: safeText(l['LEDGERNAME'] ?? l['NAME']), parent_group: pg, parent_group_id: safeText(l['PARENTID']), opening_balance: safeNumber(l['OPENINGBALANCE']), closing_balance: cb, balance_type: cb >= 0 ? 'Dr' : 'Cr', classification: c, address: safeText(l['ADDRESS']), gstin: safeText(l['GSTIN'] ?? l['INCOMETAXNUMBER']), state_name: safeText(l['STATENAME']), pin_code: safeText(l['PINCODE']), contact_person: safeText(l['CONTACTPERSON']), phone: safeText(l['PHONE'] ?? l['PHONENUMBER']), email: safeText(l['EMAIL']), pan: safeText(l['PAN'] ?? l['PANNO']) });
    }
  } catch (e) { console.error('[LedgerParser] Error:', e); }
  console.log(`[LedgerParser] Total: ${ledgers.length}`);
  return ledgers;
}

function deepSearch(xmlData: Record<string, unknown>): ParsedLedger[] {
  const r: ParsedLedger[] = [];
  function s(obj: unknown, d: number) {
    if (!obj || d > 15) return;
    if (Array.isArray(obj)) { for (const item of obj) { if (item && typeof item === 'object') { const o = item as Record<string, unknown>; if (o['LEDGERNAME'] || (o['NAME'] && o['PARENT'])) { const pg = safeText(o['PARENT']); let c = 'general'; if (pg === 'Sundry Debtors') c = 'customer'; else if (pg === 'Sundry Creditors') c = 'supplier'; else if (pg === 'Bank Accounts') c = 'bank'; else if (pg === 'Cash-in-Hand') c = 'cash'; const cb = safeNumber(o['CLOSINGBALANCE']); r.push({ tally_guid: safeGuid(o['GUID']), master_id: safeText(o['MASTERID']), name: safeText(o['LEDGERNAME'] ?? o['NAME']), parent_group: pg, parent_group_id: safeText(o['PARENTID']), opening_balance: safeNumber(o['OPENINGBALANCE']), closing_balance: cb, balance_type: cb >= 0 ? 'Dr' : 'Cr', classification: c, address: safeText(o['ADDRESS']), gstin: safeText(o['GSTIN'] ?? o['INCOMETAXNUMBER']), state_name: safeText(o['STATENAME']), pin_code: safeText(o['PINCODE']), contact_person: safeText(o['CONTACTPERSON']), phone: safeText(o['PHONE'] ?? o['PHONENUMBER']), email: safeText(o['EMAIL']), pan: safeText(o['PAN'] ?? o['PANNO']) }); } s(o, d + 1); } } }
    else if (typeof obj === 'object') { const o = obj as Record<string, unknown>; for (const k of ['LEDGER','LEDGERS','COLLECTION','LIST','DATA','REPORT','DSPACCNAME','DSPDISPNAME','AM','NA','FLATLED','LEDGERENTRIES']) { const v = o[k]; if (Array.isArray(v)) s(v, d + 1); } for (const v of Object.values(o)) { if (v && typeof v === 'object' && !Array.isArray(v) && d < 10) s(v, d + 1); } }
  }
  s(xmlData, 0);
  console.log(`[LedgerParser] Deep search: ${r.length}`);
  return r;
}
