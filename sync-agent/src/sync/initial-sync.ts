import { TallyClient } from '../tally/client.js';
import { TallyRequestBuilder } from '../tally/request-builder.js';
import { parseTallyXml } from '../parser/xml-parser.js';
import { parseLedgers } from '../parser/ledger-parser.js';
import { parseStockItems } from '../parser/stock-parser.js';
import { parseVouchers, type ParsedVoucher } from '../parser/voucher-parser.js';
import { getCompanyId, getSyncState, getSupabaseClient, updateSyncState, recordSyncRun, bulkUpsert } from '../database/supabase-client.js';

const tallyClient = new TallyClient();

export async function runInitialSync(companyName: string): Promise<void> {
  console.log(`\n========================================\nINITIAL SYNC — ${companyName}\n========================================\n`);
  const companyId = await getCompanyId(companyName);
  if (!companyId) { console.error(`❌ Company not found in database.`); return; }
  const existingState = await getSyncState(companyId);
  if (existingState.initial_sync_completed) { console.error('❌ Initial Sync already completed. Use --rebuild.'); return; }

  const runStart = new Date();
  await updateSyncState(companyId, { current_sync_status: 'running', current_sync_started_at: runStart.toISOString(), initial_sync_started_at: runStart.toISOString() });
  let lc = 0, sc = 0, vc = 0, cuc = 0, suc = 0, bkc = 0, cac = 0;

  try {
    console.log('[1/3] Syncing ledger masters...');
    const lx = await tallyClient.sendRequest(TallyRequestBuilder.ledgerMasterRequest(companyName));
    const pl = parseLedgers(parseTallyXml(lx));
    console.log(`  Parsed ${pl.length} ledgers from Tally`);
    if (pl.length > 0) {
      const lr = pl.map(l => ({ company_id: companyId, tally_guid: l.tally_guid, master_id: l.master_id, name: l.name, parent_group: l.parent_group, parent_group_id: l.parent_group_id, opening_balance: l.opening_balance, closing_balance: l.closing_balance, balance_type: l.balance_type, classification: l.classification, is_customer: l.classification === 'customer', is_supplier: l.classification === 'supplier', is_bank: l.classification === 'bank', is_cash: l.classification === 'cash', address: l.address, gstin: l.gstin, state_name: l.state_name, pin_code: l.pin_code, contact_person: l.contact_person, phone: l.phone, email: l.email, pan: l.pan, updated_at: new Date().toISOString() }));
      const lrRes = await bulkUpsert('ledgers', lr, 'company_id,tally_guid');
      if (lrRes.error) throw new Error(`Ledger upsert failed: ${lrRes.error}`);
      lc = pl.length; cuc = pl.filter(l => l.classification === 'customer').length; suc = pl.filter(l => l.classification === 'supplier').length; bkc = pl.filter(l => l.classification === 'bank').length; cac = pl.filter(l => l.classification === 'cash').length;
      console.log(`  ✅ ${lc} ledgers (${cuc} customers, ${suc} suppliers, ${bkc} banks, ${cac} cash)`);
    }

    console.log('\n[2/3] Syncing stock items...');
    const sx = await tallyClient.sendRequest(TallyRequestBuilder.stockMasterRequest(companyName));
    const ps = parseStockItems(parseTallyXml(sx));
    console.log(`  Parsed ${ps.length} stock items from Tally`);
    if (ps.length > 0) {
      const sr = ps.map(s => ({ company_id: companyId, tally_guid: s.tally_guid, master_id: s.master_id, name: s.name, parent_group: s.parent_group, unit_name: s.unit_name, opening_balance: s.opening_balance, closing_balance: s.closing_balance, rate: s.rate, gst_applicable: s.gst_applicable, gst_rate: s.gst_rate, hsn_code: s.hsn_code, updated_at: new Date().toISOString() }));
      const srRes = await bulkUpsert('stock_items', sr, 'company_id,tally_guid');
      if (srRes.error) throw new Error(`Stock upsert failed: ${srRes.error}`);
      sc = ps.length;
      console.log(`  ✅ ${sc} stock items synced`);
    }

    console.log('\n[3/3] Syncing vouchers (01-Apr-2025 → today)...');
    const batches = genBatches(new Date('2025-04-01'), new Date());
    console.log(`  Processing ${batches.length} monthly batches...`);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  Batch ${i + 1}/${batches.length}: ${batch.from} → ${batch.to}`);
      try {
        const vx = await tallyClient.sendRequest(TallyRequestBuilder.voucherRegisterRequest(companyName, batch.from, batch.to));
        const pv = parseVouchers(parseTallyXml(vx));
        if (pv.length === 0) { console.log('    No vouchers'); continue; }
        console.log(`    Parsed ${pv.length} vouchers`);
        const vr = pv.map(v => ({ company_id: companyId, tally_guid: v.tally_guid, voucher_id_tally: v.voucher_id_tally, alter_id: v.alter_id, voucher_type: v.voucher_type, voucher_number: v.voucher_number, voucher_date: v.voucher_date, reference_number: v.reference_number, party_name: v.party_name, narration: v.narration, total_amount: v.total_amount, total_debit: v.total_debit, total_credit: v.total_credit, is_cancelled: v.is_cancelled, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
        const vrRes = await bulkUpsert('vouchers', vr, 'company_id,tally_guid');
        vc += vrRes.count;
        console.log(`    ✅ ${vrRes.count} vouchers synced`);
        if (!vrRes.error) await syncDetails(companyId, pv);
      } catch (be) { console.error(`    ❌ Batch failed: ${be}`); }
    }

    const runEnd = new Date();
    const totalRecords = vc + lc + sc;
    if (totalRecords === 0) {
      console.log(`\n⚠️  ZERO RECORDS — NOT marking sync complete!`);
      await updateSyncState(companyId, { current_sync_status: 'failed', current_sync_error: 'Zero records. Check [DIAG] output above.' });
      await recordSyncRun(companyId, { mode: 'initial', status: 'failed', started_at: runStart.toISOString(), voucher_count: 0, ledger_count: 0, stock_count: 0, error_message: 'Zero records parsed' });
      return;
    }

    await updateSyncState(companyId, { initial_sync_completed: true, initial_sync_completed_at: runEnd.toISOString(), last_successful_sync_at: runEnd.toISOString(), last_successful_voucher_date: new Date().toISOString().split('T')[0], current_sync_status: 'success', current_sync_error: null });
    await recordSyncRun(companyId, { mode: 'initial', status: 'success', started_at: runStart.toISOString(), completed_at: runEnd.toISOString(), date_range_start: '2025-04-01', date_range_end: new Date().toISOString().split('T')[0], voucher_count: vc, ledger_count: lc, stock_count: sc, customer_count: cuc, supplier_count: suc, bank_count: bkc, cash_count: cac });
    console.log(`\n========================================\nINITIAL SYNC COMPLETE ✅\nLedgers:${lc} Stock:${sc} Vouchers:${vc}\n========================================\n`);
  } catch (error) { const em = error instanceof Error ? error.message : String(error); console.error(`\n❌ FAILED: ${em}`); await updateSyncState(companyId, { current_sync_status: 'failed', current_sync_error: em }); await recordSyncRun(companyId, { mode: 'initial', status: 'failed', started_at: runStart.toISOString(), error_message: em }); throw error; }
}

async function syncDetails(companyId: string, pv: ParsedVoucher[]) {
  const s = getSupabaseClient(); const tgs = pv.map(v => v.tally_guid);
  const { data: vs } = await s.from('vouchers').select('id,tally_guid').in('tally_guid', tgs).eq('company_id', companyId);
  if (!vs || vs.length === 0) return;
  const g2i: Record<string, string> = {}; for (const v of vs) g2i[v.tally_guid] = v.id;
  const ai: Record<string, unknown>[] = []; const ae: Record<string, unknown>[] = []; const at: Record<string, unknown>[] = [];
  const vids = Object.values(g2i);
  for (const p of pv) { const vid = g2i[p.tally_guid]; if (!vid) continue; for (const item of p.items) ai.push({ ...item, voucher_id: vid, company_id: companyId } as Record<string,unknown>); for (const e of p.ledger_entries) ae.push({ ...e, voucher_id: vid, company_id: companyId } as Record<string,unknown>); for (const t of p.taxes) at.push({ ...t, voucher_id: vid, company_id: companyId } as Record<string,unknown>); }
  if (ai.length > 0) { if (vids.length > 0) await s.from('voucher_items').delete().in('voucher_id', vids); await bulkUpsert('voucher_items', ai, 'voucher_id'); }
  if (ae.length > 0) { if (vids.length > 0) await s.from('voucher_ledger_entries').delete().in('voucher_id', vids); await bulkUpsert('voucher_ledger_entries', ae, 'voucher_id'); }
  if (at.length > 0) { if (vids.length > 0) await s.from('voucher_taxes').delete().in('voucher_id', vids); await bulkUpsert('voucher_taxes', at, 'voucher_id'); }
}

function genBatches(start: Date, end: Date): Array<{ from: string; to: string }> {
  const bs: Array<{ from: string; to: string }> = []; const cur = new Date(start); const ti = (d: Date) => d.toISOString().split('T')[0];
  while (cur < end) { const bs2 = new Date(cur); cur.setMonth(cur.getMonth() + 1); const be2 = cur > end ? new Date(end) : new Date(cur.getTime() - 86400000); bs.push({ from: ti(bs2), to: ti(be2) }); }
  return bs;
}
