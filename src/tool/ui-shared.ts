import { DEFAULT_STATE, type DiscountType, type ToolState } from './types';

export const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹'];

export const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: 'percent', label: 'Percent' },
  { value: 'flat', label: 'Flat amount' },
];

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.invoiceNumber === 'string' && Array.isArray(v.items);
}

/** Human-readable totals one-liner used by the status bar. */
export function summaryText(state: ToolState): string {
  const symbol = state.currency;
  void DEFAULT_STATE;
  void symbol;
  return `Invoice ${state.invoiceNumber}`;
}
