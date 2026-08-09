#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, loadState, saveState, getCompanyState, setCompanyState, AgentConfig, SyncState } from './config';
import { createLogger } from './logger';
import { TallyClient } from './tally';
import { Uploader } from './uploader';
import { runIncrementalSync, runForceFullSync, runInitialSync, countRecords } from './sync';
import { createTray, TrayHandlers } from './tray';
import { enableAutoStart, disableAutoStart } from './autostart';
import { Logger } from 'winston';

const MASTER_REFRESH_INTERVAL_MS = 86400000;

async function main() {
  const configPath = process.env.AGENT_CONFIG || path.join(__dirname, '..', 'config.json');
  let config: AgentConfig;
  let logger: Logger;
  try { config = loadConfig(configPath); logger = createLogger(config); }
  catch (e) { console.error(`Configuration error: ${(e as Error).message}`); process.exit(1); }

  logger.info(`Akhila ERP Sync Agent starting (endpoint=${config.tally_endpoint})`);
  const tally = new TallyClient(config, logger);
  const uploader = new Uploader(config, logger);
  let state: SyncState = loadState(config);
  let autoSyncEnabled = true;
  let syncing = false;
  let lastStatus = 'idle';
  let forceFullSyncRequested = false;

  async function sendHeartbeat() {
    const forceFull = await uploader.sendHeartbeat();
    if (forceFull) { logger.info('Force full sync requested from Settings page'); await syncAll(true); }
  }

  async function syncCompany(companyName: string, isForceFull: boolean, isInitial = false) {
    if (syncing) { logger.warn('Sync already in progress; skipping'); return; }
    syncing = true;
    lastStatus = `syncing ${companyName}`;
    const startedAt = new Date();
    try {
      const cs = getCompanyState(state, companyName);
      const mastersDue = !cs.last_master_sync || (Date.now() - new Date(cs.last_master_sync).getTime()) > MASTER_REFRESH_INTERVAL_MS;
      let records; let syncType: 'initial' | 'full' | 'incremental';
      if (isInitial) { logger.info(`INITIAL sync for ${companyName}`); records = await runInitialSync(tally, companyName, logger); syncType = 'initial'; }
      else if (isForceFull) { logger.info(`Force full sync for ${companyName}`); records = await runForceFullSync(tally, companyName, logger); syncType = 'full'; }
      else { logger.info(`Incremental sync for ${companyName}`); records = await runIncrementalSync(tally, companyName, { lastVoucherSync: cs.last_voucher_sync, refreshMastersNow: mastersDue, lastLedgerCount: cs.last_ledger_count || 0, lastStockItemCount: cs.last_stock_item_count || 0 }, logger); syncType = 'incremental'; }

      const result = await uploader.uploadSync(companyName, syncType, records);
      state.last_company = companyName;
      state.records_synced += result.records_synced || countRecords(records);
      state.last_error = result.errors?.[0] || null;
      const ledgerCount = records.ledgers?.length || cs.last_ledger_count || 0;
      const stockItemCount = records.stock_items?.length || cs.last_stock_item_count || 0;
      setCompanyState(state, companyName, { last_voucher_sync: startedAt.toISOString().slice(0, 10), last_master_sync: isForceFull || mastersDue || isInitial ? startedAt.toISOString() : cs.last_master_sync, initial_sync_completed: isInitial ? true : cs.initial_sync_completed, last_ledger_count: ledgerCount, last_stock_item_count: stockItemCount });
      saveState(config, state);
      lastStatus = `synced ${companyName} (${result.records_synced || 0} records)`;
      logger.info(`Sync complete for ${companyName}: ${JSON.stringify(result.stats || {})}`);
    } catch (e) {
      state.last_error = (e as Error).message; saveState(config, state);
      lastStatus = `error: ${(e as Error).message}`;
      logger.error(`Sync failed for ${companyName}: ${(e as Error).message}`);
    } finally { syncing = false; }
  }

  async function syncAll(isForceFull: boolean) {
    for (const company of config.companies) { await syncCompany(company, isForceFull); }
    forceFullSyncRequested = false;
  }

  await sendHeartbeat();
  if (config.start_with_windows) await enableAutoStart(logger);

  for (const companyName of config.companies) {
    const cs = getCompanyState(state, companyName);
    if (!cs.initial_sync_completed) { logger.info(`Initial Sync required for ${companyName} (first run)`); await syncCompany(companyName, false, true); }
  }
  await syncAll(false);

  const heartbeatTimer = setInterval(sendHeartbeat, config.heartbeat_interval_ms);
  const incrementalTimer = setInterval(() => { if (autoSyncEnabled && !syncing) { syncAll(false).catch(e => logger.error(`Incremental sync: ${e.message}`)); } }, config.sync_interval_ms);

  const trayHandlers: TrayHandlers = { onSyncNow: async () => { await syncAll(false); }, onToggleAutoSync: () => { autoSyncEnabled = !autoSyncEnabled; logger.info(`Auto-sync ${autoSyncEnabled ? 'enabled' : 'disabled'}`); }, isAutoSyncEnabled: () => autoSyncEnabled, onExit: () => shutdown(), getStatusText: () => lastStatus };
  const tray = config.system_tray ? createTray(trayHandlers, logger) : null;

  function shutdown() { logger.info('Shutting down agent...'); clearInterval(heartbeatTimer); clearInterval(incrementalTimer); uploader.lastError = 'Agent stopped'; uploader.sendHeartbeat().catch(() => {}); if (tray) tray.kill(); setTimeout(() => process.exit(0), 500); }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  logger.info('Agent is running. Press Ctrl+C to stop.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
