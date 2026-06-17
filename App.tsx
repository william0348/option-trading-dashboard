import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RawTrade, ParsedTrade, ClosedTrade, SummaryData, OptionType, AssetType } from './types';
import { parseTrades, processClosedTrades, calculateSummary } from './services/csvParser';
import FileUpload from './components/FileUpload';
import SummaryCard from './components/SummaryCard';
import TradeTable from './components/TradeTable';
import PnLOverTimeChart from './components/PnLOverTimeChart';
import PnLBySymbolChart from './components/PnLBySymbolChart';
import PnLByOptionTypeChart from './components/PnLByOptionTypeChart';
import PnLByYearMonthChart from './components/PnLByYearMonthChart';
import UnmatchedTradesTable from './components/UnmatchedTradesTable';
import PnLCalendarChart from './components/PnLCalendarChart';
import {
  auth, signInWithGoogle, logout, onAuthStateChanged, syncUserProfile,
  saveTradesToFirestore, loadTradesFromFirestore,
  User
} from './lib/firebase';

declare const Papa: any; // PapaParse is loaded via CDN

// Helper function to format Date objects to YYYY-MM-DD for input type="date"
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // All raw trades loaded from Firestore (across all accounts)
  const [allFirestoreTrades, setAllFirestoreTrades] = useState<RawTrade[]>([]);
  const [lastImportDate, setLastImportDate] = useState<string | null>(null);
  const [firestoreLoading, setFirestoreLoading] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStep, setImportStep] = useState<string>('');

  // Selected account filter
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');

  // Initial fund per account, persisted in localStorage
  const [accountFunds, setAccountFunds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('accountFunds');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [fundInputValue, setFundInputValue] = useState<string>('');

  const currentBaseFund = accountFunds[selectedAccount] ?? 0;

  const [rawCsvData, setRawCsvData] = useState<RawTrade[] | null>(null);
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [unmatchedTrades, setUnmatchedTrades] = useState<ParsedTrade[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filterStock, setFilterStock] = useState<string>('');
  const [filterOptionType, setFilterOptionType] = useState<OptionType | 'ALL'>('ALL');
  const [filterAssetType, setFilterAssetType] = useState<AssetType | 'ALL'>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<'custom' | 'current_month' | 'current_year'>('current_year');
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarDisplayMonth, setCalendarDisplayMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Extract unique account names from all Firestore trades
  const existingAccounts = useMemo(() => {
    const accounts = allFirestoreTrades
      .map(t => {
        const account = t.Account || (t as any).account;
        return typeof account === 'string' ? account.trim() : '';
      })
      .filter((a): a is string => !!a && a.trim() !== '');
    const unique = [...new Set(accounts)].sort();
    return unique;
  }, [allFirestoreTrades]);

  // Load trades from Firestore for the logged-in user
  const loadUserTrades = useCallback(async (uid: string) => {
    setFirestoreLoading(true);
    try {
      const trades = await loadTradesFromFirestore(uid);

      const rawTrades = trades.map(({ userId, importedAt, ...rest }: any) => {
        // Normalise account field — could be 'Account' or 'account' depending on which version saved it
        const account = rest.Account || rest.account || '';
        return { ...rest, Account: account } as RawTrade;
      });

      setAllFirestoreTrades(rawTrades);

      // Find most recent importedAt
      const dates = trades.map((t: any) => t.importedAt).filter(Boolean).sort().reverse();
      if (dates.length > 0) {
        setLastImportDate(new Date(dates[0]).toLocaleDateString('zh-TW'));
      }
    } catch (e) {
      console.error('Failed to load trades from Firestore:', e);
    } finally {
      setFirestoreLoading(false);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        await syncUserProfile(currentUser);
        await loadUserTrades(currentUser.uid);
      } else {
        setAllFirestoreTrades([]);
        setRawCsvData(null);
        setSelectedAccount('ALL');
        setLastImportDate(null);
      }
    });
    return unsubscribe;
  }, [loadUserTrades]);

  // Sync fund input when account changes
  useEffect(() => {
    const fund = accountFunds[selectedAccount];
    setFundInputValue(fund ? fund.toString() : '');
  }, [selectedAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFundSave = () => {
    const num = parseFloat(fundInputValue.replace(/,/g, ''));
    if (isNaN(num) || num < 0) return;
    const updated = { ...accountFunds, [selectedAccount]: num };
    setAccountFunds(updated);
    localStorage.setItem('accountFunds', JSON.stringify(updated));
  };

  // When selected account changes, filter allFirestoreTrades and set as rawCsvData
  useEffect(() => {
    if (allFirestoreTrades.length === 0) {
      setRawCsvData(null);
      return;
    }
    const filtered = selectedAccount === 'ALL'
      ? allFirestoreTrades
      : allFirestoreTrades.filter(t => {
          const account = (t.Account || (t as any).account || '').trim();
          return account === selectedAccount;
        });
    setRawCsvData(filtered.length > 0 ? filtered : null);
  }, [allFirestoreTrades, selectedAccount]);

  const handleDataParsed = async (data: RawTrade[]) => {
    setError(null);
    if (user) {
      try {
        setImportProgress(30);
        setImportStep('儲存至雲端...');
        await saveTradesToFirestore(user.uid, data);
        setImportProgress(65);
        setImportStep('重新載入資料...');
        await loadUserTrades(user.uid);
        setImportProgress(100);
        setImportStep('匯入完成');
        setTimeout(() => { setImportProgress(0); setImportStep(''); }, 1500);
      } catch (e) {
        console.error('Failed to save trades to Firestore:', e);
        setError('匯入成功，但儲存到資料庫時發生錯誤。');
        setImportProgress(0);
        setImportStep('');
      }
    } else {
      setAllFirestoreTrades(prev => [...prev, ...data]);
      setImportProgress(100);
      setImportStep('匯入完成');
      setTimeout(() => { setImportProgress(0); setImportStep(''); }, 1500);
    }
  };

  useEffect(() => {
    if (rawCsvData) {
      const pTrades = parseTrades(rawCsvData);
      setParsedTrades(pTrades);
    } else {
      setParsedTrades([]);
    }
  }, [rawCsvData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (parsedTrades.length > 0) {
      // FIX: Correctly destructure 'unmatchedCloses' from 'processClosedTrades' return value instead of non-existent 'unmatchedBuys'.
      const { closedTrades: cTrades, openPositions: oPositions, unmatchedCloses: uCloses } = processClosedTrades(parsedTrades);
      setClosedTrades(cTrades);
      // FIX: Use the correctly destructured 'uCloses' to set the unmatched trades.
      setUnmatchedTrades([...oPositions, ...uCloses].sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime()));
      const summaryData = calculateSummary(cTrades);
      setSummary(summaryData);
    } else {
      setClosedTrades([]);
      setUnmatchedTrades([]);
      setSummary(null);
    }
  }, [parsedTrades]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to handle date preset selection
  useEffect(() => {
    const today = new Date();
    let newStartDate = '';
    let newEndDate = '';

    if (selectedDatePreset === 'current_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      newStartDate = formatDateToYYYYMMDD(startOfMonth);
      newEndDate = formatDateToYYYYMMDD(endOfMonth);
    } else if (selectedDatePreset === 'current_year') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      newStartDate = formatDateToYYYYMMDD(startOfYear);
      newEndDate = formatDateToYYYYMMDD(endOfYear);
    } 
    // If 'custom' is selected, we don't change filterStartDate/EndDate here
    // as the user will manually set them, or they retain their last values.
    // The clearFilters function handles explicit clearing.

    if (selectedDatePreset === 'custom') {
      setFilterStartDate('');
      setFilterEndDate('');
    } else {
      setFilterStartDate(newStartDate);
      setFilterEndDate(newEndDate);
    }
  }, [selectedDatePreset]);


  const filteredTrades = useMemo(() => {
    let currentTrades = closedTrades;

    const lowerCaseGlobalSearch = globalSearchTerm.toLowerCase();
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });


    // Apply Global Search Filter first
    if (lowerCaseGlobalSearch) {
      currentTrades = currentTrades.filter(trade => {
        const searchableFields = [
          trade.stockName.toLowerCase(),
          trade.optionType === OptionType.CALL ? 'call' : 'put', // Format for search
          currencyFormatter.format(trade.strikePrice).toLowerCase(),
          currencyFormatter.format(trade.pnl).toLowerCase(),
          `${trade.returnPercentage.toFixed(2)}%`,
          `${trade.annualizedReturnPercentage.toFixed(2)}%`,
          trade.closeDate.toLocaleDateString().toLowerCase(),
          trade.optionDate.toLocaleDateString().toLowerCase(),
          trade.sellTradeOriginal.originalDate.toLocaleDateString().toLowerCase(),
          trade.buyTradeOriginal.originalDate.toLocaleDateString().toLowerCase(),
          currencyFormatter.format(trade.sellTradeOriginal.tradePrice).toLowerCase(),
          currencyFormatter.format(trade.buyTradeOriginal.tradePrice).toLowerCase(),
          currencyFormatter.format(trade.netFees).toLowerCase(),
          trade.matchedQuantity.toString(),
        ];
        return searchableFields.some(field => field.includes(lowerCaseGlobalSearch));
      });
    }

    // Apply Asset Type Filter
    if (filterAssetType !== 'ALL') {
      currentTrades = currentTrades.filter(trade => trade.assetType === filterAssetType);
    }

    // Apply Stock Filter
    if (filterStock) {
      const lowerCaseFilter = filterStock.toLowerCase();
      currentTrades = currentTrades.filter(trade => 
        trade.stockName.toLowerCase().includes(lowerCaseFilter)
      );
    }

    // Apply Option Type Filter
    if (filterOptionType !== 'ALL') {
      currentTrades = currentTrades.filter(trade => 
        trade.optionType === filterOptionType
      );
    }

    // Apply Date Range Filter (based on closeDate)
    const startDateObj = filterStartDate ? new Date(filterStartDate) : null;
    const endDateObj = filterEndDate ? new Date(filterEndDate) : null;

    if (startDateObj || endDateObj) {
      currentTrades = currentTrades.filter(trade => {
        const tradeCloseDate = new Date(trade.closeDate); // Ensure it's a Date object

        // To handle timezone correctly, compare dates without time part by resetting to midnight.
        tradeCloseDate.setHours(0, 0, 0, 0);

        const matchesStartDate = !startDateObj || tradeCloseDate >= startDateObj;
        const matchesEndDate = !endDateObj || tradeCloseDate <= endDateObj;
        
        return matchesStartDate && matchesEndDate;
      });
    }

    // Apply Day filter (from calendar click)
    if (selectedDay) {
      currentTrades = currentTrades.filter(trade => {
        const d = trade.closeDate;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key === selectedDay;
      });
    }

    return currentTrades;
  }, [closedTrades, globalSearchTerm, filterStock, filterAssetType, filterOptionType, filterStartDate, filterEndDate, selectedDay]);

  // Recalculate summary based on filtered trades
  const filteredSummary = useMemo(() => {
    if (!rawCsvData) return null; // Don't show summary section if no file is loaded
    return calculateSummary(filteredTrades);
  }, [filteredTrades, rawCsvData]);


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    // Note: This format is for ratios, e.g., 0.5 for 50%. Summary cards may use direct percentages.
    if (isNaN(value) || !isFinite(value)) return '0%';
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  // Helper for formatting raw numbers for CSV export
  const formatNumberForCsv = (amount: number) => amount.toFixed(2);

  // Helper for formatting dates for CSV export
  const formatDateForCsv = (date: Date) => date.toLocaleDateString('en-US');

  // Helper for formatting option type for CSV export
  const formatOptionTypeForCsv = (type: OptionType) => (type === OptionType.CALL ? 'Call' : 'Put');

  const getPnLColorClass = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === null) return 'text-gray-900';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const handleDayClick = (day: string | null) => {
    setSelectedDay(day);
    if (day) setCalendarDisplayMonth(day.slice(0, 7));
  };

  const handleMonthClick = (ym: string | null) => {
    setSelectedMonth(ym);
    setSelectedDay(null);
  };

  const clearFilters = () => {
    setGlobalSearchTerm('');
    setFilterStock('');
    setFilterAssetType('ALL');
    setFilterOptionType('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setSelectedDatePreset('custom');
    setSelectedDay(null);
    setSelectedMonth(null);
  };

  const handleExportCsv = () => {
    if (!filteredTrades || filteredTrades.length === 0) {
      alert('No trades to export!');
      return;
    }

    const csvData = filteredTrades.map(trade => ({
      'Close Date': formatDateForCsv(trade.closeDate),
      'Stock': trade.stockName,
      'Expiry': formatDateForCsv(trade.optionDate),
      'Strike': formatNumberForCsv(trade.strikePrice),
      'Type': formatOptionTypeForCsv(trade.optionType),
      'Matched Qty': trade.matchedQuantity,
      'Sell Date': formatDateForCsv(trade.sellTradeOriginal.originalDate),
      'Sell Price': formatNumberForCsv(trade.sellTradeOriginal.tradePrice),
      'Buy Price': formatNumberForCsv(trade.buyTradeOriginal.tradePrice),
      'Net Fees': formatNumberForCsv(trade.netFees),
      'P&L': formatNumberForCsv(trade.pnl),
      'Return %': `${trade.returnPercentage.toFixed(2)}%`,
      'Annualized Return %': `${trade.annualizedReturnPercentage.toFixed(2)}%`,
      'Remain Days': trade.remainDays,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'filtered_option_trades.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm font-bold tracking-widest uppercase">Loading</span>
        </div>
      </div>
    );
  }

  const iconPnL = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>;
  const iconPercent = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14L15 8M9 9h.01M15 15h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  const iconTrades = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
  const iconWin = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  const iconAvg = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  const iconMax = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>;
  const iconMin = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>;

  const winRate = filteredSummary && filteredSummary.totalTrades > 0
    ? filteredSummary.winningTrades / filteredSummary.totalTrades
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">Option Trading</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dashboard</p>
            </div>
            {firestoreLoading && (
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-2">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Syncing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full border-2 border-slate-100"/>}
                <span className="text-xs font-bold text-slate-600 hidden md:block">{user.displayName || user.email}</span>
                <button onClick={() => logout()} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                  登出
                </button>
              </>
            ) : (
              <button onClick={() => signInWithGoogle()} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google 登入
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Import */}
        <FileUpload
          onDataParsed={handleDataParsed}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          setError={setError}
          existingAccounts={existingAccounts}
          lastImportDate={lastImportDate}
          importProgress={importProgress}
          importStep={importStep}
          setImportProgress={setImportProgress}
          setImportStep={setImportStep}
        />

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {error}
          </div>
        )}

        {/* Filters */}
        {rawCsvData && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filters</span>
                {(filterStock || filterAssetType !== 'ALL' || filterOptionType !== 'ALL' || filterStartDate || filterEndDate || selectedAccount !== 'ALL') && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">Active</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportCsv} disabled={filteredTrades.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Export CSV
                </button>
                <button onClick={clearFilters} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                  Reset
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" value={globalSearchTerm} onChange={(e) => setGlobalSearchTerm(e.target.value)}
                placeholder="Search trades — ticker, type, price, date..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Filter grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {existingAccounts.length > 0 && (
                <div className="lg:col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">帳戶</label>
                  <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                    <option value="ALL">全部帳戶</option>
                    {existingAccounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                  初始資金 {currentBaseFund > 0 && <span className="text-indigo-500 normal-case">{formatCurrency(currentBaseFund)}</span>}
                </label>
                <div className="flex gap-1">
                  <input type="number" min="0" placeholder="e.g. 100000" value={fundInputValue}
                    onChange={(e) => setFundInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFundSave()}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"/>
                  <button onClick={handleFundSave} className="px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black transition-colors">✓</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Symbol</label>
                <input type="text" placeholder="TSLA, NVDA..." value={filterStock} onChange={(e) => setFilterStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"/>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">交易類型</label>
                <select value={filterAssetType} onChange={(e) => setFilterAssetType(e.target.value as AssetType | 'ALL')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  <option value="ALL">全部</option>
                  <option value={AssetType.OPTION}>Option</option>
                  <option value={AssetType.STOCK}>個股</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Option Type</label>
                <select value={filterOptionType} onChange={(e) => setFilterOptionType(e.target.value as OptionType | 'ALL')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  <option value="ALL">All</option>
                  <option value={OptionType.CALL}>Call</option>
                  <option value={OptionType.PUT}>Put</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Period</label>
                <select value={selectedDatePreset} onChange={(e) => setSelectedDatePreset(e.target.value as typeof selectedDatePreset)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  <option value="custom">All Time</option>
                  <option value="current_month">This Month</option>
                  <option value="current_year">This Year</option>
                </select>
              </div>
              {selectedDatePreset === 'custom' && (
                <>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">From</label>
                    <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setSelectedDatePreset('custom'); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"/>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">To</label>
                    <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setSelectedDatePreset('custom'); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"/>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {filteredSummary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              <div className="col-span-2 sm:col-span-1 xl:col-span-2">
                <SummaryCard title="Total P&L" value={formatCurrency(filteredSummary.totalPnL)}
                  valueColorClass={getPnLColorClass(filteredSummary.totalPnL)} icon={iconPnL}
                  description={`${filteredSummary.totalTrades} closed trades`}/>
              </div>
              {currentBaseFund > 0 && (
                <SummaryCard title="Portfolio Return" value={`${((filteredSummary.totalPnL / currentBaseFund) * 100).toFixed(2)}%`}
                  valueColorClass={getPnLColorClass(filteredSummary.totalPnL)} icon={iconPercent}
                  description={`Base: ${formatCurrency(currentBaseFund)}`}/>
              )}
              <SummaryCard title="Win Rate" value={`${formatPercentage(winRate)}`}
                valueColorClass={winRate >= 0.5 ? 'text-emerald-600' : 'text-rose-600'} icon={iconWin}
                description={`${filteredSummary.winningTrades}W / ${filteredSummary.losingTrades}L`}/>
              <SummaryCard title="Avg P&L / Trade" value={formatCurrency(filteredSummary.averagePnLPerTrade)}
                valueColorClass={getPnLColorClass(filteredSummary.averagePnLPerTrade)} icon={iconAvg}/>
              <SummaryCard title="Avg Return %" value={`${filteredSummary.averageReturnPercentage.toFixed(2)}%`}
                valueColorClass={getPnLColorClass(filteredSummary.averageReturnPercentage)} icon={iconPercent}
                description="Per trade ROI"/>
              <SummaryCard title="Max Profit" value={formatCurrency(filteredSummary.maxProfit)}
                valueColorClass="text-emerald-600" icon={iconMax} description="Best single trade"/>
              <SummaryCard title="Max Loss" value={formatCurrency(filteredSummary.maxLoss)}
                valueColorClass="text-rose-600" icon={iconMin} description="Worst single trade"/>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cumulative P&L</h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Over Time</span>
                </div>
                <p className={`text-xl font-black mb-4 ${getPnLColorClass(filteredSummary.totalPnL)}`}>{formatCurrency(filteredSummary.totalPnL)}</p>
                <PnLOverTimeChart trades={filteredTrades} baseFund={currentBaseFund || undefined}/>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly P&L</h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Click to Filter</span>
                </div>
                <p className="text-xl font-black mb-4 text-slate-300">
                  {selectedMonth ? <span className="text-indigo-500">{selectedMonth}</span> : 'All Months'}
                </p>
                <PnLByYearMonthChart trades={filteredTrades} baseFund={currentBaseFund || undefined} onMonthClick={handleMonthClick} selectedMonth={selectedMonth}/>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">P&L by Symbol</h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Top 15</span>
                </div>
                <p className="text-xl font-black mb-4 text-slate-700">{[...new Set(filteredTrades.map(t => t.stockName))].length} Symbols</p>
                <PnLBySymbolChart trades={filteredTrades}/>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Strategy Breakdown</h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">By Type</span>
                </div>
                <p className="text-xl font-black mb-1 text-slate-700">{filteredSummary.totalTrades} Trades</p>
                <PnLByOptionTypeChart trades={filteredTrades}/>
              </div>
            </div>

            {/* P&L Calendar */}
            <PnLCalendarChart
              trades={closedTrades}
              selectedDay={selectedDay}
              onDayClick={handleDayClick}
              displayMonth={calendarDisplayMonth}
              onDisplayMonthChange={setCalendarDisplayMonth}
            />

            {/* Trade Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trade History</h3>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {selectedDay
                      ? <><span className="text-indigo-500">{selectedDay}</span> — {filteredTrades.length} trades</>
                      : `${filteredTrades.length} records`}
                  </p>
                </div>
                {selectedDay && (
                  <button onClick={() => setSelectedDay(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                    Clear Day
                  </button>
                )}
              </div>
              <TradeTable trades={filteredTrades}/>
            </div>
          </>
        )}

        {/* Unmatched */}
        {unmatchedTrades.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-50 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unmatched & Open Positions</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full text-[9px] font-black">{unmatchedTrades.length}</span>
            </div>
            <UnmatchedTradesTable trades={unmatchedTrades}/>
          </div>
        )}

        {/* Empty state */}
        {!rawCsvData && !error && !isLoading && !firestoreLoading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
            {!user ? (
              <>
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 border border-indigo-100">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <h2 className="text-lg font-black text-slate-900 mb-2">請先登入</h2>
                <p className="text-sm text-slate-400 mb-6 max-w-xs">登入 Google 帳號以載入您的歷史交易紀錄，或直接匯入新的 CSV。</p>
                <button onClick={() => signInWithGoogle()} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  使用 Google 登入
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-5 border border-slate-100">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                </div>
                <h2 className="text-lg font-black text-slate-900 mb-2">尚無交易紀錄</h2>
                <p className="text-sm text-slate-400 max-w-xs">上傳 CSV 檔案以開始分析您的期權交易。</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;