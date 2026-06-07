
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { ClosedTrade, OptionType, AssetType } from '../types';

interface PnLByOptionTypeChartProps {
  trades: ClosedTrade[];
}

interface ChartData {
  type: string;
  pnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
  avgPnL: number;
  color: string;
}

const PnLByOptionTypeChart: React.FC<PnLByOptionTypeChartProps> = ({ trades }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    const groups: Record<string, { pnl: number; count: number; wins: number; color: string }> = {
      'Put': { pnl: 0, count: 0, wins: 0, color: '#10b981' },
      'Call': { pnl: 0, count: 0, wins: 0, color: '#6366f1' },
      'Stock': { pnl: 0, count: 0, wins: 0, color: '#f59e0b' },
    };

    for (const trade of trades) {
      let key: string;
      if (trade.assetType === AssetType.STOCK) key = 'Stock';
      else if (trade.optionType === OptionType.CALL) key = 'Call';
      else key = 'Put';

      groups[key].pnl += trade.pnl;
      groups[key].count += 1;
      if (trade.pnl > 0) groups[key].wins += 1;
    }

    return Object.entries(groups)
      .filter(([, s]) => s.count > 0)
      .map(([type, s]) => ({
        type,
        pnl: s.pnl,
        tradeCount: s.count,
        winCount: s.wins,
        winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
        avgPnL: s.count > 0 ? s.pnl / s.count : 0,
        color: s.color,
      }));
  }, [trades]);

  if (trades.length === 0 || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest">No Signal Detected</p>
      </div>
    );
  }

  const currencyFormatter = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as ChartData;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{d.type}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">TOTAL P&L:</span>
              <span className={d.pnl >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(d.pnl)}</span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">AVG / TRADE:</span>
              <span className={d.avgPnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(d.avgPnL)}</span>
            </p>
            <div className="h-px bg-slate-50 my-1" />
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">TRADES:</span>
              <span className="text-slate-700 font-black">{d.tradeCount}</span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">WIN RATE:</span>
              <span className={d.winRate >= 50 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                {d.winRate.toFixed(0)}% ({d.winCount}/{d.tradeCount})
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Stats cards
  const totalTrades = chartData.reduce((s, d) => s + d.tradeCount, 0);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Mini stat pills */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {chartData.map(d => (
          <div key={d.type} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{d.type}</span>
            <span className="text-[9px] font-black text-slate-700">{d.winRate.toFixed(0)}%</span>
            <span className="text-[9px] text-slate-400 font-bold">win</span>
            <span className="text-[9px] font-black" style={{ color: d.color }}>{((d.tradeCount / totalTrades) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="type" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} stroke="#f1f5f9" axisLine={false} />
          <YAxis tickFormatter={currencyFormatter} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} stroke="#f1f5f9" axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
          <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLByOptionTypeChart;
