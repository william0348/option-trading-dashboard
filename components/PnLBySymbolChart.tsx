
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ClosedTrade } from '../types';

interface PnLBySymbolChartProps {
  trades: ClosedTrade[];
}

interface ChartData {
  stockName: string;
  pnl: number | null;
  tradeCount: number;
  winCount: number;
  winRate: number;
  avgPnL: number;
  isDivider?: boolean;
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
    const all = Object.entries(statsMap)
      .map(([stockName, s]) => ({
        stockName,
        pnl: s.pnl,
        tradeCount: s.count,
        winCount: s.wins,
        winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
        avgPnL: s.count > 0 ? s.pnl / s.count : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    const winners = all.filter(d => d.pnl >= 0).slice(0, 10);
    // worst 5: take last 5 from sorted-desc array, then reverse so worst is first
    const losers = all.filter(d => d.pnl < 0).slice(-5).reverse();

    if (winners.length > 0 && losers.length > 0) {
      const divider: ChartData = { stockName: '·····', pnl: null, tradeCount: 0, winCount: 0, winRate: 0, avgPnL: 0, isDivider: true };
      return [...winners, divider, ...losers];
    }
    return [...winners, ...losers];
  }, [trades]);

  const winnerCount = chartData.filter(d => !d.isDivider && (d.pnl ?? 0) >= 0).length;
  const loserCount = chartData.filter(d => !d.isDivider && (d.pnl ?? 0) < 0).length;

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest">No Signal Detected</p>
      </div>
    );
  }

  const currencyFormatter = (value: number) => {
    if (typeof value !== 'number' || isNaN(value) || value === null) return '';
    const abs = Math.abs(value);
    if (abs >= 1000) return `${value < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as ChartData;
      if (d.isDivider) return null;
      const pnl = d.pnl ?? 0;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{d.stockName}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">TOTAL P&L:</span>
              <span className={pnl >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                {pnl >= 0 ? '' : '-'}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">AVG / TRADE:</span>
              <span className={d.avgPnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                {d.avgPnL >= 0 ? '' : '-'}${Math.abs(d.avgPnL).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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

  const rowHeight = 22;
  const chartHeight = chartData.length * rowHeight + 20;

  return (
    <div className="w-full h-full">
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 opacity-80" />
          Top {winnerCount} Winners
        </span>
        {loserCount > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-black text-rose-500 uppercase tracking-widest">
            <span className="inline-block w-2 h-2 rounded-sm bg-rose-500 opacity-80" />
            Bottom {loserCount} Losers
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 55, left: 10, bottom: 2 }}>
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
            tick={({ x, y, payload }: any) => {
              const isDivider = payload.value === '·····';
              return (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={isDivider ? 7 : 9}
                  fill={isDivider ? '#cbd5e1' : '#475569'} fontWeight={800}>
                  {isDivider ? '— — —' : payload.value}
                </text>
              );
            }}
            stroke="#f1f5f9"
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.04)' }} />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]} minPointSize={0}>
            <LabelList
              dataKey="pnl"
              position="right"
              formatter={(v: any) => (v === null || v === undefined) ? '' : currencyFormatter(v)}
              style={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
            />
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isDivider ? 'transparent' : (entry.pnl ?? 0) >= 0 ? '#10b981' : '#f43f5e'}
                opacity={entry.isDivider ? 0 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLBySymbolChart;
