import { safeText, safeNumber, safeGuid, extractTallyMessage, diagnoseXmlResponse } from './xml-parser.js';

export interface ParsedVoucher {
  tally_guid: string; voucher_id_tally: string; alter_id: string; voucher_type: string; voucher_number: string;
  voucher_date: string; reference_number: string; party_ledger_guid: string; party_name: string; narration: string;
  total_amount: number; total_debit: number; total_credit: number; is_cancelled: boolean;
  items: ParsedVoucherItem[]; ledger_entries: ParsedVoucherLedgerEntry[]; taxes: ParsedVoucherTax[];
}
export interface ParsedVoucherItem { stock_item_name: string; quantity: number; unit: string; rate: number; discount_percent: number; discount_amount: number; taxable_amount: number; amount: number; gst_rate: number; gst_amount: number; }
export interface ParsedVoucherLedgerEntry { ledger_name: string; ledger_guid: string; is_deemed_positive: boolean; debit: number; credit: number; amount: number; entry_type: string; }
export interface ParsedVoucherTax { tax_type: string; ledger_name: string; amount: number; rate: number; }

function extractItemList(parent: Record<string, unknown>, tagName: string): unknown[] {
  const val = parent[tagName];
  if (Array.isArray(val)) return val as unknown[];
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const list = obj['LIST']; if (Array.isArray(list)) return list as unknown[];
    const coll = obj['COLLECTION']; if (Array.isArray(coll)) return coll as unknown[];
    if (Object.keys(obj).some(k => k === 'VOUCHERNUMBER' || k === 'VOUCHERDATE' || k === 'VOUCHERTYPENAME')) return [obj];
  }
  return [];
}

export function parseVouchers(xmlData: Record<string, unknown>): ParsedVoucher[] {
  const vouchers: ParsedVoucher[] = [];
  try {
    diagnoseXmlResponse('VOUCHER', xmlData);
    const lm = extractTallyMessage(xmlData);
    if (Object.keys(lm).length === 0) { console.log('[VoucherParser] No TALLYMESSAGE. Deep search...'); return deepSearch(xmlData); }
    const vl = extractItemList(lm, 'VOUCHER');
    console.log(`[VoucherParser] Found ${vl.length} items in TALLYMESSAGE`);
    if (vl.length === 0) { console.log('[VoucherParser] No VOUCHER collection. Deep search...'); return deepSearch(xmlData); }
    for (const item of vl) { const v = item as Record<string, unknown>; if (!v || (!v['VOUCHERTYPENAME'] && !v['VOUCHERDATE'])) continue; const p = parseOne(v); if (p) vouchers.push(p); }
  } catch (e) { console.error('[VoucherParser] Error:', e); }
  console.log(`[VoucherParser] Total: ${vouchers.length}`);
  return vouchers;
}

function parseOne(v: Record<string, unknown>): ParsedVoucher | null {
  const pl = v['PARTYLEDGER']; let pg = safeText(v['PARTYGUID']); if (!pg && pl && typeof pl === 'object') pg = safeGuid((pl as Record<string,unknown>)['GUID']);
  return { tally_guid: safeGuid(v['GUID']), voucher_id_tally: safeText(v['VOUCHERID']), alter_id: safeText(v['ALTERID']), voucher_type: safeText(v['VOUCHERTYPENAME']), voucher_number: safeText(v['VOUCHERNUMBER']), voucher_date: safeText(v['VOUCHERDATE'] ?? v['DATE']), reference_number: safeText(v['REFERENCE'] ?? v['REFERENCENUMBER']), party_ledger_guid: pg, party_name: safeText(v['PARTYLEDGERNAME'] ?? v['PARTYNAME']), narration: safeText(v['NARRATION']), total_amount: safeNumber(v['VOUCHERTOTAL'] ?? v['TOTALAMOUNT'] ?? v['AMOUNT']), total_debit: safeNumber(v['TOTALDEBIT']), total_credit: safeNumber(v['TOTALCREDIT']), is_cancelled: safeText(v['ISCANCELLED']) === 'Yes', items: parseItems(v), ledger_entries: parseEntries(v), taxes: parseTaxes(v) };
}

