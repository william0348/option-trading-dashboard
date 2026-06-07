
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ClosedTrade } from '../types';

interface PnLOverTimeChartProps {
  trades: ClosedTrade[];
  baseFund?: number;
}

interface ChartData {
  date: string;
  cumulativePnL: number;
  cumulativePercent: number;
}

const formatToMMDDYYYY = (date: Date | undefined | null) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid';
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
};

const PnLOverTimeChart: React.FC<PnLOverTimeChartProps> = ({ trades, baseFund = 10000 }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    if (trades.length === 0) return [];

    const sortedTrades = [...trades]
      .filter(t => t.closeDate instanceof Date && !isNaN(t.closeDate.getTime()))
      .sort((a, b) => a.closeDate.getTime() - b.closeDate.getTime());

    if (sortedTrades.length === 0) return [];

    const startDate = sortedTrades[0].closeDate;
    const endDate = sortedTrades[sortedTrades.length - 1].closeDate;

    const pnlByDay = new Map<string, number>();
    for (const trade of sortedTrades) {
      const dateString = trade.closeDate.toISOString().split('T')[0];
      pnlByDay.set(dateString, (pnlByDay.get(dateString) || 0) + trade.pnl);
    }

    const combinedData: ChartData[] = [];
    let cumulativePnL = 0;

    let currentDate = new Date(startDate);
    currentDate.setUTCHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (pnlByDay.has(dateStr)) {
        cumulativePnL += pnlByDay.get(dateStr)!;
        const percent = baseFund > 0 ? (cumulativePnL / baseFund) * 100 : 0;
        combinedData.push({
          date: formatToMMDDYYYY(currentDate),
          cumulativePnL,
          cumulativePercent: percent,
        });
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return combinedData;
  }, [trades, baseFund]);

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest">No Signal Generated</p>
      </div>
    );
  }

  const currencyFormatter = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const maxPnL = Math.max(...chartData.map(d => d.cumulativePnL), 0);
  const minPnL = Math.min(...chartData.map(d => d.cumulativePnL), 0);
  const isPositive = (chartData[chartData.length - 1]?.cumulativePnL ?? 0) >= 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{label}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-4">
              <span className="text-slate-400 font-bold">TOTAL P&L:</span>
              <span className={data.cumulativePnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                {currencyFormatter(data.cumulativePnL)}
              </span>
            </p>
            {baseFund > 0 && (
              <p className="flex justify-between space-x-4">
                <span className="text-slate-400 font-bold">GROWTH:</span>
                <span className={data.cumulativePercent >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                  {data.cumulativePercent.toFixed(2)}%
                </span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const gradientId = isPositive ? 'pnlGreenGradient' : 'pnlRedGradient';
  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const gradientStart = isPositive ? '#10b981' : '#f43f5e';

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientStart} stopOpacity={0.15} />
              <stop offset="95%" stopColor={gradientStart} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
            minTickGap={50}
            stroke="#f1f5f9"
            axisLine={false}
          />
          <YAxis
            tickFormatter={currencyFormatter}
            stroke="#f1f5f9"
            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }}
            axisLine={false}
            domain={[minPnL < 0 ? minPnL * 1.1 : 0, maxPnL * 1.1 || 1]}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1.5} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulativePnL"
            stroke={strokeColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            connectNulls={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLOverTimeChart;
