import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  MAX_ITEMS,
  parseNumber,
  round2,
  formatMoney,
  lineAmount,
  lineSummary,
  computeTotals,
  markdownTable,
  plainTextSummary,
  nextInvoiceNumber,
  isLineItem,
  type LineItem,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withItemAdded,
  withItemRemoved,
  withItemUpdated,
  withInvoiceNumberIncremented,
  roundTrips,
} from '@/tool/tool-definition';
import { invoiceTool } from '@/tool/tool-definition';

const item = (patch: Partial<LineItem> = {}): LineItem => ({
  id: '1',
  description: 'Widget',
  quantity: '2',
  unitPrice: '10',
  taxable: true,
  ...patch,
});

const state = (patch: Partial<ToolState> = {}): ToolState => ({
  ...DEFAULT_STATE,
  items: [item()],
  nextId: 2,
  ...patch,
});

describe('parseNumber', () => {
  it('parses integers, decimals and signs', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-3.5')).toBe(-3.5);
    expect(parseNumber('.25')).toBeCloseTo(0.25);
    expect(parseNumber('5.')).toBeCloseTo(5);
  });

  it('rejects invalid input', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(parseNumber('--5')).toBeNull();
  });
});

describe('round2 and formatMoney', () => {
  it('rounds to cents and never returns -0', () => {
    expect(round2(10.005)).toBeCloseTo(10.01);
    expect(round2(-0.001)).toBe(0);
    expect(Object.is(round2(-0.001), -0)).toBe(false);
  });

  it('formats currency with two decimals or a dash', () => {
    expect(formatMoney(10)).toBe('10.00');
    expect(formatMoney(1.005)).toBe('1.00');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(NaN)).toBe('—');
  });
});

describe('lineAmount', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineAmount(item({ quantity: '3', unitPrice: '12.5' }))).toBeCloseTo(37.5);
    expect(lineAmount(item({ quantity: '0', unitPrice: '99' }))).toBe(0);
  });

  it('returns null on invalid numbers', () => {
    expect(lineAmount(item({ quantity: 'x' }))).toBeNull();
    expect(lineAmount(item({ unitPrice: '' }))).toBeNull();
  });
});

describe('lineSummary', () => {
  it('describes a valid line and nulls an invalid one', () => {
    expect(lineSummary(item())).toBe('2 × Widget (10.00/unit) = 20.00');
    expect(lineSummary(item({ description: '' }))).toContain('Item');
    expect(lineSummary(item({ quantity: 'q' }))).toBeNull();
  });
});

