# Invoice Total Generator

Create clean line-item invoices with tax, discount and totals, then copy or print a ready-to-send invoice.

## Features

- Add, edit, and remove line items with description, quantity and unit price
- Apply a single global tax rate with a per-line tax toggle
- Percentage or flat-amount discount applied to the subtotal, clamped at zero
- Live totals: subtotal, discount, tax and grand total with currency symbol selection
- Editable invoice header: auto-incrementing invoice number, date picker, from/for fields
- Copy as Markdown table and copy as plain-text summary
- Print view with a clean A4-friendly stylesheet
- State persists in the URL so drafts survive reload and are shareable
- 100% client-side — no data ever leaves your browser

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t invoice-total-generator .
docker run -p 3000:3000 invoice-total-generator
```

## License

MIT
