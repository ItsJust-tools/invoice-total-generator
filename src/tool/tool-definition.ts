import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_ITEMS,
  computeTotals,
  markdownTable,
  nextInvoiceNumber,
  plainTextSummary,
  isLineItem,
  type DiscountType,
  type LineItem,
  type ToolState,
} from './types';

const VALID_DISCOUNT_TYPES: DiscountType[] = ['percent', 'flat'];
const VALID_CURRENCIES = ['$', '€', '£', '¥', '₹'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    invoiceNumber: state.invoiceNumber,
    date: state.date,
    from: state.from,
    for: state.for,
    currency: state.currency,
    taxRate: state.taxRate,
    discountType: state.discountType,
    discount: state.discount,
    items: state.items,
    nextId: state.nextId,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLineItem).slice(0, MAX_ITEMS);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected invoice state object',
    };
  }
  const v = data as Record<string, unknown>;
  const discountType: DiscountType = VALID_DISCOUNT_TYPES.includes(v.discountType as DiscountType)
    ? (v.discountType as DiscountType)
    : DEFAULT_STATE.discountType;
  const currency = VALID_CURRENCIES.includes(v.currency as string)
    ? (v.currency as string)
    : DEFAULT_STATE.currency;
  const state: ToolState = {
    invoiceNumber: stringOr(v.invoiceNumber, DEFAULT_STATE.invoiceNumber),
    date: stringOr(v.date, DEFAULT_STATE.date),
    from: stringOr(v.from, DEFAULT_STATE.from),
    for: stringOr(v.for, DEFAULT_STATE.for),
    currency,
    taxRate: stringOr(v.taxRate, DEFAULT_STATE.taxRate),
    discountType,
    discount: stringOr(v.discount, DEFAULT_STATE.discount),
    items: validItems(v.items),
    nextId:
      typeof v.nextId === 'number' && Number.isFinite(v.nextId) && v.nextId >= 1
        ? Math.floor(v.nextId)
        : DEFAULT_STATE.nextId,
  };
  // Keep nextId ahead of any restored item id to avoid duplicate keys.
  for (const item of state.items) {
    const numeric = Number(item.id);
    if (Number.isFinite(numeric) && numeric >= state.nextId) {
      state.nextId = Math.floor(numeric) + 1;
    }
  }
  return { success: true, data: state };
}

/** Add a blank line item to the invoice. */
export function withItemAdded(state: ToolState, now = new Date()): ToolState {
  void now;
  if (state.items.length >= MAX_ITEMS) return state;
  const item: LineItem = {
    id: String(state.nextId),
    description: '',
    quantity: '1',
    unitPrice: '0',
    taxable: true,
  };
  return { ...state, items: [...state.items, item], nextId: state.nextId + 1 };
}

/** Patch one line item by id; returns the state unchanged when the id is unknown. */
export function withItemUpdated(state: ToolState, id: string, patch: Partial<LineItem>): ToolState {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return changed ? { ...state, items } : state;
}

/** Remove one line item by id; returns the state unchanged when the id is unknown. */
export function withItemRemoved(state: ToolState, id: string): ToolState {
  if (!state.items.some((item) => item.id === id)) return state;
  return { ...state, items: state.items.filter((item) => item.id !== id) };
}

/** Increment the invoice number header field. */
export function withInvoiceNumberIncremented(state: ToolState): ToolState {
  return { ...state, invoiceNumber: nextInvoiceNumber(state) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const invoiceTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { computeTotals, markdownTable, plainTextSummary, nextInvoiceNumber };
