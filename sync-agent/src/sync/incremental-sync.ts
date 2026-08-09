import { TallyClient } from '../tally/client.js';
import { TallyRequestBuilder } from '../tally/request-builder.js';
import { parseTallyXml } from '../parser/xml-parser.js';
import { parseLedgers } from '../parser/ledger-parser.js';
import { parseStockItems } from '../parser/stock-parser.js';
import { parseVouchers, type ParsedVoucher } from '../parser/voucher-parser.js';
import { getCompanyId, getSyncState, getSupabaseClient, updateSyncState, recordSyncRun, bulkUpsert } from '../database/supabase-client.js';

const tallyClient = new TallyClient();

export async function runIncrementalSync(companyName: string): Promise<void> {
  console.log(`\n========================================\nINCREMENTAL SYNC — ${companyName}\n========================================\n`);
  const companyId = await getCompanyId(companyName);
  if (!companyId) { console.error('❌ Company not found.'); return; }
  const ss = await getSyncState(companyId);
  if (!ss.initial_sync_completed) { console.error('❌ Initial Sync not completed. Run --init first.'); return; }
  const runStart = new Date();
  const lastDate: string = ss.last_successful_voucher_date || '2025-04-01';
  const today = new Date().toISOString().split('T')[0];
  if (lastDate >= today) { console.log('✅ Already up to date.'); return; }
  console.log(`Syncing ${lastDate} → ${today}`);
  await updateSyncState(companyId, { current_sync_status: 'running', current_sync_started_at: runStart.toISOString() });
  let lc = 0, sc = 0, vc = 0, cuc = 0, suc = 0;
  try {
    console.log('[1/3] Checking master data...');
    try { const lx = await tallyClient.sendRequest(TallyRequestBuilder.ledgerMasterRequest(companyName)); const pl = parseLedgers(parseTallyXml(lx)); const lr = pl.map(l => ({ company_id: companyId, tally_guid: l.tally_guid, master_id: l.master_id, name: l.name, parent_group: l.parent_group, parent_group_id: l.parent_group_id, opening_balance: l.opening_balance, closing_balance: l.closing_balance, balance_type: l.balance_type, classification: l.classification, is_customer: l.classification === 'customer', is_supplier: l.classification === 'supplier', is_bank: l.classification === 'bank', is_cash: l.classification === 'cash', updated_at: new Date().toISOString() })); const r = await bulkUpsert('ledgers', lr, 'company_id,tally_guid'); if (!r.error) { lc = pl.length; cuc = pl.filter(l => l.classification === 'customer').length; suc = pl.filter(l => l.classification === 'supplier').length; console.log(`  ✅ ${lc} ledgers`); } } catch (_) { console.warn('  ⚠️  Ledger sync warning'); }
    try { const sx = await tallyClient.sendRequest(TallyRequestBuilder.stockMasterRequest(companyName)); const ps = parseStockItems(parseTallyXml(sx)); const sr = ps.map(s => ({ company_id: companyId, tally_guid: s.tally_guid, master_id: s.master_id, name: s.name, parent_group: s.parent_group, unit_name: s.unit_name, opening_balance: s.opening_balance, closing_balance: s.closing_balance, rate: s.rate, gst_applicable: s.gst_applicable, gst_rate: s.gst_rate, hsn_code: s.hsn_code, updated_at: new Date().toISOString() })); const r = await bulkUpsert('stock_items', sr, 'company_id,tally_guid'); if (!r.error) { sc = ps.length; console.log(`  ✅ ${sc} stock items`); } } catch (_) { console.warn('  ⚠️  Stock sync warning'); }
    console.log(`\n[2/3] Syncing vouchers (${lastDate} → ${today})...`);
    try { const vx = await tallyClient.sendRequest(TallyRequestBuilder.voucherRegisterRequest(companyName, lastDate, today)); const pv = parseVouchers(parseTallyXml(vx)); if (pv.length === 0) { console.log('  No new vouchers'); } else { const vr = pv.map(v => ({ company_id: companyId, tally_guid: v.tally_guid, voucher_id_tally: v.voucher_id_tally, alter_id: v.alter_id, voucher_type: v.voucher_type, voucher_number: v.voucher_number, voucher_date: v.voucher_date, reference_number: v.reference_number, party_name: v.party_name, narration: v.narration, total_amount: v.total_amount, total_debit: v.total_debit, total_credit: v.total_credit, is_cancelled: v.is_cancelled, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })); const r = await bulkUpsert('vouchers', vr, 'company_id,tally_guid'); if (!r.error) { vc = r.count; console.log(`  ✅ ${vc} vouchers`); await syncDetailsInc(companyId, pv); } } } catch (e) { console.error(`  ❌ Voucher sync failed: ${e}`); }
    const runEnd = new Date();
    await updateSyncState(companyId, { last_successful_sync_at: runEnd.toISOString(), last_successful_voucher_date: today, current_sync_status: 'success', current_sync_error: null });
    await recordSyncRun(companyId, { mode: 'incremental', status: 'success', started_at: runStart.toISOString(), completed_at: runEnd.toISOString(), date_range_start: lastDate, date_range_end: today, voucher_count: vc, ledger_count: lc, stock_count: sc, customer_count: cuc, supplier_count: suc });
    console.log(`\n========================================\nINCREMENTAL SYNC COMPLETE ✅\nVouchers:${vc}\n========================================\n`);
  } catch (error) { const em = error instanceof Error ? error.message : String(error); console.error(`\n❌ FAILED: ${em}`); await updateSyncState(companyId, { current_sync_status: 'failed', current_sync_error: em }); await recordSyncRun(companyId, { mode: 'incremental', status: 'failed', started_at: runStart.toISOString(), error_message: em }); throw error; }
}

async function syncDetailsInc(companyId: string, parsedVouchers: ParsedVoucher[]) {
  const supabase = getSupabaseClient();
  const tallyGuids = parsedVouchers.map(v => v.tally_guid);
  const { data: vouchers } = await supabase.from('vouchers').select('id, tally_guid').in('tally_guid', tallyGuids).eq('company_id', companyId);
  if (!vouchers || vouchers.length === 0) return;
  const guidToId: Record<string, string> = {}; for (const v of vouchers) guidToId[v.tally_guid] = v.id;
  for (const pv of parsedVouchers) {
    const voucherId = guidToId[pv.tally_guid]; if (!voucherId) continue;
    if (pv.items.length > 0) { await supabase.from('voucher_items').delete().eq('voucher_id', voucherId); await bulkUpsert('voucher_items', pv.items.map(i => ({ ...i, voucher_id: voucherId, company_id: companyId } as Record<string,unknown>)), 'voucher_id'); }
    if (pv.ledger_entries.length > 0) { await supabase.from('voucher_ledger_entries').delete().eq('voucher_id', voucherId); await bulkUpsert('voucher_ledger_entries', pv.ledger_entries.map(e => ({ ...e, voucher_id: voucherId, company_id: companyId } as Record<string,unknown>)), 'voucher_id'); }
    if (pv.taxes.length > 0) { await supabase.from('voucher_taxes').delete().eq('voucher_id', voucherId); await bulkUpsert('voucher_taxes', pv.taxes.map(t => ({ ...t, voucher_id: voucherId, company_id: companyId } as Record<string,unknown>)), 'voucher_id'); }
  }
}
