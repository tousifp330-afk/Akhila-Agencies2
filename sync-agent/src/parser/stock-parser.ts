import { safeText, safeNumber, safeGuid, extractTallyMessage, diagnoseXmlResponse } from './xml-parser.js';

export interface ParsedStockItem {
  tally_guid: string; master_id: string; name: string; parent_group: string; unit_name: string;
  opening_balance: number; closing_balance: number; rate: number; gst_applicable: boolean; gst_rate: number; hsn_code: string;
}

function extractItemList(parent: Record<string, unknown>, tagName: string): unknown[] {
  const val = parent[tagName];
  if (Array.isArray(val)) return val as unknown[];
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const list = obj['LIST']; if (Array.isArray(list)) return list as unknown[];
    const coll = obj['COLLECTION']; if (Array.isArray(coll)) return coll as unknown[];
  }
  return [];
}

export function parseStockItems(xmlData: Record<string, unknown>): ParsedStockItem[] {
  const items: ParsedStockItem[] = [];
  try {
    diagnoseXmlResponse('STOCKITEM', xmlData);
    const lm = extractTallyMessage(xmlData);
    if (Object.keys(lm).length === 0) { console.log('[StockParser] No TALLYMESSAGE. Deep search...'); return deepSearch(xmlData); }
    const sl = extractItemList(lm, 'STOCKITEM');
    console.log(`[StockParser] Found ${sl.length} items in TALLYMESSAGE`);
    if (sl.length === 0) { console.log('[StockParser] No STOCKITEM collection. Deep search...'); return deepSearch(xmlData); }
    for (const item of sl) {
      const s = item as Record<string, unknown>;
      if (!s || !(s['STOCKITEMNAME'] || s['NAME'])) continue;
      let gst = 0;
      const gd = s['GSTRATEDETAILS']; if (gd && typeof gd === 'object') gst = safeNumber((gd as Record<string, unknown>)['RATE']);
      if (gst === 0) gst = safeNumber(s['GSTRATE']);
      items.push({ tally_guid: safeGuid(s['GUID']), master_id: safeText(s['MASTERID']), name: safeText(s['STOCKITEMNAME'] ?? s['NAME']), parent_group: safeText(s['PARENT']), unit_name: safeText(s['BASEUNIT'] ?? s['UNIT']), opening_balance: safeNumber(s['OPENINGBALANCE']), closing_balance: safeNumber(s['CLOSINGBALANCE']), rate: safeNumber(s['STANDARDRATE'] ?? s['RATE']), gst_applicable: safeText(s['ISGSTAPPLICABLE']) === 'Yes', gst_rate: gst, hsn_code: safeText(s['HSNCODE'] ?? s['HSN']) });
    }
  } catch (e) { console.error('[StockParser] Error:', e); }
  console.log(`[StockParser] Total: ${items.length}`);
  return items;
}

function deepSearch(xmlData: Record<string, unknown>): ParsedStockItem[] {
  const r: ParsedStockItem[] = [];
  function s(obj: unknown, d: number) {
    if (!obj || d > 15) return;
    if (Array.isArray(obj)) { for (const item of obj) { if (item && typeof item === 'object') { const o = item as Record<string, unknown>; if (o['STOCKITEMNAME'] || o['NAME']) { let gst = 0; const gd = o['GSTRATEDETAILS']; if (gd && typeof gd === 'object') gst = safeNumber((gd as Record<string, unknown>)['RATE']); if (gst === 0) gst = safeNumber(o['GSTRATE']); r.push({ tally_guid: safeGuid(o['GUID']), master_id: safeText(o['MASTERID']), name: safeText(o['STOCKITEMNAME'] ?? o['NAME']), parent_group: safeText(o['PARENT']), unit_name: safeText(o['BASEUNIT'] ?? o['UNIT']), opening_balance: safeNumber(o['OPENINGBALANCE']), closing_balance: safeNumber(o['CLOSINGBALANCE']), rate: safeNumber(o['STANDARDRATE'] ?? o['RATE']), gst_applicable: safeText(o['ISGSTAPPLICABLE']) === 'Yes', gst_rate: gst, hsn_code: safeText(o['HSNCODE'] ?? o['HSN']) }); } s(o, d + 1); } } }
    else if (typeof obj === 'object') { const o = obj as Record<string, unknown>; for (const k of ['STOCKITEM','LIST','COLLECTION','DATA','REPORT']) { const v = o[k]; if (Array.isArray(v)) s(v, d + 1); } for (const v of Object.values(o)) { if (v && typeof v === 'object' && !Array.isArray(v) && d < 10) s(v, d + 1); } }
  }
  s(xmlData, 0);
  console.log(`[StockParser] Deep search: ${r.length}`);
  return r;
}
