import * as fs from 'fs';
import * as path from 'path';

export type AgentConfig = {
  supabase_url: string;
  supabase_anon_key: string;
  tally_endpoint: string;
  heartbeat_interval_ms: number;
  sync_interval_ms: number;
  master_refresh_interval_ms: number;
  log_level: string;
  log_dir: string;
  data_dir: string;
  start_with_windows: boolean;
  system_tray: boolean;
  companies: string[];
};

const DEFAULT_CONFIG: AgentConfig = {
  supabase_url: '',
  supabase_anon_key: '',
  tally_endpoint: 'http://localhost:9000',
  heartbeat_interval_ms: 30000,
  sync_interval_ms: 60000,
  master_refresh_interval_ms: 86400000,
  log_level: 'info',
  log_dir: './logs',
  data_dir: './data',
  start_with_windows: true,
  system_tray: true,
  companies: [
    'M/s Akhila Agencies - (from 1-Apr-23) - (from 1-Apr-24) - (from 1-Apr-25)',
    'M/s R.Vithoba Setty & Sons',
  ],
};

export function loadConfig(configPath: string): AgentConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config file not found at ${resolved}. Copy config.example.json to config.json and fill in your Supabase project URL and anon key.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  const merged: AgentConfig = { ...DEFAULT_CONFIG, ...raw };
  if (!merged.supabase_url || !merged.supabase_anon_key) {
    throw new Error('supabase_url and supabase_anon_key are required in config.json');
  }
  fs.mkdirSync(path.resolve(merged.log_dir), { recursive: true });
  fs.mkdirSync(path.resolve(merged.data_dir), { recursive: true });
  return merged;
}

export function stateFilePath(config: AgentConfig): string {
  return path.resolve(config.data_dir, 'sync-state.json');
}

export type CompanyState = {
  last_voucher_sync: string | null;
  last_master_sync: string | null;
  initial_sync_completed: boolean;
  last_ledger_count: number;
  last_stock_item_count: number;
};

export type SyncState = {
  companies: Record<string, CompanyState>;
  last_company: string | null;
  records_synced: number;
  last_error: string | null;
};

function defaultCompanyState(): CompanyState {
  return { last_voucher_sync: null, last_master_sync: null, initial_sync_completed: false, last_ledger_count: 0, last_stock_item_count: 0 };
}

export function loadState(config: AgentConfig): SyncState {
  const file = stateFilePath(config);
  if (!fs.existsSync(file)) {
    return { companies: {}, last_company: null, records_synced: 0, last_error: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!raw.companies) {
      const companies: Record<string, CompanyState> = {};
      for (const c of config.companies) {
        companies[c] = {
          last_voucher_sync: raw.last_synced_voucher_date || null,
          last_master_sync: raw.last_full_sync_at || raw.last_incremental_sync_at || null,
          initial_sync_completed: false,
          last_ledger_count: 0,
          last_stock_item_count: 0,
        };
      }
      return {
        companies,
        last_company: raw.last_company || null,
        records_synced: raw.records_synced || 0,
        last_error: raw.last_error || null,
      };
    }
    return raw as SyncState;
  } catch {
    return { companies: {}, last_company: null, records_synced: 0, last_error: null };
  }
}

export function saveState(config: AgentConfig, state: SyncState): void {
  fs.writeFileSync(stateFilePath(config), JSON.stringify(state, null, 2));
}

export function getCompanyState(state: SyncState, company: string): CompanyState {
  return state.companies[company] ?? defaultCompanyState();
}

export function setCompanyState(state: SyncState, company: string, cs: Partial<CompanyState>): void {
  state.companies[company] = { ...defaultCompanyState(), ...state.companies[company], ...cs };
}
