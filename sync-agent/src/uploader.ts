import { createClient } from '@supabase/supabase-js';
import { AgentConfig } from './config';
import { Logger } from 'winston';
import { SyncRecords } from './transform';

const MAX_BATCH_VOUCHERS = 100;

export class Uploader {
  private supabase: any;
  private logger: Logger;
  private ingestUrl: string;
  private heartbeatUrl: string;
  currentCompany: string | null = null;
  endpoint: string = '';
  recordsSynced: number = 0;
  lastError: string | null = null;

  constructor(config: AgentConfig, logger: Logger) {
    this.logger = logger;
    this.endpoint = config.tally_endpoint;
    this.supabase = createClient(config.supabase_url, config.supabase_anon_key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.ingestUrl = `${config.supabase_url}/functions/v1/sync-ingest`;
    this.heartbeatUrl = `${config.supabase_url}/functions/v1/heartbeat`;
  }

  async sendHeartbeat(): Promise<boolean> {
    try {
      const res = await fetch(this.heartbeatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(this.supabase as any).supabaseKey}`,
        },
        body: JSON.stringify({
          agent_connected: true,
          current_company: this.currentCompany,
          current_endpoint: this.endpoint,
          last_sync_at: new Date().toISOString(),
          records_synced: this.recordsSynced,
          errors: 0,
          last_error: this.lastError,
        }),
      });
      if (!res.ok) { this.logger.warn(`Heartbeat failed: ${res.status}`); return false; }
      const data = await res.json() as any;
      return data.force_full_sync === true;
    } catch (e) {
      this.logger.warn(`Heartbeat error: ${(e as Error).message}`);
      return false;
    }
  }

  async checkForceFullSyncRequest(): Promise<boolean> {
    return this.sendHeartbeat();
  }

  async uploadSync(
    companyName: string,
    syncType: 'full' | 'incremental' | 'initial',
    records: SyncRecords,
  ): Promise<any> {
    this.currentCompany = companyName;
    const result = await this._uploadSyncImpl(companyName, syncType, records);
    this.lastError = result.errors?.[0] || null;
    if (!this.lastError) this.recordsSynced += result.records_synced || 0;
    return result;
  }

  private async _uploadSyncImpl(
    companyName: string,
    syncType: 'full' | 'incremental' | 'initial',
    records: SyncRecords,
  ): Promise<any> {
    const mastersPresent = records.ledgers.length > 0 || records.stock_items.length > 0;

    const voucherKeys: (keyof SyncRecords)[] = [
      'sales_vouchers', 'purchase_vouchers', 'receipt_vouchers', 'payment_vouchers',
      'contra_vouchers', 'journal_vouchers', 'credit_notes', 'debit_notes',
      'daybook',
    ];

    const totalVouchers = voucherKeys.reduce((sum, k) => sum + (records[k] as any[]).length, 0);

    if (totalVouchers <= MAX_BATCH_VOUCHERS) {
      return this.uploadSingleChunk(companyName, syncType, records);
    }

    const aggregate: any = { records_synced: 0, errors: [], stats: {} };
    let isFirst = true;

    for (const vKey of voucherKeys) {
      const arr = records[vKey] as any[];
      if (arr.length === 0) continue;

      for (let i = 0; i < arr.length; i += MAX_BATCH_VOUCHERS) {
        const slice = arr.slice(i, i + MAX_BATCH_VOUCHERS);
        const chunkRecords: SyncRecords = { ...records };

        if (!isFirst) {
          chunkRecords.ledger_groups = [];
          chunkRecords.ledgers = [];
          chunkRecords.stock_groups = [];
          chunkRecords.units = [];
          chunkRecords.godowns = [];
          chunkRecords.stock_items = [];
          chunkRecords.outstanding_balances = [];
          chunkRecords.customers = null;
          chunkRecords.suppliers = null;
          chunkRecords.bank_accounts = null;
          chunkRecords.cash_accounts = null;
        }

        for (const k of voucherKeys) {
          (chunkRecords as any)[k] = k === vKey ? slice : [];
        }

        const result = await this.uploadSingleChunk(companyName, syncType, chunkRecords);
        aggregate.records_synced += result.records_synced || 0;
        if (result.errors?.length) aggregate.errors.push(...result.errors);
        Object.assign(aggregate.stats, result.stats || {});
        isFirst = false;
      }
    }

    return aggregate;
  }

  private async uploadSingleChunk(
    companyName: string,
    syncType: 'full' | 'incremental' | 'initial',
    records: SyncRecords,
  ): Promise<any> {
    const payload = {
      company_name: companyName,
      sync_type: syncType,
      started_at: new Date().toISOString(),
      agent_version: '2.0.0',
      records,
    };

    const res = await fetch(this.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(this.supabase as any).supabaseKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      throw new Error(`sync-ingest failed (${res.status}): ${json.error || text.slice(0, 200)}`);
    }
    return json;
  }
}
