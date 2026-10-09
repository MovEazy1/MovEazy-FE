/**
 * The security deposit when the poster leaves it blank: 3.5 × the rent,
 * rounded to the nearest ₹5,000. The database fills it in the same way
 * (MovEazy-BE/supabase/inventory_auto_deposit.sql) and keeps it in step with
 * the rent until somebody types a real deposit; this is for showing the
 * figure in the forms before saving.
 */
export const DEPOSIT_MONTHS = 3.5;
export const DEPOSIT_ROUND_TO = 5000;

export function autoDeposit(rent) {
  const r = Number(rent);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.round((r * DEPOSIT_MONTHS) / DEPOSIT_ROUND_TO) * DEPOSIT_ROUND_TO;
}

/** "Auto: ₹95,000 (3.5 × rent)" — the placeholder a blank deposit field shows. */
export function autoDepositHint(rent) {
  const d = autoDeposit(rent);
  return d ? `Auto: ₹${d.toLocaleString("en-IN")} (3.5 × rent)` : "Auto: 3.5 × rent";
}
