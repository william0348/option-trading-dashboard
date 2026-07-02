import React, { useState, useMemo } from 'react';
import { ClosedTrade, OptionType, AssetType, TradeAction } from '../types';

interface TradeTableProps {
  trades: ClosedTrade[];
}

interface SortConfig {
  key: string; // Changed to string to allow dot notation for nested properties
  direction: 'ascending' | 'descending';
}

const getNestedValue = (obj: any, path: string) => {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

const PAGE_SIZE = 50;

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'closeDate', label: 'Close Date' },
  { key: 'stockName', label: 'Stock' },
  { key: 'optionDate', label: 'Expiry' },
  { key: 'strikePrice', label: 'Strike' },
  { key: 'optionType', label: 'Type' },
  { key: 'matchedQuantity', label: 'Matched Qty' },
  { key: 'sellTradeOriginal.originalDate', label: 'Sell Date' },
  { key: 'sellTradeOriginal.tradePrice', label: 'Sell Price' },
  { key: 'buyTradeOriginal.tradePrice', label: 'Buy Price' },
  { key: 'netFees', label: 'Net Fees' },
  { key: 'pnl', label: 'P&L' },
  { key: 'returnPercentage', label: 'Return %' },
  { key: 'annualizedReturnPercentage', label: 'Annualized Return %' },
];

const TradeTable: React.FC<TradeTableProps> = ({ trades }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'closeDate', direction: 'descending' });
  const [page, setPage] = useState(0);

  // Reset to first page when the underlying data or sort changes
  React.useEffect(() => { setPage(0); }, [trades, sortConfig]);

  const sortedTrades = useMemo(() => {
    const sortableTrades = [...trades];
    if (sortConfig.key) {
      sortableTrades.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === undefined || bValue === undefined) return 0;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          // FIX: Use bValue for comparison, not b.originalDate which does not exist on ClosedTrade
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = (aValue || 0) < (bValue || 0) ? -1 : (aValue || 0) > (bValue || 0) ? 1 : 0;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableTrades;
  }, [trades, sortConfig]);

  // Changed key type to string to support nested paths
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Changed key type to string to support nested paths
  const getSortIndicator = (key: string) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatTradeType = (trade: ClosedTrade) => {
    if (trade.assetType === AssetType.STOCK) {
      const isLong = trade.buyTradeOriginal.action === TradeAction.BUY || trade.buyTradeOriginal.action === TradeAction.BUY_TO_OPEN;
      return isLong ? 'Buy' : 'Sell';
    }
    if (!trade.optionType) return '—';
    return trade.optionType === OptionType.CALL ? 'Call' : 'Put';
  };

  const formatStrike = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '—';
    return formatCurrency(amount);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
    // Trade dates are UTC midnight — render in UTC so negative-offset timezones don't shift the day
    return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
  };

  return (
    <div className="overflow-x-auto">
      {trades.length === 0 ? (
        <p className="text-gray-600">No closed trades to display. Please upload a CSV file.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortConfig.key === col.key ? (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    onClick={() => requestSort(col.key)}
                    className="uppercase tracking-wider font-medium hover:text-gray-800 focus:outline-none focus:underline"
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}{getSortIndicator(col.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTrades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((trade) => (
              <tr key={trade.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(trade.closeDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.stockName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(trade.optionDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatStrike(trade.strikePrice)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatTradeType(trade)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.matchedQuantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(trade.sellTradeOriginal.originalDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(trade.sellTradeOriginal.tradePrice)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(trade.buyTradeOriginal.tradePrice)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(trade.netFees)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(trade.pnl)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${trade.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trade.returnPercentage.toFixed(2)}%
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${trade.annualizedReturnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trade.annualizedReturnPercentage.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {trades.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-white">
          <span className="text-xs font-bold text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, trades.length)} of {trades.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="px-3 py-1.5 text-xs font-black rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs font-bold text-gray-500">
              {page + 1} / {Math.ceil(trades.length / PAGE_SIZE)}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(Math.ceil(trades.length / PAGE_SIZE) - 1, p + 1))}
              disabled={(page + 1) * PAGE_SIZE >= trades.length}
              aria-label="Next page"
              className="px-3 py-1.5 text-xs font-black rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTable;