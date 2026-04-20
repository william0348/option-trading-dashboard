
import { ParsedTrade, RawTrade, OptionType, TradeAction, ParsedSymbol, ClosedTrade, SummaryData, OpenPositionTracker, AssetType } from '../types';

declare const Papa: any; // PapaParse is loaded via CDN

/**
 * Parses a numeric string from CSV, handling currency symbols, commas, and parentheses for negatives.
 */
function parseNumericValue(value: string | number): number {
  if (value === null || value === undefined) return 0;
  const stringValue = String(value);
  if (stringValue.trim() === '') return 0;

  let cleanValue = stringValue.replace(/[$,]/g, '').trim();
  let isNegative = false;
  if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
    isNegative = true;
    cleanValue = cleanValue.substring(1, cleanValue.length - 1);
  }
  const num = parseFloat(cleanValue);
  return isNaN(num) ? 0 : (isNegative ? -Math.abs(num) : num);
}

/**
 * Robustly parses a date string into a Date object.
 * Strictly prioritizes MM/DD/YYYY to ensure "01/02/2025" is always January 2nd.
 * Normalizes all outputs to UTC midnight.
 */
export function robustParseDate(dateInput: any): Date | null {
  if (!dateInput) return null;
  
  // If already a Date object (unlikely in raw trades but possible in processed ones)
  if (dateInput instanceof Date) {
    return new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  }

  const dateStr = String(dateInput).trim();

  // 1. Check for ISO Format (YYYY-MM-DD...) first (used by Google Sheets JSON exports)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }

  // 2. STRICT MM/DD/YYYY PARSING (Broker/Excel default)
  // This prevents browser locale from flipping 01/02 to Feb 1st.
  const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match = dateStr.match(mmddyyyyRegex);
  if (match) {
    const m = parseInt(match[1], 10);
    const d = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    // Jan is 0, Feb is 1...
    const manualDate = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(manualDate.getTime())) return manualDate;
  }

  // 3. Last resort: Native parsing
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate()));
  }

  return null;
}

export function parseSymbol(symbolString: string): ParsedSymbol | null {
  if (!symbolString) return null;
  const parts = symbolString.split(' ');
  
  // Try to parse as Option first
  if (parts.length >= 4) {
    const stockName = parts[0];
    const optionDateStr = parts[1];
    const strikePriceStr = parts[2];
    const optionTypeChar = parts[3];

    const optionDate = robustParseDate(optionDateStr);
    if (optionDate) {
      const strikePrice = parseFloat(strikePriceStr);
      if (!isNaN(strikePrice) && (optionTypeChar === 'P' || optionTypeChar === 'C')) {
        const optionType = optionTypeChar === 'P' ? OptionType.PUT : OptionType.CALL;
        const uniqueKey = `${stockName}-${optionDate.toISOString().split('T')[0]}-${strikePrice.toFixed(2)}-${optionType}`;
        return { stockName, assetType: AssetType.OPTION, optionDate, strikePrice, optionType, uniqueKey };
      }
    }
  }

  // Default to Stock
  const stockName = parts[0];
  const uniqueKey = `${stockName}-STOCK`;
  return { stockName, assetType: AssetType.STOCK, uniqueKey };
}

export function parseTrades(data: RawTrade[]): ParsedTrade[] {
  const parsedTrades: ParsedTrade[] = [];
  let idCounter = 0;

  for (const rawTrade of data) {
    const actionStr = String(rawTrade.Action || '').trim();
    
    // Normalize action strings for comparison
    const normalizedActionStr = actionStr.toLowerCase();
    
    // Map raw action strings to TradeAction enum
    let action: TradeAction | null = null;
    if (normalizedActionStr === 'sell to open') action = TradeAction.SELL_TO_OPEN;
    else if (normalizedActionStr === 'buy to close') action = TradeAction.BUY_TO_CLOSE;
    else if (normalizedActionStr === 'buy to open') action = TradeAction.BUY_TO_OPEN;
    else if (normalizedActionStr === 'sell to close') action = TradeAction.SELL_TO_CLOSE;
    else if (normalizedActionStr === 'buy') action = TradeAction.BUY;
    else if (normalizedActionStr === 'sell') action = TradeAction.SELL;
    // Fallback direct match if broker uses exact enum strings
    if (!action) {
      const foundAction = Object.values(TradeAction).find(v => v.toLowerCase() === normalizedActionStr);
      if (foundAction) action = foundAction as TradeAction;
    }

    if (!action) continue;

    const symbolDetails = parseSymbol(rawTrade.Symbol);
    if (!symbolDetails) continue;

    const originalDate = robustParseDate(rawTrade.Date);
    if (!originalDate) continue;

    parsedTrades.push({
      id: `trade-${idCounter++}`,
      ...symbolDetails,
      originalDate,
      action,
      quantity: parseNumericValue(rawTrade.Quantity),
      tradePrice: parseNumericValue(rawTrade.Price),
      fees: parseNumericValue(rawTrade['Fees & Comm']),
      amount: parseNumericValue(rawTrade.Amount),
      account: (rawTrade.Account || (rawTrade as any).account || 'Default').trim(),
    });
  }
  return parsedTrades;
}

