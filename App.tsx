import React, { useState, useMemo, useEffect } from 'react';
import { RawTrade, ParsedTrade, ClosedTrade, SummaryData, OptionType } from './types';
import { parseTrades, processClosedTrades, calculateSummary } from './services/csvParser';
import FileUpload from './components/FileUpload';
import SummaryCard from './components/SummaryCard';
import TradeTable from './components/TradeTable';
import PnLOverTimeChart from './components/PnLOverTimeChart';
import PnLBySymbolChart from './components/PnLBySymbolChart';
import PnLByOptionTypeChart from './components/PnLByOptionTypeChart';
import PnLByYearMonthChart from './components/PnLByYearMonthChart';
import UnmatchedTradesTable from './components/UnmatchedTradesTable';


declare const Papa: any; // PapaParse is loaded via CDN

// Helper function to format Date objects to YYYY-MM-DD for input type="date"
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
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
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<'custom' | 'current_month' | 'current_year'>('custom');
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');


  const handleDataParsed = (data: RawTrade[]) => {
    setRawCsvData(data);
    setError(null); // Clear previous errors
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

    if (selectedDatePreset !== 'custom') {
      setFilterStartDate(newStartDate);
      setFilterEndDate(newEndDate);
    }
  }, [selectedDatePreset]);


  const filteredTrades = useMemo(() => {
    let currentTrades = closedTrades;

    const lowerCaseGlobalSearch = globalSearchTerm.toLowerCase();
    const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2, });
    const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 });


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

    return currentTrades;
  }, [closedTrades, globalSearchTerm, filterStock, filterOptionType, filterStartDate, filterEndDate]);

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

  const clearFilters = () => {
    setGlobalSearchTerm(''); // Clear global search
    setFilterStock('');
    setFilterOptionType('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setSelectedDatePreset('custom'); // Reset date preset
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <header className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-2 sm:mb-0">Option Trading Dashboard</h1>
        <div className="text-sm text-gray-600">
          Powered by React, TypeScript, and Tailwind CSS
        </div>
      </header>

      <FileUpload
        onDataParsed={handleDataParsed}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        setError={setError}
      />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {rawCsvData && (
        <>
        <section className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Filter & Search Trades</h2>
          {/* Global Search Input */}
          <div className="relative mb-6">
            <label htmlFor="globalSearch" className="block text-sm font-medium text-gray-700 sr-only">Search All Trades</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                name="globalSearch"
                id="globalSearch"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 sm:text-sm border-gray-300 rounded-md py-2"
                placeholder="Search all trades (e.g., TSLA, Put, $250.00, 10/31/2025)"
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="filterStock" className="block text-sm font-medium text-gray-700">Stock Symbol</label>
              <input
                id="filterStock"
                type="text"
                placeholder="e.g., AAPL"
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="filterOptionType" className="block text-sm font-medium text-gray-700">Option Type</label>
              <select
                id="filterOptionType"
                value={filterOptionType}
                onChange={(e) => setFilterOptionType(e.target.value as OptionType | 'ALL')}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="ALL">All</option>
                <option value={OptionType.CALL}>Call</option>
                <option value={OptionType.PUT}>Put</option>
              </select>
            </div>
            <div>
              <label htmlFor="datePreset" className="block text-sm font-medium text-gray-700">Date Range Preset</label>
              <select
                id="datePreset"
                value={selectedDatePreset}
                onChange={(e) => setSelectedDatePreset(e.target.value as typeof selectedDatePreset)}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="custom">Custom Range</option>
                <option value="current_month">Current Month</option>
                <option value="current_year">Current Year</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                    id="filterStartDate"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => { setFilterStartDate(e.target.value); setSelectedDatePreset('custom'); }}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                    id="filterEndDate"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => { setFilterEndDate(e.target.value); setSelectedDatePreset('custom'); }}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:bg-blue-300"
                disabled={filteredTrades.length === 0}
              >
                Download CSV
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
        </section>
        </>
      )}

      {filteredSummary && ( 
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              title="Total P&L"
              value={formatCurrency(filteredSummary.totalPnL)}
              valueColorClass={getPnLColorClass(filteredSummary.totalPnL)}
              description="Overall profit or loss from filtered trades"
            />
            <SummaryCard
              title="Total Trades"
              value={filteredSummary.totalTrades}
              description="Number of closed trades in filtered results"
            />
            <SummaryCard
              title="Winning Trades"
              value={`${filteredSummary.winningTrades} (${formatPercentage(filteredSummary.totalTrades > 0 ? filteredSummary.winningTrades / filteredSummary.totalTrades : 0)})`}
              valueColorClass="text-green-600"
              description="Trades with positive P&L in filtered results"
            />
            <SummaryCard
              title="Losing Trades"
              value={`${filteredSummary.losingTrades} (${formatPercentage(filteredSummary.totalTrades > 0 ? filteredSummary.losingTrades / filteredSummary.totalTrades : 0)})`}
              valueColorClass="text-red-600"
              description="Trades with negative P&L in filtered results"
            />
             <SummaryCard
              title="Average P&L / Trade"
              value={formatCurrency(filteredSummary.averagePnLPerTrade)}
              valueColorClass={getPnLColorClass(filteredSummary.averagePnLPerTrade)}
              description="Average profit or loss per filtered trade"
            />
             <SummaryCard
              title="Average Return %"
              value={`${filteredSummary.averageReturnPercentage.toFixed(2)}%`}
              valueColorClass={getPnLColorClass(filteredSummary.averageReturnPercentage)}
              description="Average return on investment per filtered trade"
            />
             <SummaryCard
              title="Max Profit"
              value={formatCurrency(filteredSummary.maxProfit)}
              valueColorClass="text-green-600"
              description="Largest single trade profit in filtered results"
            />
            <SummaryCard
              title="Max Loss"
              value={formatCurrency(filteredSummary.maxLoss)}
              valueColorClass="text-red-600"
              description="Largest single trade loss in filtered results"
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <PnLOverTimeChart trades={filteredTrades} />
            <PnLByYearMonthChart trades={filteredTrades} />
            <PnLBySymbolChart trades={filteredTrades} />
            <PnLByOptionTypeChart trades={filteredTrades} />
          </section>

          <section>
            <TradeTable trades={filteredTrades} />
          </section>
        </>
      )}

      {unmatchedTrades.length > 0 && (
        <section className="mt-8">
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Unmatched & Open Positions</h2>
                <UnmatchedTradesTable trades={unmatchedTrades} />
            </div>
        </section>
      )}

      {!rawCsvData && !error && !isLoading && (
        <div className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-md">
          <svg className="w-20 h-20 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l3-3m0 0l3 3m-3-3v14m-3 0H6a2 2 0 01-2-2V6a2 2 0 012-2h3m0 16h6m-6 0h.01M9 19H9"></path>
          </svg>
          <p className="text-xl text-gray-700 font-medium mb-2">Ready for your trading insights!</p>
          <p className="text-gray-500">Upload a CSV file to begin analyzing your option trades.</p>
        </div>
      )}
    </div>
  );
}

export default App;