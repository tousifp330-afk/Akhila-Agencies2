import { Logger } from 'winston';
import { TallyClient, tallyDate } from './tally';
import {
  SyncRecords, emptyRecords,
  transformLedger, transformLedgerGroup, transformStockItem, transformStockGroup,
  transformGodown, transformUnit, transformVoucher,
} from './transform';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = typeof v === 'string' ? v.replace(/,/g, '').trim() : String(v);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Today in Tally date format: "2-Aug-2026" */
function today(): string {
  return tallyDate(new Date());
}

function parseTallyDate(s: string): Date {
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    return new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  return new Date(s);
}

export function countRecords(r: SyncRecords): number {
  return Object.values(r).reduce((acc, v) => {
    if (Array.isArray(v)) return acc + v.length;
    return acc;
  }, 0);
}

// ─── Voucher type routing ────────────────────────────────────────────────────

const VOUCHER_TYPE_KEY: Record<string, keyof SyncRecords> = {
  'sales':        'sales_vouchers',
  'purchase':     'purchase_vouchers',
  'receipt':      'receipt_vouchers',
  'payment':      'payment_vouchers',
  'contra':       'contra_vouchers',
  'journal':      'journal_vouchers',
  'credit note':  'credit_notes',
  'debit note':   'debit_notes',
  'credit notes': 'credit_notes',
  'debit notes':  'debit_notes',
};

// ─── Outstanding derivation ──────────────────────────────────────────────────

function deriveOutstanding(ledgers: any[]): any[] {
  const rows: any[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const l of ledgers) {
    const closing = Number(l.closing_balance) || 0;
    if (closing === 0) continue;
    if (l.is_customer) {
      rows.push({ ledger_name: l.name, kind: 'receivable', amount: Math.abs(closing), overdue_amount: 0, as_of_date: todayIso });
    } else if (l.is_supplier) {
      rows.push({ ledger_name: l.name, kind: 'payable', amount: Math.abs(closing), overdue_amount: 0, as_of_date: todayIso });
    }
  }
  return rows;
}

// ─── Daybook derivation ──────────────────────────────────────────────────────

function buildDaybookFromVouchers(records: SyncRecords): any[] {
  const rows: any[] = [];
  const voucherKeys: (keyof SyncRecords)[] = [
    'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'payment_vouchers',
    'contra_vouchers', 'journal_vouchers', 'credit_notes', 'debit_notes',
  ];
  const typeMap: Record<string, string> = {
    sales_vouchers: 'Sales', purchase_vouchers: 'Purchase',
    receipt_vouchers: 'Receipt', payment_vouchers: 'Payment',
    contra_vouchers: 'Contra', journal_vouchers: 'Journal',
    credit_notes: 'Credit Note', debit_notes: 'Debit Note',
  };
  for (const key of voucherKeys) {
    const vType = typeMap[key] || key;
    for (const v of records[key] as any[]) {
      const entries = v.entries || v.ledger_entries || v.lines || [];
      if (entries.length === 0) {
        rows.push({ voucher_type: vType, voucher_number: v.voucher_number, voucher_date: v.voucher_date, ledger_name: null, debit: 0, credit: 0, narration: v.narration });
      } else {
        for (const e of entries) {
          rows.push({ voucher_type: vType, voucher_number: v.voucher_number, voucher_date: v.voucher_date, ledger_name: e.ledger_name, debit: e.debit, credit: e.credit, narration: e.narration || v.narration });
        }
      }
    }
  }
  return rows;
}

// ─── Voucher extraction ──────────────────────────────────────────────────────

async function fetchVouchersForRange(
  tally: TallyClient,
  companyName: string,
  fromDate: string,
  toDate: string,
  records: SyncRecords,
  logger: Logger,
): Promise<number> {
  let vouchers: any[] = [];

  try {
    vouchers = await tally.exportVouchersCollection(companyName, fromDate, toDate);
  } catch (collErr) {
    logger.info(`  Collection failed (${(collErr as Error).message}), trying Daybook...`);
    try {
      vouchers = await tally.exportVouchers(companyName, fromDate, toDate);
    } catch (dbErr) {
      logger.warn(`  Daybook also failed: ${(dbErr as Error).message}`);
      return 0;
    }
  }

  for (const v of vouchers) {
    const typeName = (v.voucher_type || v.vouchertypename || v.vouchertype || v.vchtype || '').toLowerCase().trim();
    const key = VOUCHER_TYPE_KEY[typeName];
    if (key) (records[key] as any[]).push(transformVoucher(v));
  }
  if (vouchers.length > 0) logger.info(`  Vouchers ${fromDate}→${toDate}: ${vouchers.length} fetched`);
  return vouchers.length;
}

// ─── Masters refresh ─────────────────────────────────────────────────────────