export function processClosedTrades(tradesToProcess: ParsedTrade[]): { closedTrades: ClosedTrade[], openPositions: ParsedTrade[], unmatchedCloses: ParsedTrade[] } {
  // CRITICAL: Copy the array before sorting to avoid modifying external state in-place.
  const parsedTrades = [...tradesToProcess];
  const openShorts: Record<string, OpenPositionTracker[]> = {};
  const openLongs: Record<string, OpenPositionTracker[]> = {};
  const closedTrades: ClosedTrade[] = [];
  const unmatchedCloses: ParsedTrade[] = [];
  let closedTradeIdCounter = 0;

  // Helper to prioritize actions on the same day: Open before Close
  const getActionPriority = (action: TradeAction): number => {
    switch (action) {
      case TradeAction.SELL_TO_OPEN:
      case TradeAction.BUY_TO_OPEN:
      case TradeAction.BUY: // For stocks, buy is usually opening long
        return 0; // High priority: Process openings first
      case TradeAction.BUY_TO_CLOSE:
      case TradeAction.SELL_TO_CLOSE:
      case TradeAction.SELL: // For stocks, sell is usually closing long
        return 1; // Lower priority: Process closings second
      default:
        return 2;
    }
  };

  // CRITICAL: Stable sort by date, then by Action Priority (Open before Close), then by ID.
  // This ensures that if an open and close occur on the same day, the position is established before closure is attempted.
  parsedTrades.sort((a, b) => {
    const dateDiff = a.originalDate.getTime() - b.originalDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    
    const priorityDiff = getActionPriority(a.action) - getActionPriority(b.action);
    if (priorityDiff !== 0) return priorityDiff;

    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const lastTradeDate = parsedTrades.length > 0 ? parsedTrades[parsedTrades.length - 1].originalDate : today;
  const referenceDate = new Date(Math.max(lastTradeDate.getTime(), today.getTime()));

  for (const trade of parsedTrades) {
    const isOption = trade.assetType === AssetType.OPTION;

    if (trade.action === TradeAction.SELL_TO_OPEN || (trade.action === TradeAction.SELL && !isOption && (!openLongs[trade.uniqueKey] || openLongs[trade.uniqueKey].length === 0))) {
      // It's a Sell to Open or a Stock Sell when no long position exists
      if (!openShorts[trade.uniqueKey]) openShorts[trade.uniqueKey] = [];
      openShorts[trade.uniqueKey].push({ trade, remainingQuantity: trade.quantity });
    } else if (trade.action === TradeAction.BUY_TO_OPEN || (trade.action === TradeAction.BUY && !isOption && (!openShorts[trade.uniqueKey] || openShorts[trade.uniqueKey].length === 0))) {
      // It's a Buy to Open or a Stock Buy when no short position exists
      if (!openLongs[trade.uniqueKey]) openLongs[trade.uniqueKey] = [];
      openLongs[trade.uniqueKey].push({ trade, remainingQuantity: trade.quantity });
    }
    else if (trade.action === TradeAction.BUY_TO_CLOSE || (trade.action === TradeAction.BUY && !isOption)) {
      // It's a Buy to Close or a Stock Buy (check for shorts first)
      let quantityToMatch = trade.quantity;
      const matchingOpenSells = openShorts[trade.uniqueKey];
      if (matchingOpenSells && matchingOpenSells.length > 0) {
        for (const openSell of matchingOpenSells) {
          if (quantityToMatch === 0) break;
          const matchedQuantity = Math.min(quantityToMatch, openSell.remainingQuantity);
          if (matchedQuantity > 0) {
            closedTrades.push(createClosedTrade(openSell.trade, trade, matchedQuantity, `closed-short-${closedTradeIdCounter++}`));
            openSell.remainingQuantity -= matchedQuantity;
            quantityToMatch -= matchedQuantity;
          }
        }
        openShorts[trade.uniqueKey] = matchingOpenSells.filter(t => t.remainingQuantity > 0);
        if (quantityToMatch > 0) {
            // Remaining stock buy becomes a long position
            if (!isOption) {
                if (!openLongs[trade.uniqueKey]) openLongs[trade.uniqueKey] = [];
                openLongs[trade.uniqueKey].push({ trade, remainingQuantity: quantityToMatch });
            } else {
                unmatchedCloses.push({ ...trade, quantity: quantityToMatch });
            }
        }
      } else {
        if (!isOption) {
            if (!openLongs[trade.uniqueKey]) openLongs[trade.uniqueKey] = [];
            openLongs[trade.uniqueKey].push({ trade, remainingQuantity: quantityToMatch });
        } else {
            unmatchedCloses.push(trade);
        }
      }
    }
    else if (trade.action === TradeAction.SELL_TO_CLOSE || (trade.action === TradeAction.SELL && !isOption)) {
        // It's a Sell to Close or a Stock Sell (check for longs first)
        let quantityToMatch = trade.quantity;
        const matchingOpenBuys = openLongs[trade.uniqueKey];
        if (matchingOpenBuys && matchingOpenBuys.length > 0) {
            for (const openBuy of matchingOpenBuys) {
                if (quantityToMatch === 0) break;
                const matchedQuantity = Math.min(quantityToMatch, openBuy.remainingQuantity);
                if (matchedQuantity > 0) {
                    closedTrades.push(createClosedTrade(trade, openBuy.trade, matchedQuantity, `closed-long-${closedTradeIdCounter++}`));
                    openBuy.remainingQuantity -= matchedQuantity;
                    quantityToMatch -= matchedQuantity;
                }
            }
            openLongs[trade.uniqueKey] = matchingOpenBuys.filter(t => t.remainingQuantity > 0);
            if (quantityToMatch > 0) {
                // Remaining stock sell becomes a short position
                if (!isOption) {
                    if (!openShorts[trade.uniqueKey]) openShorts[trade.uniqueKey] = [];
                    openShorts[trade.uniqueKey].push({ trade, remainingQuantity: quantityToMatch });
                } else {
                    unmatchedCloses.push({ ...trade, quantity: quantityToMatch });
                }
            }
        } else {
            if (!isOption) {
                if (!openShorts[trade.uniqueKey]) openShorts[trade.uniqueKey] = [];
                openShorts[trade.uniqueKey].push({ trade, remainingQuantity: quantityToMatch });
            } else {
                unmatchedCloses.push(trade);
            }
        }
    }
  }

  processExpiredPositions(openShorts, referenceDate, 'short', closedTrades);
  processExpiredPositions(openLongs, referenceDate, 'long', closedTrades);

  const openPositions: ParsedTrade[] = [
    ...Object.values(openShorts).flat().map(tracker => ({ ...tracker.trade, quantity: tracker.remainingQuantity })),
    ...Object.values(openLongs).flat().map(tracker => ({ ...tracker.trade, quantity: tracker.remainingQuantity })),
  ].filter(t => t.quantity > 0);

  return { closedTrades, openPositions, unmatchedCloses };
}

function createClosedTrade(sellTrade: ParsedTrade, buyTrade: ParsedTrade, matchedQuantity: number, id: string): ClosedTrade {
  const isOption = buyTrade.assetType === AssetType.OPTION;
  const isLongPosition = (buyTrade.action === TradeAction.BUY_TO_OPEN || buyTrade.action === TradeAction.BUY) && 
                         (sellTrade.action === TradeAction.SELL_TO_CLOSE || sellTrade.action === TradeAction.SELL);
  const openingTrade = isLongPosition ? buyTrade : sellTrade;
  const closingTrade = isLongPosition ? sellTrade : buyTrade;

  const openDate = openingTrade.originalDate;
  const closeDate = closingTrade.originalDate;

  const pnlPerUnitSell = sellTrade.amount / sellTrade.quantity;
  const pnlPerUnitBuy = buyTrade.amount / buyTrade.quantity;
  const pnl = (pnlPerUnitSell + pnlPerUnitBuy) * matchedQuantity;
  
  const timeDiff = closeDate.getTime() - openDate.getTime();
  let remainDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  if (remainDays <= 0) remainDays = 1;
  
  let returnOnInvestment = 0;
  if (isOption) {
    if (isLongPosition) {
      const investment = Math.abs((buyTrade.amount / buyTrade.quantity) * matchedQuantity);
      returnOnInvestment = investment !== 0 ? (pnl / investment) * 100 : 0;
    } else {
      // Short option (collateral based)
      const collateral = ((sellTrade.strikePrice || 0) * 100) * matchedQuantity;
      returnOnInvestment = collateral > 0 ? (pnl / collateral) * 100 : 0;
    }
  } else {
    // Stock (investment based)
    const investment = Math.abs((openingTrade.amount / openingTrade.quantity) * matchedQuantity);
    returnOnInvestment = investment !== 0 ? (pnl / investment) * 100 : 0;
  }

  return {
    id,
    sellTradeOriginal: sellTrade,
    buyTradeOriginal: buyTrade,
    matchedQuantity,
    pnl,
    netFees: (sellTrade.fees / sellTrade.quantity + buyTrade.fees / buyTrade.quantity) * matchedQuantity,
    returnPercentage: returnOnInvestment,
    remainDays,
    annualizedReturnPercentage: returnOnInvestment * (365 / remainDays),
    stockName: buyTrade.stockName,
    assetType: buyTrade.assetType,
    optionDate: buyTrade.optionDate,
    strikePrice: buyTrade.strikePrice,
    optionType: buyTrade.optionType,
    closeDate,
    account: buyTrade.account,
  };
}

function processExpiredPositions(openPositions: Record<string, OpenPositionTracker[]>, referenceDate: Date, positionType: 'long' | 'short', closedTrades: ClosedTrade[]) {
  Object.values(openPositions).flat().forEach(tracker => {
    if (tracker.remainingQuantity > 0 && tracker.trade.assetType === AssetType.OPTION && tracker.trade.optionDate && tracker.trade.optionDate <= referenceDate) {
      const openTrade = tracker.trade;
      const matchedQuantity = tracker.remainingQuantity;
      if (positionType === 'short') { 
        const syntheticBuy = { ...openTrade, originalDate: openTrade.optionDate, tradePrice: 0, fees: 0, amount: 0, quantity: matchedQuantity, action: TradeAction.BUY_TO_CLOSE };
        closedTrades.push(createClosedTrade(openTrade, syntheticBuy, matchedQuantity, `expired-short-${openTrade.id}`));
      } else { 
        const syntheticSell = { ...openTrade, originalDate: openTrade.optionDate, tradePrice: 0, fees: 0, amount: 0, quantity: matchedQuantity, action: TradeAction.SELL_TO_CLOSE };
        closedTrades.push(createClosedTrade(syntheticSell, openTrade, matchedQuantity, `expired-long-${openTrade.id}`));
      }
      tracker.remainingQuantity = 0;
    }
  });
}

export function calculateSummary(closedTrades: ClosedTrade[]): SummaryData {
  let totalPnL = 0, winningTrades = 0, losingTrades = 0, maxProfit = 0, maxLoss = 0;
  let totalReturn = 0, totalAnnualized = 0, maxAnnualized = -Infinity;
  let totalWinAmount = 0, totalLossAmount = 0;

  for (const trade of closedTrades) {
    totalPnL += trade.pnl;
    if (trade.pnl > 0) {
      winningTrades++;
      maxProfit = Math.max(maxProfit, trade.pnl);
      totalWinAmount += trade.pnl;
    } else if (trade.pnl < 0) {
      losingTrades++;
      maxLoss = Math.min(maxLoss, trade.pnl);
      totalLossAmount += Math.abs(trade.pnl);
    }
    totalReturn += trade.returnPercentage;
    totalAnnualized += trade.annualizedReturnPercentage;
    maxAnnualized = Math.max(maxAnnualized, trade.annualizedReturnPercentage);
  }

  const total = closedTrades.length || 1;
  const avgWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;

  return {
    totalPnL,
    totalTrades: closedTrades.length,
    winningTrades,
    losingTrades,
    averagePnLPerTrade: totalPnL / total,
    averageReturnPercentage: totalReturn / total,
    averageAnnualizedReturnPercentage: totalAnnualized / total,
    maxAnnualizedReturnPercentage: closedTrades.length ? maxAnnualized : 0,
    maxProfit,
    maxLoss,
    profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : (totalWinAmount > 0 ? Infinity : 0),
    profitRatio: avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0),
  };
}
