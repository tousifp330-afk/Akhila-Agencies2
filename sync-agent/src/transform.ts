/**
 * Transform raw Tally XML nodes (parsed + normalized by tally.ts)
 * into the flat record shapes expected by the sync-ingest edge function.
 *
 * Tally XML uses tags like: GUID, NAME, PARENT, OPENINGBALANCE,
 * CLOSINGBALANCE, LEDGERENTRIES.LIST, ALLINVENTORYENTRIES.LIST, etc.
 * The normalizer in tally.ts converts these to lowercase with underscores
 * replacing dots: guid, name, parent, openingbalance, ledgerentries.list
 *
 * The transform functions here map these to the fields the ingest
 * edge function expects (which handles both lower + UPPER case).
 */

export type SyncRecords = {
  ledger_groups: any[];
  ledgers: any[];
  customers: any[] | null;
  suppliers: any[] | null;
  stock_groups: any[];
  units: any[];
  godowns: any[];
  gst_rates: any[];
  stock_items: any[];
  batches: any[];
  bank_accounts: any[] | null;
  cash_accounts: any[] | null;
  sales_vouchers: any[];
  purchase_vouchers: any[];
  receipt_vouchers: any[];
  payment_vouchers: any[];
  contra_vouchers: any[];
  journal_vouchers: any[];
  credit_notes: any[];
  debit_notes: any[];
  outstanding_balances: any[];
  daybook: any[];
};

export function emptyRecords(): SyncRecords {
  return {
    ledger_groups: [], ledgers: [], customers: null, suppliers: null,
    stock_groups: [], units: [], godowns: [], gst_rates: [], stock_items: [],
    batches: [], bank_accounts: null, cash_accounts: null,
    sales_vouchers: [], purchase_vouchers: [], receipt_vouchers: [],
    payment_vouchers: [], contra_vouchers: [], journal_vouchers: [],
    credit_notes: [], debit_notes: [], outstanding_balances: [], daybook: [],
  };
}

/** Extract GUID from a normalized voucher/ledger node. */
function getGuid(raw: any): string | null {
  return raw.guid || raw.masterid || null;
}

/** Extract NAME attribute — in collection responses, the name is often an attribute. */
function getName(raw: any): string | null {
  return raw.name || null;
}

