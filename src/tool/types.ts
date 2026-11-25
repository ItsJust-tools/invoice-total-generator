export type DiscountType = 'percent' | 'flat';

export interface LineItem {
  /** Stable unique id for list rendering and updates. */
  id: string;
  description: string;
  /** Stored as text so drafts can hold half-typed numbers. */
  quantity: string;
  unitPrice: string;
  /** When true, the global tax rate applies to this line. */
  taxable: boolean;
}

export interface ToolState {
  /** Invoice header: number, issue date, from/for fields. */
  invoiceNumber: string;
  date: string;
  from: string;
  for: string;
  /** Selected currency symbol, e.g. '$'. */
  currency: string;
  /** Global tax rate as a percentage string, e.g. '19'. */
  taxRate: string;
  /** Discount mode: percentage of the subtotal or a flat amount. */
  discountType: DiscountType;
  /** Discount value as a string (percent number or flat amount). */
  discount: string;
  items: LineItem[];
  /** Id counter for newly added line items. */
  nextId: number;
}

export const CURRENCIES = ['$', '€', '£', '¥', '₹'] as const;

export const DEFAULT_STATE: ToolState = {
  invoiceNumber: 'INV-0001',
  date: '2026-11-25',
  from: '',
  for: '',
  currency: '$',
  taxRate: '0',
  discountType: 'percent',
  discount: '0',
  items: [
    {
      id: '1',
      description: 'Consulting services',
      quantity: '1',
      unitPrice: '100',
      taxable: true,
    },
  ],
  nextId: 2,
};

export const MAX_ITEMS = 100;

/** Parse a plain decimal number; returns null for empty/unparseable input. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Round to cents, keeping -0 as 0. */
export function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Format a number as currency with two decimals or '—' when invalid. */
export function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

/** Line amount = quantity × unit price, or null when inputs are invalid. */
export function lineAmount(item: LineItem): number | null {
  const quantity = parseNumber(item.quantity);
  const unitPrice = parseNumber(item.unitPrice);
  if (quantity === null || unitPrice === null) return null;
  return round2(quantity * unitPrice);
}

export interface Totals {
  /** Sum of all line amounts. */
  subtotal: number;
  /** Discount amount after clamping at the subtotal. */
  discountAmount: number;
  /** Tax over the taxable line amounts, applied after the discount. */
  taxAmount: number;
  /** Grand total: subtotal − discount + tax, never negative. */
  grandTotal: number;
  /** True when any line input is invalid (the invoice cannot be fully computed). */
  hasInvalidLines: boolean;
}

/**
 * Compute subtotal, discount, tax and grand total for an invoice draft.
 * Tax is taken from taxable lines (proportionally reduced by the discount)
 * and the grand total never falls below zero.
 */
export function computeTotals(state: ToolState): Totals {
  let subtotal = 0;
  let taxableBase = 0;
  let hasInvalidLines = false;
  for (const item of state.items) {
    const amount = lineAmount(item);
    if (amount === null) {
      hasInvalidLines = true;
      continue;
    }
    subtotal = round2(subtotal + amount);
    if (item.taxable) {
      taxableBase = round2(taxableBase + amount);
    }
  }
  const discountValue = parseNumber(state.discount) ?? 0;
  let discountAmount =
    state.discountType === 'percent'
      ? round2((subtotal * discountValue) / 100)
      : round2(discountValue);
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > subtotal) discountAmount = subtotal;
  const discountRatio = subtotal === 0 ? 0 : (subtotal - discountAmount) / subtotal;
  const taxRate = parseNumber(state.taxRate) ?? 0;
  const taxAmount = round2(taxableBase * discountRatio * (taxRate / 100));
  const grandTotal = round2(Math.max(0, subtotal - discountAmount + taxAmount));
  return { subtotal, discountAmount, taxAmount, grandTotal, hasInvalidLines };
}