describe('computeTotals', () => {
  it('computes subtotal minus discount plus per-line tax for mixed lines', () => {
    // subtotal 100 (60 taxable), 10% discount => discount 10,
    // taxable base scaled by 0.9 => 54, tax 19% => 10.26, total 100.26
    const s = state({
      items: [
        item({ id: '1', quantity: '6', unitPrice: '10', taxable: true }),
        item({ id: '2', quantity: '4', unitPrice: '10', taxable: false }),
      ],
      taxRate: '19',
      discountType: 'percent',
      discount: '10',
    });
    const totals = computeTotals(s);
    expect(totals.subtotal).toBeCloseTo(100);
    expect(totals.discountAmount).toBeCloseTo(10);
    expect(totals.taxAmount).toBeCloseTo(10.26);
    expect(totals.grandTotal).toBeCloseTo(100.26);
  });

  it('flags and skips invalid lines', () => {
    const s = state({ items: [item(), item({ id: '2', quantity: 'bad' })] });
    const totals = computeTotals(s);
    expect(totals.hasInvalidLines).toBe(true);
    expect(totals.subtotal).toBeCloseTo(20);
  });

  it('applies a flat discount on the subtotal', () => {
    const s = state({ discountType: 'flat', discount: '5' });
    const totals = computeTotals(s);
    expect(totals.discountAmount).toBeCloseTo(5);
    expect(totals.grandTotal).toBeCloseTo(15);
  });

  it('clamps negative discounts and discounts beyond the subtotal at zero remaining', () => {
    const negative = computeTotals(state({ discountType: 'flat', discount: '-10' }));
    expect(negative.discountAmount).toBe(0);
    const oversized = computeTotals(state({ discountType: 'flat', discount: '999' }));
    expect(oversized.discountAmount).toBeCloseTo(20);
    expect(oversized.grandTotal).toBe(0);
    expect(oversized.taxAmount).toBe(0);
  });

  it('switches between percent and flat and recalculates', () => {
    const percent = state({ discount: '50' });
    expect(computeTotals(percent).discountAmount).toBeCloseTo(10);
    const flat = state({ discountType: 'flat', discount: '50' });
    expect(computeTotals(flat).discountAmount).toBeCloseTo(20);
  });

  it('only taxes lines with the taxable toggle enabled', () => {
    const all = state({ taxRate: '10' });
    expect(computeTotals(all).taxAmount).toBeCloseTo(2);
    const none = state({ taxRate: '10', items: [item({ taxable: false })] });
    expect(computeTotals(none).taxAmount).toBe(0);
  });

  it('toggles tax per line and recalculates when flipped on/off', () => {
    const s = state({
      taxRate: '10',
      items: [item({ quantity: '1', unitPrice: '100', taxable: true })],
    });
    expect(computeTotals(s).taxAmount).toBeCloseTo(10);
    const flippedOff = withItemUpdated(s, '1', { taxable: false });
    expect(computeTotals(flippedOff).taxAmount).toBe(0);
    const flippedBack = withItemUpdated(flippedOff, '1', { taxable: true });
    expect(computeTotals(flippedBack).taxAmount).toBeCloseTo(10);
  });

  it('returns zero totals on an empty invoice', () => {
    const totals = computeTotals(state({ items: [] }));
    expect(totals.subtotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
    expect(totals.hasInvalidLines).toBe(false);
  });
});

describe('nextInvoiceNumber', () => {
  it('increments the trailing number preserving zero padding', () => {
    expect(nextInvoiceNumber(state({ invoiceNumber: 'INV-0001' }))).toBe('INV-0002');
    expect(nextInvoiceNumber(state({ invoiceNumber: 'INV-0009' }))).toBe('INV-0010');
    expect(nextInvoiceNumber(state({ invoiceNumber: '2026-0007' }))).toBe('2026-0008');
  });

  it('resets to the first invoice when no trailing number exists', () => {
    expect(nextInvoiceNumber(state({ invoiceNumber: 'INV-ABC' }))).toBe('INV-0001');
    expect(nextInvoiceNumber(state({ invoiceNumber: '' }))).toBe('INV-0001');
  });
});

describe('serialize/deserialize round-trip', () => {
  const full: ToolState = {
    invoiceNumber: 'INV-0042',
    date: '2026-11-25',
    from: 'Acme LLC',
    for: 'Globex',
    currency: '€',
    taxRate: '19',
    discountType: 'flat',
    discount: '5',
    items: [
      item({ id: '1', description: 'Design', quantity: '2', unitPrice: '50', taxable: false }),
      item({ id: '2', description: 'Build', quantity: '10', unitPrice: '30' }),
    ],
    nextId: 3,
  };

  it('restores all line items, header fields and totals', () => {
    const restored = deserializeState(JSON.parse(serializeState(full)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
      const before = computeTotals(full);
      const after = computeTotals(restored.data);
      expect(after).toEqual(before);
    }
    expect(roundTrips(full)).toBe(true);
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('round-trips through the Tool object', () => {
    const restored = invoiceTool.deserialize(JSON.parse(invoiceTool.serialize(full)));
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data).toEqual(full);
    expect(invoiceTool.id).toBe('invoice-total-generator');
    expect(invoiceTool.name).toBe('Invoice Total Generator');
  });

  it('rejects malformed payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('string').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
  });

  it('falls back to defaults for missing or invalid fields', () => {
    const restored = deserializeState({});
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.invoiceNumber).toBe(DEFAULT_STATE.invoiceNumber);
      expect(restored.data.items).toEqual([]);
      expect(restored.data.currency).toBe(DEFAULT_STATE.currency);
    }
    const badCurrency = deserializeState({ currency: 'X', discountType: 'weird', nextId: -3 });
    expect(badCurrency.success).toBe(true);
    if (badCurrency.success) {
      expect(badCurrency.data.currency).toBe('$');
      expect(badCurrency.data.discountType).toBe('percent');
      expect(badCurrency.data.nextId).toBe(DEFAULT_STATE.nextId);
    }
  });

  it('filters invalid items, caps length and keeps nextId ahead', () => {
    const entries = Array.from({ length: MAX_ITEMS + 3 }, (_, i) =>
      item({ id: String(i + 1), description: `line ${i}` })
    );
    const restored = deserializeState({
      items: [...entries, 'bad', { description: 'x' }],
      nextId: 5,
    });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.items.length).toBe(MAX_ITEMS);
      expect(restored.data.nextId).toBe(MAX_ITEMS + 1);
    }
  });
});

