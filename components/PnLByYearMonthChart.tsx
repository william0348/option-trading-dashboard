
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
  yearMonth: string; // e.g., "2025-10"
  formattedMonth: string; // e.g., "Oct 2025"
  monthlyPnL: number;
  monthlyPercent: number;
  cumulativePnL: number;
  cumulativePercent: number;
}

const PnLByYearMonthChart: React.FC<PnLByYearMonthChartProps> = ({ trades, baseFund = 10000, onMonthClick, selectedMonth }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    // Sort trades by close date to ensure correct chronological aggregation
    const sortedTrades = [...trades].sort((a, b) => a.closeDate.getTime() - b.closeDate.getTime());

    const pnlByYearMonth: { [key: string]: number } = {}; // { "YYYY-MM": monthlyPnL }

    for (const trade of sortedTrades) {
      const year = trade.closeDate.getUTCFullYear();
      const month = (trade.closeDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const yearMonthKey = `${year}-${month}`; // "YYYY-MM"
      pnlByYearMonth[yearMonthKey] = (pnlByYearMonth[yearMonthKey] || 0) + trade.pnl;
    }

    const data: ChartData[] = [];
    let cumulativePnL = 0;

    const sortedYearMonths = Object.keys(pnlByYearMonth).sort();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const ymKey of sortedYearMonths) {
      const monthlyPnL = pnlByYearMonth[ymKey];
      cumulativePnL += monthlyPnL;

      const [y, m] = ymKey.split('-').map(Number);
      const label = `${monthNames[m-1]} ${y}`;
      
      data.push({
        yearMonth: ymKey,
        formattedMonth: label,
        monthlyPnL: monthlyPnL,
        monthlyPercent: baseFund > 0 ? (monthlyPnL / baseFund) * 100 : 0,
        cumulativePnL: cumulativePnL,
        cumulativePercent: baseFund > 0 ? (cumulativePnL / baseFund) * 100 : 0,
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
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-[10px] font-sans">
          <p className="font-black text-slate-900 mb-2 border-b border-slate-50 pb-1 uppercase tracking-tight">{label}</p>
          <div className="space-y-1.5">
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">PERIOD P&L:</span> 
              <span className={data.monthlyPnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(data.monthlyPnL)}</span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">YIELD:</span> 
              <span className={data.monthlyPercent >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{data.monthlyPercent.toFixed(2)}%</span>
            </p>
            <div className="h-[px] bg-slate-50 my-1"></div>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">PORTFOLIO:</span> 
              <span className={data.cumulativePnL >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{currencyFormatter(data.cumulativePnL)}</span>
            </p>
            <p className="flex justify-between space-x-6">
              <span className="text-slate-400 font-bold">CUMULATIVE:</span> 
              <span className={data.cumulativePercent >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{data.cumulativePercent.toFixed(2)}%</span>
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
        <BarChart 
          data={chartData} 
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="formattedMonth" 
            tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} 
            interval="preserveStartEnd" 
            minTickGap={20} 
            stroke="#f1f5f9" 
            axisLine={false}
          />
          <YAxis 
            tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} 
            tickFormatter={(value) => currencyFormatter(value)} 
            stroke="#f1f5f9" 
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(79, 70, 229, 0.05)'}} />
          <Bar dataKey="monthlyPnL" onClick={(data) => onMonthClick(data.yearMonth)}>
            {chartData.map((entry, index) => {
              const isSelected = selectedMonth === entry.yearMonth;
              const defaultColor = entry.monthlyPnL >= 0 ? '#10b981' : '#f43f5e';
              const opacity = selectedMonth && !isSelected ? 0.3 : 1;

              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={defaultColor}
                  cursor="pointer"
                  radius={[4, 4, 0, 0]}
                  style={{ opacity: opacity, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
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
