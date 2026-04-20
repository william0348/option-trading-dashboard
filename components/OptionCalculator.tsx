
import React, { useState, useMemo } from 'react';

const OptionCalculator: React.FC = () => {
  const [symbol, setSymbol] = useState('');
  const [premium, setPremium] = useState<number>(0);
  const [strike, setStrike] = useState<number>(0);
  const [tradeType, setTradeType] = useState<'sell' | 'buy'>('sell');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  const results = useMemo(() => {
    if (premium <= 0 || (tradeType === 'sell' && strike <= 0) || !expiryDate || !startDate) {
      return null;
    }

    const start = new Date(startDate);
    const end = new Date(expiryDate);
    const timeDiff = end.getTime() - start.getTime();
    let days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    if (days <= 0) days = 1;

    // For Sell to Open (Short), ROI = (Premium / (Strike * 100)) * 100
    // Actually, usually in this app's context: (PnL / Collateral) where Collateral = Strike * 100
    // For Buy to Open (Long), ROI = (PnL / Investment) where Investment = Premium * 100
    // Wait, the "PnL" if it expires worthless is the Premium.
    
    let investment = 0;
    if (tradeType === 'sell') {
      investment = strike * 100;
    } else {
      investment = premium * 100;
    }

    const pnl = premium * 100;
    const roi = (pnl / investment) * 100;
    const annualizedRoi = roi * (365 / days);

    return {
      pnl,
      investment,
      roi,
      days,
      annualizedRoi,
    };
  }, [premium, strike, tradeType, startDate, expiryDate]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="bg-white text-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden group">
      {/* Background Accent */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl group-hover:bg-indigo-100 transition-all duration-700"></div>
      
      <div className="flex items-center mb-6 relative z-10">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-indigo-200">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-black tracking-tight uppercase text-slate-800">Option ROI Calculator</h2>
      </div>

      <div className="space-y-4 mb-6 relative z-10">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Stock Symbol</label>
          <input 
            type="text" 
            placeholder="e.g. TSLA" 
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-bold text-slate-700"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Premium / Strike (權利金 / 履約價)</label>
          <div className="flex bg-slate-50 border border-slate-100 rounded-xl overflow-hidden p-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
            <input 
              type="number" 
              step="0.01"
              placeholder="Premium" 
              className="w-1/2 bg-transparent border-none px-3 py-2 text-sm focus:ring-0 outline-none font-bold text-indigo-600 placeholder:text-slate-300"
              value={premium || ''}
              onChange={(e) => setPremium(parseFloat(e.target.value) || 0)}
            />
            <div className="w-px h-6 bg-slate-200 self-center"></div>
            <input 
              type="number" 
              step="0.5"
              placeholder="Strike" 
              disabled={tradeType === 'buy'}
              className={`w-1/2 bg-transparent border-none px-3 py-2 text-sm focus:ring-0 outline-none font-bold placeholder:text-slate-300 ${tradeType === 'buy' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700'}`}
              value={strike || ''}
              onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Trade Type</label>
            <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setTradeType('sell')}
                className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${tradeType === 'sell' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                SELL
              </button>
              <button 
                onClick={() => setTradeType('buy')}
                className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${tradeType === 'buy' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                BUY
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-end">
             {tradeType === 'sell' && <p className="text-[9px] text-slate-400 font-bold leading-tight">ROI based on Collateral</p>}
             {tradeType === 'buy' && <p className="text-[9px] text-slate-400 font-bold leading-tight">ROI based on Cost</p>}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Date Range (起始 / 到期)</label>
          <div className="flex bg-slate-50 border border-slate-100 rounded-xl overflow-hidden p-1 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
            <input 
              type="date" 
              className="w-1/2 bg-transparent border-none px-2 py-2 text-[11px] focus:ring-0 outline-none text-slate-600 cursor-pointer font-medium"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
            <div className="w-px h-6 bg-slate-200 self-center"></div>
            <input 
              type="date" 
              className="w-1/2 bg-transparent border-none px-2 py-2 text-[11px] focus:ring-0 outline-none text-slate-600 cursor-pointer font-medium"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-2xl p-6 min-h-[160px] flex items-center justify-center relative overflow-hidden border border-indigo-100 sm:mt-8">
        {results ? (
          <div className="grid grid-cols-2 gap-8 w-full text-center relative z-10">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Estimated ROI</p>
              <p className={`text-3xl font-black ${results.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {results.roi.toFixed(2)}%
              </p>
              <p className="text-[10px] text-indigo-400 mt-1 font-bold">Total PnL: {formatCurrency(results.pnl)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Annualized ROI</p>
              <p className={`text-3xl font-black ${results.annualizedRoi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {results.annualizedRoi.toFixed(2)}%
              </p>
              <p className="text-[10px] text-indigo-400 mt-1 font-bold">Holding Period: {results.days} days</p>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-px bg-indigo-200 hidden sm:block"></div>
          </div>
        ) : (
          <div className="text-center relative z-10">
            <p className="text-slate-400 text-xs font-bold px-8">Enter premium, strike, and dates to see calculated returns</p>
          </div>
        )}
        
        {/* Animated accent */}
        {results && <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ width: '100%' }}></div>}
      </div>
    </div>
  );
};

export default OptionCalculator;
