
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClosedTrade } from '../types';

interface PnLBySymbolChartProps {
  trades: ClosedTrade[];
}

interface ChartData {
  stockName: string;
  pnl: number;
}

const PnLBySymbolChart: React.FC<PnLBySymbolChartProps> = ({ trades }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    const pnlBySymbol: { [key: string]: number } = {};
    for (const trade of trades) {
      pnlBySymbol[trade.stockName] = (pnlBySymbol[trade.stockName] || 0) + trade.pnl;
    }
    // Convert to array and sort
    return Object.entries(pnlBySymbol)
      .map(([stockName, pnl]) => ({ stockName, pnl }))
      .sort((a, b) => b.pnl - a.pnl); // Sort by PnL descending
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest">No Signal Detected</p>
      </div>
    );
  }

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="stockName" 
            tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} 
            stroke="#f1f5f9" 
            axisLine={false}
          />
          <YAxis 
            tickFormatter={(val) => `$${val}`} 
            tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} 
            stroke="#f1f5f9" 
            axisLine={false}
          />
          <Tooltip 
            formatter={(value: number) => currencyFormatter.format(value)}
            contentStyle={{ 
              backgroundColor: '#fff', 
              borderRadius: '12px', 
              border: '1px solid #f1f5f9', 
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', 
              fontSize: '11px', 
              fontWeight: 'black',
              color: '#0f172a',
              fontFamily: 'inherit'
            }}
            itemStyle={{ color: '#4f46e5' }}
          />
          <Bar dataKey="pnl" fill="#4f46e5" radius={[4, 4, 0, 0]} opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLBySymbolChart;
