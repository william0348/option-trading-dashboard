
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClosedTrade } from '../types';

interface PnLByYearMonthChartProps {
  trades: ClosedTrade[];
  baseFund?: number;
  onMonthClick: (yearMonth: string | null) => void;
  selectedMonth: string | null;
}

interface ChartData {
  yearMonth: string;
  formattedMonth: string;
  monthlyPnL: number;
  monthlyPercent: number;
  cumulativePnL: number;
  cumulativePercent: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
}

const PnLByYearMonthChart: React.FC<PnLByYearMonthChartProps> = ({ trades, baseFund = 10000, onMonthClick, selectedMonth }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    const sortedTrades = [...trades]
      .filter(t => t.closeDate instanceof Date && !isNaN(t.closeDate.getTime()))
      .sort((a, b) => a.closeDate.getTime() - b.closeDate.getTime());

    const statsByMonth: { [key: string]: { pnl: number; count: number; wins: number } } = {};

    for (const trade of sortedTrades) {
      const year = trade.closeDate.getUTCFullYear();
      const month = (trade.closeDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const key = `${year}-${month}`;
      if (!statsByMonth[key]) statsByMonth[key] = { pnl: 0, count: 0, wins: 0 };
      statsByMonth[key].pnl += trade.pnl;
      statsByMonth[key].count += 1;
      if (trade.pnl > 0) statsByMonth[key].wins += 1;
    }

    const data: ChartData[] = [];
    let cumulativePnL = 0;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const ymKey of Object.keys(statsByMonth).sort()) {
      const { pnl, count, wins } = statsByMonth[ymKey];
      cumulativePnL += pnl;
      const [y, m] = ymKey.split('-').map(Number);
      data.push({
        yearMonth: ymKey,
        formattedMonth: `${monthNames[m - 1]} ${y}`,
        monthlyPnL: pnl,
        monthlyPercent: baseFund > 0 ? (pnl / baseFund) * 100 : 0,
        cumulativePnL,
        cumulativePercent: baseFund > 0 ? (cumulativePnL / baseFund) * 100 : 0,
        tradeCount: count,
        winCount: wins,
        winRate: count > 0 ? (wins / count) * 100 : 0,
      });
    }
    return data;
  }, [trades, baseFund]);

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartData;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{label}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">PERIOD P&L:</span>
              <span className={data.monthlyPnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(data.monthlyPnL)}</span>
            </p>
            {baseFund > 0 && (
              <p className="flex justify-between space-x-6">
                <span className="text-slate-400 font-bold">YIELD:</span>
                <span className={data.monthlyPercent >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{data.monthlyPercent.toFixed(2)}%</span>
              </p>
            )}
            <div className="h-px bg-slate-50 my-1" />
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">TRADES:</span>
              <span className="text-slate-700 font-black">{data.tradeCount}</span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">WIN RATE:</span>
              <span className={data.winRate >= 50 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{data.winRate.toFixed(0)}% ({data.winCount}/{data.tradeCount})</span>
            </p>
            <div className="h-px bg-slate-50 my-1" />
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">CUMULATIVE:</span>
              <span className={data.cumulativePnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(data.cumulativePnL)}</span>
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
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="formattedMonth" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} interval="preserveStartEnd" minTickGap={20} stroke="#f1f5f9" axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} tickFormatter={currencyFormatter} stroke="#f1f5f9" axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
          <Bar dataKey="monthlyPnL" onClick={(data) => onMonthClick(data.yearMonth)}>
            {chartData.map((entry, index) => {
              const isSelected = selectedMonth === entry.yearMonth;
              const opacity = selectedMonth && !isSelected ? 0.3 : 1;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.monthlyPnL >= 0 ? '#10b981' : '#f43f5e'}
                  cursor="pointer"
                  radius={[4, 4, 0, 0]}
                  style={{ opacity, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  className="hover:brightness-110"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLByYearMonthChart;
