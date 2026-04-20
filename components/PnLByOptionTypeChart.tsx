
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClosedTrade, OptionType, AssetType } from '../types';

interface PnLByOptionTypeChartProps {
  trades: ClosedTrade[];
}

interface ChartData {
  type: string;
  pnl: number;
  color: string;
}

const PnLByOptionTypeChart: React.FC<PnLByOptionTypeChartProps> = ({ trades }) => {
  const chartData: ChartData[] = React.useMemo(() => {
    let callPnL = 0;
    let putPnL = 0;
    let stockPnL = 0;

    for (const trade of trades) {
      if (trade.assetType === AssetType.STOCK) {
        stockPnL += trade.pnl;
      } else if (trade.optionType === OptionType.CALL) {
        callPnL += trade.pnl;
      } else if (trade.optionType === OptionType.PUT) {
        putPnL += trade.pnl;
      }
    }

    const data: ChartData[] = [];
    if (stockPnL !== 0 || trades.some(t => t.assetType === AssetType.STOCK)) {
      data.push({ type: 'Stocks', pnl: stockPnL, color: '#FFBB28' });
    }
    if (callPnL !== 0 || trades.some(t => t.optionType === OptionType.CALL)) {
        data.push({ type: 'Calls', pnl: callPnL, color: '#0088FE' });
    }
    if (putPnL !== 0 || trades.some(t => t.optionType === OptionType.PUT)) {
        data.push({ type: 'Puts', pnl: putPnL, color: '#00C49F' });
    }
    
    return data;
  }, [trades]);

  if (trades.length === 0 || chartData.length === 0) {
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
            dataKey="type" 
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
          <Bar dataKey="pnl" >
            {
              chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} radius={[4, 4, 0, 0]} opacity={0.8} />
              ))
            }
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnLByOptionTypeChart;
