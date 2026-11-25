import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'invoice-total-generator',
  name: 'Invoice Total Generator',
  description:
    'Create clean line-item invoices with tax, discount and totals, then copy or print a ready-to-send invoice.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'] as ToolConfig['exportFormats'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.08)',
    brand: 'Invoice Total Generator',
    icon: '🧾',
  },
} satisfies ToolConfig;

export default toolConfig;

export type ToolConfigType = typeof toolConfig;
