# Invoice Total Generator — Guide

Learn how to build, share and print invoices with the Invoice Total Generator.

## Overview

The tool is fully client-side. You describe what you billed, choose a tax rate and discount, and the grand total updates live. Your draft is stored in the browser and can be shared with a link.

## Building an invoice

```text
1. Fill the header: invoice number, date, from and for fields
2. Add line items with description, quantity and unit price
3. Uncheck Taxed on any line that should not be taxed
4. Pick a currency and set the tax rate
```

## Discount

The discount can be a percentage of the subtotal or a flat amount. Switch modes with the Discount % / Discount flat buttons. Negative or oversized discounts are clamped so the grand total never goes negative because of the discount.

## Totals math

```text
subtotal  = sum(quantity × unit price)
discount  = percent × subtotal, or the flat amount (clamped)
tax       = (taxed lines × discount ratio) × tax rate
total     = subtotal − discount + tax
```

Tax applies only to lines with the Taxed checkbox enabled, and is scaled by the discount so the discount reduces the tax too.

## Copy and print

- Copy Markdown: a table with one row per line item and a totals row
- Copy plain text: a full invoice summary including header and totals block
- Print: opens the browser print dialog; use your browser's A4 settings

## Sharing

Click Share in the toolbar to copy a URL that encodes the whole invoice draft. Opening the link restores the invoice exactly.

## Keyboard shortcuts

```text
Ctrl+Z / Ctrl+Shift+Z  undo / redo
Ctrl+S                 force-save the draft
```

## Development

```bash
npm install
npm run build -w @itsjust/core
npm run dev
npm test
```
