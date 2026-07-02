import React, { useMemo } from 'react';
import { ClosedTrade, AssetType } from '../types';

interface DTEAnalysisProps {
  trades: ClosedTrade[];
}

interface Bucket {
  label: string;
  min: number;
  max: number; // inclusive; Infinity for the last bucket
  count: number;
  wins: number;
  pnl: number;
}

const makeBuckets = (): Bucket[] => [
  { label: '0–7 DTE', min: 0, max: 7, count: 0, wins: 0, pnl: 0 },
  { label: '8–21 DTE', min: 8, max: 21, count: 0, wins: 0, pnl: 0 },
  { label: '22–45 DTE', min: 22, max: 45, count: 0, wins: 0, pnl: 0 },
  { label: '45+ DTE', min: 46, max: Infinity, count: 0, wins: 0, pnl: 0 },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const DTEAnalysis: React.FC<DTEAnalysisProps> = ({ trades }) => {
  const buckets = useMemo(() => {
    const result = makeBuckets();
    for (const trade of trades) {
      if (trade.assetType !== AssetType.OPTION || !trade.optionDate) continue;
      // DTE at open = expiry minus the opening leg's trade date
      const openTime = Math.min(
        trade.sellTradeOriginal.originalDate.getTime(),
        trade.buyTradeOriginal.originalDate.getTime()
      );
      const dte = Math.round((trade.optionDate.getTime() - openTime) / (1000 * 60 * 60 * 24));
      const bucket = result.find(b => dte >= b.min && dte <= b.max);
      if (!bucket) continue;
      bucket.count++;
      if (trade.pnl > 0) bucket.wins++;
      bucket.pnl += trade.pnl;
    }
    return result;
  }, [trades]);

  const hasData = buckets.some(b => b.count > 0);
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest">DTE Analysis</h3>
        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Days to Expiry at Open</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {buckets.map(b => {
          const winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
          return (
            <div key={b.label} className={`rounded-xl p-4 border ${
              b.count === 0 ? 'bg-slate-50 border-slate-100' : b.pnl >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
            }`}>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">{b.label}</p>
              {b.count === 0 ? (
                <p className="text-[12px] font-bold text-slate-300">No trades</p>
              ) : (
                <>
                  <p className={`text-lg font-black ${b.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(b.pnl)}
                  </p>
                  <p className="text-[12px] font-bold text-slate-500 mt-1">
                    {b.count} trades · {winRate.toFixed(0)}% win
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(DTEAnalysis);
