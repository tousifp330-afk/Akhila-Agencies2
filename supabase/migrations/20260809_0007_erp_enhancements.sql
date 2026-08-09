-- ERP Enhancements: Manual Stock Baseline, Primary Bank, Party Name on Entries, Dashboard

CREATE TABLE IF NOT EXISTS stock_manual_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  manual_quantity numeric(15,3) NOT NULL DEFAULT 0,
  last_counted_at timestamptz DEFAULT now(),
  counted_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_manual_baselines_company ON stock_manual_baselines(company_id);

CREATE TABLE IF NOT EXISTS bank_manual_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  manual_balance numeric(15,3) NOT NULL DEFAULT 0,
  verified_at timestamptz DEFAULT now(),
  verified_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, bank_account_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_manual_balances_company ON bank_manual_balances(company_id);

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE voucher_entries ADD COLUMN IF NOT EXISTS party_name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS initial_sync_completed boolean DEFAULT false;

-- Updated dashboard cache: party_name in recent_activity
CREATE OR REPLACE FUNCTION refresh_dashboard_cache(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_receivables numeric(18,3);
  v_payables numeric(18,3);
  v_bank_balance numeric(18,3);
  v_cash_balance numeric(18,3);
  v_stock_value numeric(18,3);
  v_sales_total numeric(18,3);
  v_purchases_total numeric(18,3);
  v_receipts_total numeric(18,3);
  v_payments_total numeric(18,3);
  v_top_debtors jsonb;
  v_top_creditors jsonb;
  v_recent_activity jsonb;
BEGIN
  SELECT COALESCE(sum(ABS(closing_balance)), 0) INTO v_receivables FROM ledgers WHERE company_id = p_company_id AND is_customer = true AND closing_balance IS NOT NULL AND closing_balance != 0;
  SELECT COALESCE(sum(ABS(closing_balance)), 0) INTO v_payables FROM ledgers WHERE company_id = p_company_id AND is_supplier = true AND closing_balance IS NOT NULL AND closing_balance != 0;
  SELECT COALESCE(sum(closing_balance), 0) INTO v_bank_balance FROM ledgers WHERE company_id = p_company_id AND is_bank = true AND closing_balance IS NOT NULL;
  SELECT COALESCE(sum(closing_balance), 0) INTO v_cash_balance FROM ledgers WHERE company_id = p_company_id AND is_cash = true AND closing_balance IS NOT NULL;
  SELECT COALESCE(sum(current_value), 0) INTO v_stock_value FROM stock_items WHERE company_id = p_company_id;
  SELECT COALESCE(sum(total_amount), 0) INTO v_sales_total FROM sales_vouchers WHERE company_id = p_company_id;
  SELECT COALESCE(sum(total_amount), 0) INTO v_purchases_total FROM purchase_vouchers WHERE company_id = p_company_id;
  SELECT COALESCE(sum(amount), 0) INTO v_receipts_total FROM receipt_vouchers WHERE company_id = p_company_id;
  SELECT COALESCE(sum(amount), 0) INTO v_payments_total FROM payment_vouchers WHERE company_id = p_company_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('ledger_name', name, 'amount', ABS(closing_balance)) ORDER BY ABS(closing_balance) DESC), '[]'::jsonb) INTO v_top_debtors FROM (SELECT name, closing_balance FROM ledgers WHERE company_id = p_company_id AND is_customer = true AND closing_balance IS NOT NULL AND closing_balance != 0 ORDER BY ABS(closing_balance) DESC LIMIT 10) AS top_d;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('ledger_name', name, 'amount', ABS(closing_balance)) ORDER BY ABS(closing_balance) DESC), '[]'::jsonb) INTO v_top_creditors FROM (SELECT name, closing_balance FROM ledgers WHERE company_id = p_company_id AND is_supplier = true AND closing_balance IS NOT NULL AND closing_balance != 0 ORDER BY ABS(closing_balance) DESC LIMIT 10) AS top_c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type', voucher_type, 'number', voucher_number, 'date', voucher_date, 'party_name', party_name, 'amount', amount) ORDER BY voucher_date DESC, id DESC), '[]'::jsonb) INTO v_recent_activity FROM (SELECT 'Sales' AS voucher_type, voucher_number, voucher_date, party_name, total_amount AS amount, id FROM sales_vouchers WHERE company_id = p_company_id UNION ALL SELECT 'Purchase', voucher_number, voucher_date, party_name, total_amount, id FROM purchase_vouchers WHERE company_id = p_company_id UNION ALL SELECT 'Receipt', voucher_number, voucher_date, party_name, amount, id FROM receipt_vouchers WHERE company_id = p_company_id UNION ALL SELECT 'Payment', voucher_number, voucher_date, party_name, amount, id FROM payment_vouchers WHERE company_id = p_company_id ORDER BY voucher_date DESC, id DESC LIMIT 20) AS r;

  result := jsonb_build_object('company_id', p_company_id, 'outstanding_receivables', v_receivables, 'outstanding_payables', v_payables, 'bank_balance', v_bank_balance, 'cash_balance', v_cash_balance, 'current_stock_value', v_stock_value, 'sales_total', v_sales_total, 'purchases_total', v_purchases_total, 'receipts_total', v_receipts_total, 'payments_total', v_payments_total, 'cash_flow', v_receipts_total - v_payments_total, 'top_debtors', v_top_debtors, 'top_creditors', v_top_creditors, 'recent_activity', v_recent_activity, 'computed_at', now());

  INSERT INTO dashboard_cache (company_id, payload, computed_at) VALUES (p_company_id, result, now()) ON CONFLICT (company_id) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now();
  RETURN result;
END;
$$;