export async function refreshMasters(
  tally: TallyClient,
  companyName: string,
  logger: Logger,
): Promise<Pick<SyncRecords, 'ledger_groups' | 'ledgers' | 'stock_groups' | 'units' | 'godowns' | 'stock_items'>> {
  const records = {
    ledger_groups: [] as any[],
    ledgers: [] as any[],
    stock_groups: [] as any[],
    units: [] as any[],
    godowns: [] as any[],
    stock_items: [] as any[],
  };

  try {
    records.ledger_groups = (await tally.exportLedgerGroups(companyName)).map(transformLedgerGroup);
    logger.info(`Masters: ${records.ledger_groups.length} ledger groups`);
  } catch (e) { logger.warn(`ledger_groups: ${(e as Error).message}`); }

  try {
    records.ledgers = (await tally.exportLedgers(companyName)).map(transformLedger);
    logger.info(`Masters: ${records.ledgers.length} ledgers`);
  } catch (e) { logger.warn(`ledgers: ${(e as Error).message}`); }

  try {
    records.stock_groups = (await tally.exportStockGroups(companyName)).map(transformStockGroup);
    logger.info(`Masters: ${records.stock_groups.length} stock groups`);
  } catch (e) { logger.warn(`stock_groups: ${(e as Error).message}`); }

  try {
    records.units = (await tally.exportUnits(companyName)).map(transformUnit);
    logger.info(`Masters: ${records.units.length} units`);
  } catch (e) { logger.warn(`units: ${(e as Error).message}`); }

  try {
    records.godowns = (await tally.exportGodowns(companyName)).map(transformGodown);
    logger.info(`Masters: ${records.godowns.length} godowns`);
  } catch (e) { logger.warn(`godowns: ${(e as Error).message}`); }

  try {
    records.stock_items = (await tally.exportStockItems(companyName)).map(transformStockItem);
    logger.info(`Masters: ${records.stock_items.length} stock items`);
  } catch (e) { logger.warn(`stock_items: ${(e as Error).message}`); }

  return records;
}

// ─── Main sync function ──────────────────────────────────────────────────────

export interface IncrementalSyncOptions {
  lastVoucherSync: string | null;
  refreshMastersNow: boolean;
  lastLedgerCount: number;
  lastStockItemCount: number;
}

export async function runIncrementalSync(
  tally: TallyClient,
  companyName: string,
  options: IncrementalSyncOptions,
  logger: Logger,
): Promise<SyncRecords> {
  const records = emptyRecords();
  const toDate = today();

  let fromDate: string;
  if (options.lastVoucherSync) {
    const lastDate = parseTallyDate(options.lastVoucherSync);
    lastDate.setDate(lastDate.getDate() - 1);
    fromDate = tallyDate(lastDate);
  } else {
    const now = new Date();
    const fyYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    fromDate = `1-Apr-${fyYear}`;
    logger.info(`First run: syncing vouchers from current FY start ${fromDate}`);
  }

  logger.info(`Syncing vouchers from ${fromDate} to ${toDate}`);

  const fromD = parseTallyDate(fromDate);
  const toD = parseTallyDate(toDate);
  const dayDiff = Math.ceil((toD.getTime() - fromD.getTime()) / 86400000);
  let voucherCount = 0;
  if (dayDiff > 7) {
    let cursor = new Date(fromD);
    while (cursor <= toD) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > toD) weekEnd.setTime(toD.getTime());
      voucherCount += await fetchVouchersForRange(tally, companyName, tallyDate(cursor), tallyDate(weekEnd), records, logger);
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    voucherCount = await fetchVouchersForRange(tally, companyName, fromDate, toDate, records, logger);
  }
  logger.info(`Vouchers: ${voucherCount} total`);

  records.daybook = buildDaybookFromVouchers(records);

  try {
    const ledgers = await tally.exportLedgers(companyName);
    const { newLedgers } = detectNewMasters(ledgers, [], options.lastLedgerCount, 0);
    records.ledgers = ledgers.map((l: any) => ({
      ...transformLedger(l),
      _is_new: newLedgers.some((nl: any) => nl.name === l.name || nl['@_NAME'] === l['@_NAME']),
    }));
    if (newLedgers.length > 0) {
      logger.info(`Ledgers: ${records.ledgers.length} total, ${newLedgers.length} NEW (balances refreshed)`);
    } else {
      logger.info(`Ledgers: ${records.ledgers.length} (balances refreshed, no new ledgers)`);
    }
  } catch (e) { logger.warn(`ledgers refresh: ${(e as Error).message}`); }

  try {
    const stockItems = await tally.exportStockItems(companyName);
    const { newStockItems } = detectNewMasters([], stockItems, 0, options.lastStockItemCount);
    records.stock_items = stockItems.map((s: any) => ({
      ...transformStockItem(s),
      _is_new: newStockItems.some((ns: any) => ns.name === s.name || ns['@_NAME'] === s['@_NAME']),
    }));
    if (newStockItems.length > 0) {
      logger.info(`Stock items: ${records.stock_items.length} total, ${newStockItems.length} NEW (balances refreshed)`);
    } else {
      logger.info(`Stock items: ${records.stock_items.length} (balances refreshed, no new stock items)`);
    }
  } catch (e) { logger.warn(`stock items refresh: ${(e as Error).message}`); }

  records.outstanding_balances = deriveOutstanding(records.ledgers);
  logger.info(`Outstanding: ${records.outstanding_balances.length} (derived from ledgers)`);

  if (options.refreshMastersNow) {
    logger.info('Refreshing masters (due for 24h refresh)...');
    const masters = await refreshMasters(tally, companyName, logger);
    records.ledger_groups = masters.ledger_groups;
    records.stock_groups = masters.stock_groups;
    records.units = masters.units;
    records.godowns = masters.godowns;
  }

  logger.info(`Incremental sync done for ${companyName}: ${countRecords(records)} records`);
  return records;
}