/** Single invoice line as a short summary, e.g. '2 × Widget = 19.98'. */
export function lineSummary(item: LineItem): string | null {
  const amount = lineAmount(item);
  if (amount === null) return null;
  const quantity = parseNumber(item.quantity) ?? 0;
  const unitPrice = formatMoney(parseNumber(item.unitPrice));
  return `${quantity} × ${item.description || 'Item'} (${unitPrice}/unit) = ${amount.toFixed(2)}`;
}

/** Ready-to-send plain-text invoice summary with a totals block. */
export function plainTextSummary(state: ToolState): string {
  const totals = computeTotals(state);
  const symbol = state.currency;
  const lines: string[] = [];
  const header = `Invoice ${state.invoiceNumber} — ${state.date}`;
  lines.push(header);
  lines.push('='.repeat(header.length));
  if (state.from) lines.push(`From: ${state.from}`);
  if (state.for) lines.push(`For: ${state.for}`);
  lines.push('');
  lines.push('Items:');
  state.items.forEach((item, index) => {
    const amount = lineAmount(item);
    const quantity = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.unitPrice);
    const amountText = amount === null ? '—' : formatMoney(amount);
    const taxMark = item.taxable ? ' [tax]' : '';
    const qtyText = quantity === null ? item.quantity : String(quantity);
    const priceText = unitPrice === null ? '—' : formatMoney(unitPrice);
    lines.push(
      `${index + 1}. ${item.description || 'Item'} — ${qtyText} × ${symbol}${priceText}${taxMark} = ${symbol}${amountText}`
    );
  });
  lines.push('');
  lines.push('Totals:');
  lines.push(`Subtotal: ${symbol}${formatMoney(totals.subtotal)}`);
  lines.push(
    `Discount (${state.discountType === 'percent' ? '' : symbol}${state.discount}${
      state.discountType === 'percent' ? '%' : ''
    }): -${symbol}${formatMoney(totals.discountAmount)}`
  );
  lines.push(
    `Tax (${state.taxRate}% on taxable lines): ${symbol}${formatMoney(totals.taxAmount)}`
  );
  lines.push(`Grand total: ${symbol}${formatMoney(totals.grandTotal)}`);
  return lines.join('\n');
}

/** Invoice line items rendered as a Markdown table; tax flag is a per-row column. */
export function markdownTable(state: ToolState): string {
  const symbol = state.currency;
  const header = `| # | Description | Qty | Unit price | Tax | Amount (${symbol}) |`;
  const divider = '|---|-------------|-----|------------|-----|--------------|';
  const rows = state.items.map((item, index) => {
    const amount = lineAmount(item);
    const unitPrice = parseNumber(item.unitPrice);
    const amountText = amount === null ? '—' : formatMoney(amount);
    const priceText = unitPrice === null ? '—' : formatMoney(unitPrice);
    return `| ${index + 1} | ${item.description || 'Item'} | ${item.quantity} | ${symbol}${priceText} | ${item.taxable ? 'Yes' : 'No'} | ${amountText} |`;
  });
  const totals = computeTotals(state);
  const totalRow = `| | **Total** | | | | **${formatMoney(totals.grandTotal)}** |`;
  return [header, divider, ...rows, totalRow].join('\n');
}

/**
 * Return the next invoice number by incrementing the trailing integer, if any.
 * 'INV-0009' → 'INV-0010'; non-numeric suffixes become the base number + 1.
 */
export function nextInvoiceNumber(state: ToolState): string {
  const match = /^(.*?)(\d+)$/.exec(state.invoiceNumber.trim());
  if (!match) return 'INV-0001';
  const [, prefix, digits] = match;
  const next = Number(digits) + 1;
  return `${prefix}${String(next).padStart(digits.length, '0')}`;
}

/** True when the line item has an id and string fields only. */
export function isLineItem(value: unknown): value is LineItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<LineItem>;
  return (
    typeof v.id === 'string' &&
    typeof v.description === 'string' &&
    typeof v.quantity === 'string' &&
    typeof v.unitPrice === 'string' &&
    typeof v.taxable === 'boolean'
  );
}
