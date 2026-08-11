import { XMLParser } from 'fast-xml-parser';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name: string, jpath: string) => {
    const arrayPaths = [
      'LEDGER',
      'LEDGERENTRIES.LIST',
      'LEDGERENTRIES.LEDGERENTRY.LIST',
      'STOCKITEM',
      'STOCKITEM.LIST',
      'VOUCHER',
      'VOUCHER.LIST',
      'ALLLEDGERENTRIES.LIST',
      'LEDGERENTRIES.LIST',
      'INVENTORYENTRIES.LIST',
      'BILLALLOCATIONS.LIST',
      'TAXENTRIES.LIST',
    ];
    return arrayPaths.some(p => jpath.endsWith(p));
  },
  textNodeName: '#text',
  trimValues: true,
  parseAttributeValue: true,
};

const parser = new XMLParser(parserOptions);

export function parseTallyXml(xml: string): Record<string, unknown> {
  return parser.parse(xml);
}

export function safeText(node: unknown, defaultValue: string = ''): string {
  if (!node) return defaultValue;
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    const textVal = obj['#text'];
    if (textVal !== undefined && textVal !== null) return String(textVal);
  }
  return defaultValue;
}

export function safeNumber(node: unknown, defaultValue: number = 0): number {
  const text = safeText(node, '');
  if (!text) return defaultValue;
  const num = parseFloat(text);
  return isNaN(num) ? defaultValue : num;
}

export function safeGuid(node: unknown): string {
  const text = safeText(node, '');
  return text.replace(/[{}]/g, '').trim();
}

export function extractTallyMessage(xmlData: Record<string, unknown>): Record<string, unknown> {
  const response = xmlData['RESPONSE'] as Record<string, unknown> | undefined;
  if (response) {
    console.log(`  [extractTallyMessage] Using RESPONSE path`);
    return response;
  }

  const envelope = xmlData['ENVELOPE'] as Record<string, unknown> | undefined;
  if (!envelope) return {};

  const body = envelope['BODY'];
  if (!body || typeof body !== 'object') return {};

  const b = body as Record<string, unknown>;
  const importData = b['IMPORTDATA'] as Record<string, unknown> | undefined;
  if (importData) {
    const requestData = importData['REQUESTDATA'] as Record<string, unknown> | undefined;
    if (requestData) {
      const tm = requestData['TALLYMESSAGE'];
      if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
    }
    const tm = importData['TALLYMESSAGE'];
    if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
  }

  const data = b['DATA'] as Record<string, unknown> | undefined;
  if (data) {
    const tm = data['TALLYMESSAGE'];
    if (tm && typeof tm === 'object') return tm as Record<string, unknown>;
    return data;
  }

  const tm = b['TALLYMESSAGE'];
  if (tm && typeof tm === 'object') return tm as Record<string, unknown>;

  return {};
}

export function diagnoseXmlResponse(label: string, xmlData: Record<string, unknown>): void {
  console.log(`\n[DIAG] ${label} — Response structure:`);

  const response = xmlData['RESPONSE'] as Record<string, unknown> | undefined;
  if (response) {
    const respKeys = Object.keys(response);
    console.log(`  RESPONSE keys: ${respKeys.join(', ')}`);
    for (const rk of respKeys) {
      const val = response[rk];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const subObj = val as Record<string, unknown>;
        const subKeys = Object.keys(subObj).slice(0, 15);
        console.log(`  RESPONSE.${rk} keys: ${subKeys.join(', ')}`);
        for (const sk of subKeys) {
          const sv = subObj[sk];
          if (Array.isArray(sv)) {
            console.log(`    ${rk}.${sk}: Array(${sv.length})`);
            if (sv.length > 0 && typeof sv[0] === 'object' && sv[0] !== null) {
              console.log(`      First item keys: ${Object.keys(sv[0] as object).slice(0, 10).join(', ')}`);
            }
          } else if (sv && typeof sv === 'object') {
            const deepKeys = Object.keys(sv as object).slice(0, 10);
            if (deepKeys.length > 0) console.log(`    ${rk}.${sk} keys: ${deepKeys.join(', ')}`);
          }
        }
      } else if (Array.isArray(val)) {
        console.log(`  RESPONSE.${rk}: Array(${val.length})`);
      } else {
        console.log(`  RESPONSE.${rk}: "${String(val).substring(0, 100)}"`);
      }
    }
    console.log('');
    return;
  }

  const envelope = xmlData['ENVELOPE'] as Record<string, unknown> | undefined;
  if (!envelope) {
    console.log(`  No RESPONSE or ENVELOPE. Top keys: ${Object.keys(xmlData).join(', ')}`);
    return;
  }

  const body = envelope['BODY'] as Record<string, unknown> | undefined;
  if (!body) { console.log(`  ENVELOPE keys: ${Object.keys(envelope).join(', ')}`); return; }
  console.log(`  BODY keys: ${Object.keys(body).join(', ')}`);
  console.log('');
}
