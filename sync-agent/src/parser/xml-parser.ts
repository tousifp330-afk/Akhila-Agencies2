import { XMLParser } from 'fast-xml-parser';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name: string, jpath: string) => {
    const ap = ['LEDGER','LEDGERENTRIES.LIST','LEDGERENTRIES.LEDGERENTRY.LIST','STOCKITEM','STOCKITEM.LIST','VOUCHER','VOUCHER.LIST','ALLLEDGERENTRIES.LIST','LEDGERENTRIES.LIST','INVENTORYENTRIES.LIST','BILLALLOCATIONS.LIST','TAXENTRIES.LIST'];
    return ap.some(p => jpath.endsWith(p));
  },
  textNodeName: '#text', trimValues: true, parseAttributeValue: true,
};
const parser = new XMLParser(parserOptions);

export function parseTallyXml(xml: string): Record<string, unknown> { return parser.parse(xml); }

export function safeText(node: unknown, d: string = ''): string {
  if (!node) return d;
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null) {
    const o = node as Record<string, unknown>;
    const tv = o['#text'];
    if (tv !== undefined && tv !== null) return String(tv);
  }
  return d;
}

export function safeNumber(node: unknown, d: number = 0): number {
  const t = safeText(node, ''); if (!t) return d;
  const n = parseFloat(t); return isNaN(n) ? d : n;
}

export function safeGuid(node: unknown): string {
  return safeText(node, '').replace(/[{}]/g, '').trim();
}

export function extractTallyMessage(xmlData: Record<string, unknown>): Record<string, unknown> {
  const envelope = xmlData['ENVELOPE'] as Record<string, unknown> | undefined;
  if (!envelope) return {};
  const body = envelope['BODY'];
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;

  // Path 1: IMPORTDATA -> REQUESTDATA -> TALLYMESSAGE
  const id = b['IMPORTDATA'] as Record<string, unknown> | undefined;
  if (id) {
    const rd = id['REQUESTDATA'] as Record<string, unknown> | undefined;
    if (rd) { const tm = rd['TALLYMESSAGE']; if (tm && typeof tm === 'object') return tm as Record<string, unknown>; }
    const tm = id['TALLYMESSAGE']; if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
  }

  // Path 2: DATA collection
  const data = b['DATA'] as Record<string, unknown> | undefined;
  if (data) {
    const tm = data['TALLYMESSAGE']; if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
    const coll = data['COLLECTION']; if (coll && typeof coll === 'object') return { COLLECTION: coll } as Record<string, unknown>;
    return data;
  }

  // Path 3: BODY -> TALLYMESSAGE directly
  const tm = b['TALLYMESSAGE']; if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
  return {};
}

export function diagnoseXmlResponse(label: string, xmlData: Record<string, unknown>): void {
  console.log(`\n[DIAG] ${label} — Response structure:`);
  const envelope = xmlData['ENVELOPE'] as Record<string, unknown> | undefined;
  if (!envelope) { console.log(`  No ENVELOPE. Top keys: ${Object.keys(xmlData).join(', ')}`); return; }
  const body = envelope['BODY'] as Record<string, unknown> | undefined;
  if (!body) { console.log(`  ENVELOPE keys: ${Object.keys(envelope).join(', ')}`); return; }
  const bodyKeys = Object.keys(body);
  console.log(`  BODY keys: ${bodyKeys.join(', ')}`);
  for (const bk of bodyKeys) {
    const val = body[bk];
    if (val && typeof val === 'object') {
      const subKeys = Object.keys(val).slice(0, 20);
      console.log(`  BODY.${bk} keys (${subKeys.length}): ${subKeys.join(', ')}`);
      for (const sk of subKeys) {
        const sv = (val as Record<string,unknown>)[sk];
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
          const dk = Object.keys(sv).slice(0, 10);
          if (dk.length > 0) console.log(`    ${bk}.${sk} keys: ${dk.join(', ')}`);
        } else if (Array.isArray(sv)) {
          console.log(`    ${bk}.${sk}: Array(${sv.length})`);
          if (sv.length > 0 && typeof sv[0] === 'object') console.log(`      First item keys: ${Object.keys(sv[0]).slice(0,10).join(', ')}`);
        }
      }
    } else if (Array.isArray(val)) {
      console.log(`  BODY.${bk}: Array(${val.length})`);
    } else {
      console.log(`  BODY.${bk}: "${String(val).substring(0, 100)}"`);
    }
  }
  console.log('');
}
