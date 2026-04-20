import React, { useState, useMemo } from 'react';
import { ClosedTrade, OptionType } from '../types';

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

const TradeTable: React.FC<TradeTableProps> = ({ trades }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'closeDate', direction: 'descending' });

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

  const formatOptionType = (type: OptionType) => {
    return type === OptionType.CALL ? 'Call' : 'Put';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  return (
    <div className="overflow-x-auto">
      {trades.length === 0 ? (
        <p className="text-gray-600">No closed trades to display. Please upload a CSV file.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('closeDate')}
              >
                Close Date {getSortIndicator('closeDate')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('stockName')}
              >
                Stock {getSortIndicator('stockName')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('optionDate')}
              >
                Expiry {getSortIndicator('optionDate')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('strikePrice')}
              >
                Strike {getSortIndicator('strikePrice')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('optionType')}
              >
                Type {getSortIndicator('optionType')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('matchedQuantity')}
              >
                Matched Qty {getSortIndicator('matchedQuantity')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('sellTradeOriginal.originalDate')}
              >
                Sell Date {getSortIndicator('sellTradeOriginal.originalDate')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('sellTradeOriginal.tradePrice')}
              >
                Sell Price {getSortIndicator('sellTradeOriginal.tradePrice')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('buyTradeOriginal.tradePrice')}
              >
                Buy Price {getSortIndicator('buyTradeOriginal.tradePrice')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('netFees')}
              >
                Net Fees {getSortIndicator('netFees')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('pnl')}
              >
                P&L {getSortIndicator('pnl')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('returnPercentage')}
              >
                Return % {getSortIndicator('returnPercentage')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('annualizedReturnPercentage')}
              >
                Annualized Return % {getSortIndicator('annualizedReturnPercentage')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTrades.map((trade) => (
              <tr key={trade.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(trade.closeDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.stockName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(trade.optionDate)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(trade.strikePrice)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatOptionType(trade.optionType)}</td>
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
    </div>
  );
};

export default TradeTable;