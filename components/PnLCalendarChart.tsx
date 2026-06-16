import React, { useMemo } from 'react';
import { ClosedTrade } from '../types';

interface PnLCalendarChartProps {
  trades: ClosedTrade[];
  selectedDay: string | null;
  onDayClick: (day: string | null) => void;
  displayMonth: string;
  onDisplayMonthChange: (ym: string) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// closeDate is stored as UTC midnight — always use UTC accessors so
// negative-offset timezones (e.g. UTC-5) don't shift the date back by one day.
function toLocalDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PnLCalendarChart: React.FC<PnLCalendarChartProps> = ({
  trades,
  selectedDay,
  onDayClick,
  displayMonth,
  onDisplayMonthChange,
}) => {
  const [year, month] = displayMonth.split('-').map(Number);

  const dayMap = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {};
    for (const trade of trades) {
      const key = toLocalDateKey(trade.closeDate);
      if (!map[key]) map[key] = { pnl: 0, count: 0 };
      map[key].pnl += trade.pnl;
      map[key].count += 1;
    }
    return map;
  }, [trades]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const grid: Array<{ date: string | null; dayNum: number | null }> = [];

    for (let i = 0; i < startOffset; i++) grid.push({ date: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push({ date: dateStr, dayNum: d });
    }
    while (grid.length < 42) grid.push({ date: null, dayNum: null });
    return grid;
  }, [year, month]);

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    onDisplayMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    onDisplayMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatPnl = (pnl: number) =>
    (pnl >= 0 ? '+' : '') +
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(pnl);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  // Month summary
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthStats = useMemo(() => {
    let pnl = 0;
    let count = 0;
    for (const key of Object.keys(dayMap)) {
      if (key.startsWith(monthPrefix)) {
        pnl += dayMap[key].pnl;
        count += dayMap[key].count;
      }
    }
    return { pnl, count };
  }, [dayMap, monthPrefix]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily P&amp;L Calendar</span>
          {selectedDay && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-black">
              {selectedDay}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-[11px] font-black text-slate-700 min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={nextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          {selectedDay && (
            <button onClick={() => onDayClick(null)}
              className="ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Month summary strip */}
      {monthStats.count > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-slate-50 rounded-xl">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{monthLabel} Summary</span>
          <span className={`text-[11px] font-black ${monthStats.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatPnl(monthStats.pnl)}
          </span>
          <span className="text-[9px] font-bold text-slate-400">{monthStats.count} trades</span>
        </div>
      )}

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} className="h-14 rounded-lg bg-slate-50/30"/>;
          }
          const data = dayMap[cell.date];
          const isSelected = selectedDay === cell.date;
          const hasTrades = !!data;
          const isProfit = hasTrades && data.pnl >= 0;

          let bgBase = 'bg-slate-50 hover:bg-slate-100 text-slate-300';
          if (hasTrades)
            bgBase = isProfit
              ? 'bg-emerald-50 hover:bg-emerald-100'
              : 'bg-rose-50 hover:bg-rose-100';

          return (
            <button
              key={cell.date}
              onClick={() => onDayClick(isSelected ? null : cell.date!)}
              className={`h-14 rounded-lg p-1.5 text-left transition-all relative ${bgBase} ${
                isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-sm' : ''
              }`}
            >
              <span className={`text-[10px] font-black block leading-none ${
                hasTrades ? (isProfit ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-400'
              }`}>
                {cell.dayNum}
              </span>
              {hasTrades && (
                <>
                  <span className={`text-[7px] font-bold block mt-0.5 leading-tight ${
                    isProfit ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {formatPnl(data.pnl)}
                  </span>
                  <span className="absolute bottom-1 right-1 text-[7px] font-black bg-white/80 rounded px-0.5 text-slate-500">
                    {data.count}t
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"/>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Profit Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-100 border border-rose-200"/>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Loss Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"/>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">No Trade</span>
        </div>
        <span className="ml-auto text-[8px] font-bold text-slate-300">Click day to filter table</span>
      </div>
    </div>
  );
};

export default PnLCalendarChart;