describe('line item mutations', () => {
  it('adds items with increasing ids', () => {
    const s = withItemAdded(state());
    expect(s.items).toHaveLength(2);
    expect(s.items[1]?.id).toBe('2');
    expect(s.nextId).toBe(3);
  });

  it('stops adding at MAX_ITEMS', () => {
    const items = Array.from({ length: MAX_ITEMS }, (_, i) => item({ id: String(i) }));
    const s = withItemAdded({ ...state(), items, nextId: MAX_ITEMS });
    expect(s.items).toHaveLength(MAX_ITEMS);
  });

  it('updates only the targeted item and ignores unknown ids', () => {
    const s = withItemUpdated(state(), '1', { description: 'Updated', quantity: '5' });
    expect(s.items[0]?.description).toBe('Updated');
    expect(s.items[0]?.quantity).toBe('5');
    expect(withItemUpdated(state(), 'nope', { description: 'X' })).toEqual(state());
  });

  it('removes only the targeted item and ignores unknown ids', () => {
    const duo = { ...state(), items: [item(), item({ id: '2' })], nextId: 3 };
    const s = withItemRemoved(duo, '1');
    expect(s.items.map((i) => i.id)).toEqual(['2']);
    expect(withItemRemoved(duo, 'nope')).toEqual(duo);
  });

  it('increments the invoice number header on demand', () => {
    const s = withInvoiceNumberIncremented(state({ invoiceNumber: 'INV-0007' }));
    expect(s.invoiceNumber).toBe('INV-0008');
  });
});

describe('copy output formats', () => {
  it('produces the exact expected Markdown table', () => {
    const s = state({
      items: [
        item({ id: '1', description: 'Design', quantity: '2', unitPrice: '50', taxable: false }),
        item({ id: '2', description: 'Build', quantity: '1', unitPrice: '30' }),
      ],
      nextId: 3,
    });
    const md = markdownTable(s);
    const rows = md.split('\n');
    expect(rows[0]).toContain('| # | Description | Qty | Unit price | Tax | Amount ($)');
    expect(rows[2]).toBe('| 1 | Design | 2 | $50.00 | No | 100.00 |');
    expect(rows[3]).toBe('| 2 | Build | 1 | $30.00 | Yes | 30.00 |');
    expect(rows[4]).toContain('**130.00**');
  });

  it('produces the exact expected plain-text summary', () => {
    const s = state({
      from: 'Acme LLC',
      for: 'Globex',
      discountType: 'flat',
      discount: '10',
      taxRate: '10',
      items: [
        item({ id: '1', description: 'Design', quantity: '2', unitPrice: '50', taxable: true }),
      ],
      nextId: 2,
    });
    const text = plainTextSummary(s);
    expect(text.split('\n')).toEqual([
      'Invoice INV-0001 — 2026-11-25',
      '=============================',
      'From: Acme LLC',
      'For: Globex',
      '',
      'Items:',
      '1. Design — 2 × $50.00 [tax] = $100.00',
      '',
      'Totals:',
      'Subtotal: $100.00',
      'Discount ($10): -$10.00',
      'Tax (10% on taxable lines): $9.00',
      'Grand total: $99.00',
    ]);
  });

  it('omits blank from/for fields in the plain-text summary', () => {
    const text = plainTextSummary(state({ from: '', for: '' }));
    expect(text).not.toContain('From:');
    expect(text).not.toContain('For:');
  });
});

describe('isLineItem', () => {
  it('accepts valid items and rejects malformed values', () => {
    expect(isLineItem(item())).toBe(true);
    expect(isLineItem({ id: '1' })).toBe(false);
    expect(isLineItem(null)).toBe(false);
    expect(isLineItem(item({ taxable: 'yes' as unknown as boolean }))).toBe(false);
  });
});
