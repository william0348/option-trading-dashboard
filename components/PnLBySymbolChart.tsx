
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ClosedTrade } from '../types';

interface PnLBySymbolChartProps {
  trades: ClosedTrade[];
}

interface ChartData {
  stockName: string;
  pnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
  avgPnL: number;
}

const PnLBySymbolChart: React.FC<PnLBySymbolChartProps> = ({ trades }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    const statsMap: { [key: string]: { pnl: number; count: number; wins: number } } = {};
    for (const trade of trades) {
      if (!statsMap[trade.stockName]) statsMap[trade.stockName] = { pnl: 0, count: 0, wins: 0 };
      statsMap[trade.stockName].pnl += trade.pnl;
      statsMap[trade.stockName].count += 1;
      if (trade.pnl > 0) statsMap[trade.stockName].wins += 1;
    }
    return Object.entries(statsMap)
      .map(([stockName, s]) => ({
        stockName,
        pnl: s.pnl,
        tradeCount: s.count,
        winCount: s.wins,
        winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
        avgPnL: s.count > 0 ? s.pnl / s.count : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 15); // top 15 symbols
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest">No Signal Detected</p>
      </div>
    );
  }

  const currencyFormatter = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    const abs = Math.abs(value);
    if (abs >= 1000) return `${value < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as ChartData;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{d.stockName}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">TOTAL P&L:</span>
              <span className={d.pnl >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                ${d.pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">AVG / TRADE:</span>
              <span className={d.avgPnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                ${d.avgPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
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

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={currencyFormatter}
            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
            stroke="#f1f5f9"
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="stockName"
            tick={{ fontSize: 9, fill: '#475569', fontWeight: 800 }}
            stroke="#f1f5f9"
            axisLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.04)' }} />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="pnl"
              position="right"
              formatter={currencyFormatter}
              style={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
            />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLBySymbolChart;