export async function runForceFullSync(
  tally: TallyClient,
  companyName: string,
  logger: Logger,
): Promise<SyncRecords> {
  logger.info(`Force full sync for ${companyName} — current FY only`);
  const records = emptyRecords();

  const masters = await refreshMasters(tally, companyName, logger);
  records.ledger_groups = masters.ledger_groups;
  records.ledgers = masters.ledgers;
  records.stock_groups = masters.stock_groups;
  records.units = masters.units;
  records.godowns = masters.godowns;
  records.stock_items = masters.stock_items;

  const now = new Date();
  const fyYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const fromDate = `1-Apr-${fyYear}`;
  const toDate = today();
  logger.info(`Force full sync: fetching vouchers ${fromDate} → ${toDate}`);

  const cursor = parseTallyDate(fromDate);
  const end = parseTallyDate(toDate);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const batchTo = monthEnd > end ? end : monthEnd;
    const batchFrom = tallyDate(cursor);
    const batchToStr = tallyDate(batchTo);
    const count = await fetchVouchersForRange(tally, companyName, batchFrom, batchToStr, records, logger);
    if (count > 0) logger.info(`  ${batchFrom}→${batchToStr}: ${count} vouchers`);
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  records.daybook = buildDaybookFromVouchers(records);
  records.outstanding_balances = deriveOutstanding(records.ledgers);
  logger.info(`Force full sync done for ${companyName}: ${countRecords(records)} records`);
  return records;
}

export async function runInitialSync(
  tally: TallyClient,
  companyName: string,
  logger: Logger,
): Promise<SyncRecords> {
  logger.info(`INITIAL SYNC for ${companyName} — one-time full import`);
  const records = emptyRecords();

  logger.info('Initial Sync: importing all masters...');
  const masters = await refreshMasters(tally, companyName, logger);
  records.ledger_groups = masters.ledger_groups;
  records.ledgers = masters.ledgers;
  records.stock_groups = masters.stock_groups;
  records.units = masters.units;
  records.godowns = masters.godowns;
  records.stock_items = masters.stock_items;

  const fromDate = '1-Apr-2025';
  const toDate = today();
  logger.info(`Initial Sync: fetching vouchers ${fromDate} → ${toDate}`);

  const cursor = parseTallyDate(fromDate);
  const end = parseTallyDate(toDate);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const batchTo = monthEnd > end ? end : monthEnd;
    const batchFrom = tallyDate(cursor);
    const batchToStr = tallyDate(batchTo);
    const count = await fetchVouchersForRange(tally, companyName, batchFrom, batchToStr, records, logger);
    if (count > 0) logger.info(`  ${batchFrom}→${batchToStr}: ${count} vouchers`);
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  records.daybook = buildDaybookFromVouchers(records);
  records.outstanding_balances = deriveOutstanding(records.ledgers);
  logger.info(`Initial Sync done for ${companyName}: ${countRecords(records)} records`);
  return records;
}

export function detectNewMasters(
  currentLedgers: any[],
  currentStockItems: any[],
  lastLedgerCount: number,
  lastStockItemCount: number,
): { newLedgers: any[]; newStockItems: any[] } {
  if (lastLedgerCount === 0 && lastStockItemCount === 0) {
    return { newLedgers: currentLedgers, newStockItems: currentStockItems };
  }
  const newLedgers = currentLedgers.length > lastLedgerCount
    ? currentLedgers.slice(lastLedgerCount)
    : [];
  const newStockItems = currentStockItems.length > lastStockItemCount
    ? currentStockItems.slice(lastStockItemCount)
    : [];
  return { newLedgers, newStockItems };
}
