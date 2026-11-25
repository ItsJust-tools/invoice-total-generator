'use client';

import React from 'react';
import { computeTotals, formatMoney, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  const totals = computeTotals(state);
  const symbol = state.currency;
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="invoice-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Invoice overview</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            Number: <span data-testid="sidebar-invoice-number">{state.invoiceNumber}</span>
          </li>
          <li>Date: {state.date}</li>
          <li>Line items: {state.items.length}</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Totals</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            Subtotal: {symbol}
            {formatMoney(totals.subtotal)}
          </li>
          <li>
            Discount: −{symbol}
            {formatMoney(totals.discountAmount)}
          </li>
          <li>
            Tax: {symbol}
            {formatMoney(totals.taxAmount)}
          </li>
          <li>
            Grand total:{' '}
            <span data-testid="sidebar-grand-total">
              {symbol}
              {formatMoney(totals.grandTotal)}
            </span>
          </li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Sharing</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current invoice; open it to
          restore the draft.
        </p>
      </div>
    </div>
  );
};
