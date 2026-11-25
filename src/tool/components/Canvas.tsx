'use client';

import React from 'react';
import {
  CURRENCIES,
  computeTotals,
  formatMoney,
  lineAmount,
  type DiscountType,
  type LineItem,
  type ToolState,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
  onCopyMarkdown?: () => void;
  onCopySummary?: () => void;
  onPrint?: () => void;
}

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function TextField({
  label,
  value,
  onChangeState,
  testid,
  type = 'text',
}: {
  label: string;
  value: string;
  onChangeState: (next: string) => void;
  testid: string;
  type?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChangeState(e.target.value)}
        data-testid={testid}
        className={inputClass}
      />
    </label>
  );
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  onChange,
  onSaveHistory,
  onCopyMarkdown,
  onCopySummary,
  onPrint,
}) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const totals = computeTotals(state);
  const symbol = state.currency;

  const patchItem = (id: string, patch: Partial<LineItem>) =>
    onChange?.({ ...state, items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

  const removeItem = (id: string) =>
    onChange?.({ ...state, items: state.items.filter((item) => item.id !== id) });

  const addItem = () => {
    if (state.items.length >= 100) return;
    const item: LineItem = {
      id: String(state.nextId),
      description: '',
      quantity: '1',
      unitPrice: '0',
      taxable: true,
    };
    onChange?.({ ...state, items: [...state.items, item], nextId: state.nextId + 1 });
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="invoice-canvas">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="invoice-header">
        <TextField
          label="Invoice number"
          value={state.invoiceNumber}
          onChangeState={(v) => update({ invoiceNumber: v })}
          testid="input-invoice-number"
        />
        <TextField
          label="Date"
          type="date"
          value={state.date}
          onChangeState={(v) => update({ date: v })}
          testid="input-date"
        />
        <TextField
          label="From"
          value={state.from}
          onChangeState={(v) => update({ from: v })}
          testid="input-from"
        />
        <TextField
          label="For (client)"
          value={state.for}
          onChangeState={(v) => update({ for: v })}
          testid="input-for"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4" data-testid="invoice-settings">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Currency
          <select
            value={state.currency}
            onChange={(e) => update({ currency: e.target.value })}
            data-testid="select-currency"
            className={inputClass}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Tax rate (%)"
          value={state.taxRate}
          onChangeState={(v) => update({ taxRate: v })}
          testid="input-tax-rate"
        />
        <div className="flex gap-2" role="group" aria-label="Discount type">
          {(['percent', 'flat'] as DiscountType[]).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={state.discountType === type}
              data-testid={`discount-${type}`}
              onClick={() => update({ discountType: type })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                state.discountType === type
                  ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {type === 'percent' ? 'Discount %' : 'Discount flat'}
            </button>
          ))}
        </div>
        <TextField
          label={state.discountType === 'percent' ? 'Discount (%)' : `Discount (${symbol})`}
          value={state.discount}
          onChangeState={(v) => update({ discount: v })}
          testid="input-discount"
        />
      </div>

      <div data-testid="line-items">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Line items
          </h3>
          <button
            type="button"
            onClick={addItem}
            data-testid="btn-add-item"
            className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            Add item
          </button>
        </div>
        {state.items.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="items-empty">
            No line items yet. Add one to start the invoice.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="items-list">
            {state.items.map((item) => {
              const amount = lineAmount(item);
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-12 items-end gap-2 rounded-md border border-gray-200 p-2 dark:border-gray-800"
                  data-testid={`line-item-${item.id}`}
                >
                  <div className="col-span-12 sm:col-span-5">
                    <TextField
                      label="Description"
                      value={item.description}
                      onChangeState={(v) => patchItem(item.id, { description: v })}
                      testid={`item-description-${item.id}`}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <TextField
                      label="Qty"
                      value={item.quantity}
                      onChangeState={(v) => patchItem(item.id, { quantity: v })}
                      testid={`item-quantity-${item.id}`}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <TextField
                      label="Unit price"
                      value={item.unitPrice}
                      onChangeState={(v) => patchItem(item.id, { unitPrice: v })}
                      testid={`item-price-${item.id}`}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={item.taxable}
                        onChange={(e) => patchItem(item.id, { taxable: e.target.checked })}
                        data-testid={`item-taxable-${item.id}`}
                      />
                      Taxed
                    </label>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {amount === null ? '—' : `${symbol}${formatMoney(amount)}`}
                    </span>
                  </div>
                  <div className="col-span-12 sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      data-testid={`item-remove-${item.id}`}
                      aria-label={`Remove line ${item.id}`}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex justify-between" data-testid="total-subtotal">
            <span>Subtotal</span>
            <span className="font-mono">
              {symbol}
              {formatMoney(totals.subtotal)}
            </span>
          </div>
          <div className="flex justify-between" data-testid="total-discount">
            <span>Discount</span>
            <span className="font-mono">
              −{symbol}
              {formatMoney(totals.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between" data-testid="total-tax">
            <span>Tax ({state.taxRate}% on taxed lines)</span>
            <span className="font-mono">
              {symbol}
              {formatMoney(totals.taxAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold dark:border-gray-800">
            <span>Grand total</span>
            <span className="font-mono" data-testid="grand-total">
              {symbol}
              {formatMoney(totals.grandTotal)}
            </span>
          </div>
          {totals.hasInvalidLines ? (
            <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="invalid-lines">
              Some line items have invalid numbers and are excluded from totals.
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {onCopyMarkdown ? (
            <button
              type="button"
              onClick={onCopyMarkdown}
              data-testid="btn-copy-markdown"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Copy Markdown
            </button>
          ) : null}
          {onCopySummary ? (
            <button
              type="button"
              onClick={onCopySummary}
              data-testid="btn-copy-summary"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Copy plain text
            </button>
          ) : null}
          {onPrint ? (
            <button
              type="button"
              onClick={onPrint}
              data-testid="btn-print"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Print
            </button>
          ) : null}
          {onSaveHistory ? (
            <button
              type="button"
              onClick={() => onSaveHistory(`${state.invoiceNumber}: ${formatMoney(totals.grandTotal)}`)}
              data-testid="btn-save-history"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Save to history
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All invoice data stays in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
