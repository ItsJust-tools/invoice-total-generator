import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { compressToEncodedURIComponent } from 'lz-string';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();
const mockToolbarActions = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn() };

const MOCK_STATE = {
  invoiceNumber: 'INV-0001',
  date: '2026-11-25',
  from: '',
  for: '',
  currency: '$',
  taxRate: '0',
  discountType: 'percent',
  discount: '0',
  items: [{ id: '1', description: 'Widget', quantity: '2', unitPrice: '10', taxable: true }],
  nextId: 2,
};

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: MOCK_STATE,
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'invoice-total-generator',
    name: 'Invoice Total Generator',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'Invoice Total Generator' },
  },
  templateBaseVersion: '1.1.0',
  Canvas: ({ state }: { state: Record<string, unknown> }) => (
    <div>canvas:{String(state.invoiceNumber)}</div>
  ),
  Toolbar: () => <div>toolbar</div>,
  Sidebar: () => <div>sidebar</div>,
}));

vi.mock('@/tool/tool-definition', () => ({
  invoiceTool: {
    initialState: {},
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({ success: true, data: MOCK_STATE }),
  },
  markdownTable: () => '| table |',
  plainTextSummary: () => 'Invoice INV-0001',
}));

describe('app client and help page', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    const lz = { compressToEncodedURIComponent };
    const encoded = lz.compressToEncodedURIComponent(JSON.stringify(MOCK_STATE));
    window.history.replaceState(
      null,
      '',
      `http://localhost:3000/?state=${encodeURIComponent(encoded)}`
    );
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders and loads shared state from URL', () => {
    render(<ToolClient />);
    expect(screen.getByText('toolbar')).toBeInTheDocument();
    expect(screen.getByText(/canvas:INV-0001/)).toBeInTheDocument();
    expect(mockSetData).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Loaded state from shared URL', 'success');
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);
    fireEvent.click(screen.getByText('trigger-share'));
    await Promise.resolve();
    expect(mockToast).toHaveBeenCalled();
  });

  it('shows a toast error for invalid shared state', () => {
    window.history.replaceState(null, '', 'http://localhost:3000/?state=not-valid');
    render(<ToolClient />);
    expect(mockToast).toHaveBeenCalled();
  });
});
