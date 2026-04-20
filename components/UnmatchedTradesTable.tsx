
import React, { useState, useMemo } from 'react';
import { ParsedTrade, OptionType, AssetType } from '../types';

interface UnmatchedTradesTableProps {
  trades: ParsedTrade[];
}

interface SortConfig {
  key: keyof ParsedTrade;
  direction: 'ascending' | 'descending';
}

const formatToMMDDYYYY = (date: Date | undefined | null) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid';
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const dNum = d.getDate().toString().padStart(2, '0');
  const y = d.getFullYear();
  return `${m}/${dNum}/${y}`;
};

const UnmatchedTradesTable: React.FC<UnmatchedTradesTableProps> = ({ trades }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'originalDate', direction: 'descending' });

  const sortedTrades = useMemo(() => {
    const sortableTrades = [...trades];
    if (sortConfig.key) {
      sortableTrades.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || bValue === undefined) return 0;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = (aValue as number || 0) < (bValue as number || 0) ? -1 : (aValue as number || 0) > (bValue as number || 0) ? 1 : 0;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableTrades;
  }, [trades, sortConfig]);

  const requestSort = (key: keyof ParsedTrade) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof ParsedTrade) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatOptionType = (type: OptionType) => (type === OptionType.CALL ? 'Call' : 'Put');

  return (
    <div className="overflow-x-auto">
      {trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-600">
           <svg className="w-8 h-8 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
           <p className="text-[10px] font-black uppercase tracking-[0.2em]">All integrity checks passed. Zero anomalies detected.</p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer hover:text-amber-600 transition-colors" onClick={() => requestSort('originalDate')}>Date {getSortIndicator('originalDate')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('action')}>Action {getSortIndicator('action')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('stockName')}>Ticker {getSortIndicator('stockName')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight">Asset</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('optionDate')}>Expiry {getSortIndicator('optionDate')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('strikePrice')}>Strike {getSortIndicator('strikePrice')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('optionType')}>Type {getSortIndicator('optionType')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer" onClick={() => requestSort('quantity')}>Qty {getSortIndicator('quantity')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-tight cursor-pointer text-right" onClick={() => requestSort('tradePrice')}>Price {getSortIndicator('tradePrice')}</th>
              <th className="px-3 py-2 text-left font-black text-slate-300 uppercase tracking-tight text-right" onClick={() => requestSort('amount')}>Capital Out {getSortIndicator('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50 font-sans text-[10px]">
             {sortedTrades.map((trade) => (
              <tr key={trade.id} className="hover:bg-amber-50 transition-colors group">
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600 font-bold">{formatToMMDDYYYY(trade.originalDate)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{trade.action}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-900 font-black">{trade.stockName}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 italic text-[9px] uppercase font-black">{trade.assetType}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{trade.assetType === AssetType.OPTION && trade.optionDate ? formatToMMDDYYYY(trade.optionDate) : '-'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{trade.assetType === AssetType.OPTION && trade.strikePrice ? formatCurrency(trade.strikePrice) : '-'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{trade.assetType === AssetType.OPTION && trade.optionType ? formatOptionType(trade.optionType) : '-'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{trade.quantity}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600 text-right">{formatCurrency(trade.tradePrice)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-amber-600 font-bold text-right">{formatCurrency(trade.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UnmatchedTradesTable;