/** Get a string value from possible keys (lowercase normalized). */
function pickStr(raw: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/** Get a numeric value, cleaning commas and non-numeric chars. */
function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Parse Tally amount string which may have "Dr" / "Cr" suffix. */
function tallyAmount(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/,/g, '').trim();
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Extract a ledger entry (line item) from a voucher LEDGERENTRIES.LIST node. */
function transformLedgerEntry(e: any): any {
  const amount = num(e.amount ?? e.amt);
  const isDeemedPositive = pickStr(e, 'isdeemedpositive', 'isdeemedpos');
  let debit = num(e.debitamount ?? e.debit);
  let credit = num(e.creditamount ?? e.credit);
  if (debit === 0 && credit === 0 && amount !== 0) {
    if (isDeemedPositive === 'Yes') debit = amount;
    else credit = amount;
  }
  return {
    ledger_name: pickStr(e, 'ledgername', 'ledger', 'ledgerfromitem'),
    debit,
    credit,
    quantity: num(e.actualqty ?? e.quantity ?? e.billedqty),
    rate: num(e.rate ?? e.rateperunit),
    narration: pickStr(e, 'narration'),
    hsn: pickStr(e, 'hsncode', 'hsn'),
    batch_name: pickStr(e, 'batchdetails', 'batch'),
    godown: pickStr(e, 'godown', 'godownname'),
    stock_item: pickStr(e, 'stockitemname', 'stockitem', 'item'),
  };
}

/** Extract an inventory entry from a voucher ALLINVENTORYENTRIES.LIST node. */
function transformInventoryEntry(e: any): any {
  const batchList = e['batchallocations.list'];
  let batchName: string | null = null;
  let batchQty = 0;
  if (Array.isArray(batchList) && batchList.length > 0) {
    batchName = pickStr(batchList[0], 'batchname', 'batchno', 'batch');
    batchQty = num(batchList[0].quantity ?? batchList[0].actualqty);
  } else {
    batchName = pickStr(e, 'batchname', 'batchno', 'batch');
    batchQty = num(e.quantity);
  }
  return {
    stock_item: pickStr(e, 'stockitemname', 'stockitem', 'item'),
    godown: pickStr(e, 'godownname', 'godown'),
    quantity: num(e.actualqty ?? e.quantity ?? e.billedqty),
    rate: num(e.rate ?? e.rateperunit),
    amount: num(e.amount ?? e.inventoryvalue),
    hsn: pickStr(e, 'hsncode', 'hsn'),
    batch_name: batchName,
    batch_quantity: batchQty,
  };
}

/**
 * Classify ledger based ONLY on Tally Parent Group name.
 * Never uses ledger names — purely parent-group-driven classification.
 *
 * Rules:
 *   Sundry Debtors   → Customer
 *   Sundry Creditors  → Supplier
 *   Bank Accounts     → Bank
 *   Cash-in-Hand      → Cash
 *   All remaining     → General Ledger (no flags)
 */
function classifyLedger(groupName: string | null): { is_customer: boolean; is_supplier: boolean; is_bank: boolean; is_cash: boolean } {
  if (!groupName) return { is_customer: false, is_supplier: false, is_bank: false, is_cash: false };
  const g = groupName.toLowerCase().trim();
  // Strict classification — exact parent group match (not substring guessing)
  if (g === 'sundry debtors') return { is_customer: true, is_supplier: false, is_bank: false, is_cash: false };
  if (g === 'sundry creditors') return { is_customer: false, is_supplier: true, is_bank: false, is_cash: false };
  if (g === 'bank accounts' || g === 'bank od a/c' || g === 'bank occ a/c') return { is_customer: false, is_supplier: false, is_bank: true, is_cash: false };
  if (g === 'cash-in-hand') return { is_customer: false, is_supplier: false, is_bank: false, is_cash: true };
  return { is_customer: false, is_supplier: false, is_bank: false, is_cash: false };
}

export function transformLedger(raw: any): any {
  const groupName = pickStr(raw, 'parent', 'group', 'groupname') || null;
  const cls = classifyLedger(groupName);
  return {
    guid: getGuid(raw),
    name: getName(raw),
    group: groupName,
    parent: groupName,
    opening_balance: tallyAmount(raw.openingbalance),
    closing_balance: tallyAmount(raw.closingbalance),
    gst_number: pickStr(raw, 'gstnumber', 'gstpanofparty', 'partygstin', 'gstin'),
    phone: pickStr(raw, 'phone', 'phonenumber'),
    address: pickStr(raw, 'address', 'mailingaddress') || extractAddress(raw),
    is_customer: cls.is_customer,
    is_supplier: cls.is_supplier,
    is_bank: cls.is_bank,
    is_cash: cls.is_cash,
  };
}

function extractAddress(raw: any): string | null {
  const list = raw['address.list'];
  if (Array.isArray(list)) return list.filter(Boolean).join(', ');
  if (typeof list === 'string') return list;
  return null;
}

export function transformLedgerGroup(raw: any): any {
  return {
    guid: getGuid(raw),
    name: getName(raw),
    parent_guid: pickStr(raw, 'parent'),
    parent: pickStr(raw, 'parent'),
    nature: pickStr(raw, 'nature', 'groupnature'),
  };
}

export function transformStockItem(raw: any): any {
  return {
    guid: getGuid(raw),
    name: getName(raw),
    group: pickStr(raw, 'parent', 'group', 'groupname') || null,
    parent: pickStr(raw, 'parent'),
    unit: pickStr(raw, 'baseunits', 'unit', 'parentunit') || null,
    gst_rate: pickStr(raw, 'gstrate', 'gstdetails', 'gstapplicable'),
    opening_stock: tallyAmount(raw.openingbalance),
    opening_value: tallyAmount(raw.openingvalue ?? raw.openingamount),
    rate: tallyAmount(raw.standardprice ?? raw.rate),
    current_stock: tallyAmount(raw.closingbalance ?? raw.balance) || tallyAmount(raw.openingbalance),
    current_value: tallyAmount(raw.closingvalue ?? raw.balance) || tallyAmount(raw.openingvalue ?? raw.openingamount),
  };
}

export function transformStockGroup(raw: any): any {
  return {
    guid: getGuid(raw),
    name: getName(raw),
    parent_guid: pickStr(raw, 'parent'),
    parent: pickStr(raw, 'parent'),
  };
}

export function transformGodown(raw: any): any {
  return {
    guid: getGuid(raw),
    name: getName(raw),
  };
}

export function transformUnit(raw: any): any {
  return {
    guid: getGuid(raw),
    name: getName(raw),
    symbol: pickStr(raw, 'symbol', 'name'),
  };
}

/**
 * Transform a voucher node into the flat shape expected by sync-ingest.
 * Extracts header fields + ledger entries (line items).
 * GST fields are extracted from the LEDGERENTRIES sub-nodes where Tally
 * nests them (CGST, SGST, IGST appear as separate ledger entries or
 * as tax analysis sub-objects depending on Tally version).
 */
export function transformVoucher(raw: any): any {
  const entriesList = raw['ledgerentries.list'] || raw.ledgerentries || [];
  const entries = (Array.isArray(entriesList) ? entriesList : [entriesList])
    .filter(Boolean)
    .map(transformLedgerEntry);

  const invList = raw['allinventoryentries.list'] || raw.allinventoryentries || [];
  const inventory = (Array.isArray(invList) ? invList : [invList])
    .filter(Boolean)
    .map(transformInventoryEntry);

  // Tally nests GST amounts in the ledger entries — sum them up
  let cgst = 0, sgst = 0, igst = 0, taxableAmount = 0;
  for (const e of entries) {
    const name = (e.ledger_name || '').toLowerCase();
    if (/cgst/i.test(name)) cgst += e.debit || e.credit || 0;
    else if (/sgst/i.test(name)) sgst += e.debit || e.credit || 0;
    else if (/igst/i.test(name)) igst += e.debit || e.credit || 0;
  }

  // Party name: prefer explicit party field from Tally, fall back to first entry's ledger
  const partyName = pickStr(raw, 'partyledgername', 'partyname', 'party_account')
    || (entries.length > 0 ? entries[0].ledger_name : null);
  // Total = sum of all debits (for sales/receipts) — credit total computed separately
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  // For purchase/credit-note type vouchers, total is on the credit side
  const typeNameLower = (pickStr(raw, 'vouchertypename', 'vouchertype', 'voucher_type', 'vchtype') || '').toLowerCase();
  const isPurchaseLike = /purchase|credit note/i.test(typeNameLower);
  const total = isPurchaseLike ? totalCredit : totalDebit;

  const date = pickStr(raw, 'date', 'voucherdate') || null;
  const voucherNumber = pickStr(raw, 'vouchernumber', 'number', 'voucher_number') || null;
  const voucherType = pickStr(raw, 'vouchertypename', 'vouchertype', 'voucher_type', 'vchtype') || null;

  return {
    guid: getGuid(raw),
    voucher_type: voucherType,
    voucher_number: voucherNumber,
    voucher_date: date,
    date: date,
    party_name: pickStr(raw, 'partyledgername', 'partyname', 'party_account') || partyName,
    party: pickStr(raw, 'partyledgername', 'partyname'),
    narration: pickStr(raw, 'narration'),
    taxable_amount: taxableAmount || (total - cgst - sgst - igst),
    cgst,
    sgst,
    igst,
    total_amount: total,
    amount: total,
    total_debit: totalDebit,
    total_credit: totalCredit,
    entries,
    ledger_entries: entries,
    lines: entries,
    inventory_entries: inventory,
  };
}

export function transformDaybook(raw: any): any {
  // Daybook rows come from individual voucher line items
  const vType = pickStr(raw, 'vouchertypename', 'vouchertype', 'voucher_type');
  const vNumber = pickStr(raw, 'vouchernumber', 'number', 'voucher_number');
  const date = pickStr(raw, 'date', 'voucherdate');
  const narration = pickStr(raw, 'narration');

  const entriesList = raw['ledgerentries.list'] || raw.ledgerentries || [];
  const entries = Array.isArray(entriesList) ? entriesList : [entriesList];

  if (entries.length === 0) {
    return [{
      voucher_type: vType,
      voucher_number: vNumber,
      voucher_date: date,
      ledger_name: null,
      debit: 0,
      credit: 0,
      narration,
    }];
  }

  return entries.filter(Boolean).map((e: any) => ({
    voucher_type: vType,
    voucher_number: vNumber,
    voucher_date: date,
    ledger_name: pickStr(e, 'ledgername', 'ledger'),
    debit: num(e.debitamount ?? e.debit),
    credit: num(e.creditamount ?? e.credit),
    narration: pickStr(e, 'narration') || narration,
  }));
}