function parseItems(v: Record<string, unknown>): ParsedVoucherItem[] {
  const items: ParsedVoucherItem[] = [];
  try { const ie = v['INVENTORYENTRIES'] as Record<string,unknown>|undefined; const el = (ie?.['LIST']??ie?.['INVENTORYENTRY']??[]) as unknown[]; for (const entry of Array.isArray(el)?el:[el]) { const e = entry as Record<string,unknown>; if (!e) continue; items.push({ stock_item_name: safeText(e['STOCKITEMNAME']), quantity: safeNumber(e['QUANTITY']??e['ACTUALQTY']), unit: safeText(e['UNIT']??e['ACTUALUNIT']), rate: safeNumber(e['RATE']??e['BASICRATE']), discount_percent: safeNumber(e['DISCOUNTPERCENT']), discount_amount: safeNumber(e['DISCOUNTAMOUNT']), taxable_amount: safeNumber(e['TAXABLEAMOUNT']), amount: safeNumber(e['AMOUNT']), gst_rate: safeNumber(e['GSTRATE']), gst_amount: safeNumber(e['GSTAMOUNT']) }); } } catch(_){}
  return items;
}

function parseEntries(v: Record<string, unknown>): ParsedVoucherLedgerEntry[] {
  const entries: ParsedVoucherLedgerEntry[] = [];
  try { const ae = v['ALLLEDGERENTRIES'] as Record<string,unknown>|undefined; const list = (ae?.['LIST']??ae?.['LEDGERENTRY']??[]) as unknown[]; for (const entry of Array.isArray(list)?list:[list]) { const e = entry as Record<string,unknown>; if (!e||!e['LEDGERNAME']) continue; entries.push({ ledger_name: safeText(e['LEDGERNAME']), ledger_guid: safeGuid(e['LEDGERGUID']), is_deemed_positive: safeText(e['ISDEEMEDPOSITIVE'])==='Yes', debit: safeNumber(e['DEBIT']??e['AMOUNT']), credit: safeNumber(e['CREDIT']??e['AMOUNT']), amount: safeNumber(e['AMOUNT']), entry_type: safeText(e['ENTRYTYPE']??e['LEDGERENTRYTYPE']) }); } } catch(_){}
  return entries;
}

function parseTaxes(v: Record<string, unknown>): ParsedVoucherTax[] {
  const taxes: ParsedVoucherTax[] = [];
  try { const te = v['TAXENTRIES'] as Record<string,unknown>|undefined; const list = (te?.['LIST']??te?.['TAXENTRY']??[]) as unknown[]; for (const entry of Array.isArray(list)?list:[list]) { const e = entry as Record<string,unknown>; if (!e) continue; taxes.push({ tax_type: safeText(e['TAXTYPE']??e['LEDGERNAME']), ledger_name: safeText(e['LEDGERNAME']), amount: safeNumber(e['AMOUNT']), rate: safeNumber(e['RATE']??e['TAXPERCENTAGE']) }); } } catch(_){}
  return taxes;
}

function deepSearch(xmlData: Record<string, unknown>): ParsedVoucher[] {
  const r: ParsedVoucher[] = [];
  function s(obj: unknown, d: number) {
    if (!obj || d > 15) return;
    if (Array.isArray(obj)) { for (const item of obj) { if (item && typeof item === 'object') { const o = item as Record<string,unknown>; if (o['VOUCHERNUMBER']||o['VOUCHERDATE']||o['VOUCHERTYPENAME']) { const p = parseOne(o); if (p) r.push(p); } s(o,d+1); } } }
    else if (typeof obj === 'object') { const o = obj as Record<string,unknown>; for (const k of ['VOUCHER','LIST','COLLECTION','DATA']) { const v = o[k]; if (Array.isArray(v)) s(v,d+1); } for (const v of Object.values(o)) { if (v && typeof v==='object'&&!Array.isArray(v)&&d<10) s(v,d+1); } }
  }
  s(xmlData,0);
  console.log(`[VoucherParser] Deep search: ${r.length}`);
  return r;
}
