
export enum AssetType {
  STOCK = 'STOCK',
  OPTION = 'OPTION',
  OTHER = 'OTHER',
}

export enum OptionType {
  CALL = 'C',
  PUT = 'P',
}

export enum TradeAction {
  SELL_TO_OPEN = 'Sell to Open',
  BUY_TO_CLOSE = 'Buy to Close',
  BUY_TO_OPEN = 'Buy to Open',
  SELL_TO_CLOSE = 'Sell to Close',
  SELL = 'Sell',
  BUY = 'Buy',
}

// Raw data structure from CSV
export interface RawTrade {
  Date: string;
  Action: string;
  Symbol: string;
  Description: string;
  Quantity: string;
  Price: string;
  'Fees & Comm': string;
  Amount: string;
  Account: string; // New field for multi-account support
}

// Parsed symbol details from the 'Symbol' string
export interface ParsedSymbol {
  stockName: string;
  assetType: AssetType;
  optionDate?: Date; // Expiry date of the option
  strikePrice?: number;
  optionType?: OptionType;
  uniqueKey: string; // E.g., 'TSLA-2025-11-14-430.00-P' or 'AAPL-STOCK'
}

// Fully parsed trade record, extending ParsedSymbol
export interface ParsedTrade extends ParsedSymbol {
  id: string; // Unique ID for each raw trade row
  originalDate: Date; // Date of the trade transaction
  action: TradeAction;
  quantity: number;
  tradePrice: number; // Price per option contract
  fees: number;
  amount: number; // Total amount for the trade (including fees)
  account: string; // New field for multi-account support
}

// Tracker for open 'Sell to Open' positions, considering remaining quantity
export interface OpenPositionTracker {
  trade: ParsedTrade;
  remainingQuantity: number;
}

// Structure for a closed option trade pair (Sell to Open + Buy to Close)
export interface ClosedTrade {
  id: string; // Unique ID for the specific matched quantity segment
  sellTradeOriginal: ParsedTrade; // The original 'Sell to Open' or 'Sell to Close' trade
  buyTradeOriginal: ParsedTrade;  // The original 'Buy to Open' or 'Buy to Close' trade
  matchedQuantity: number;      // The number of contracts matched in this close event

  pnl: number; // Profit or Loss for the matchedQuantity
  netFees: number; // Net fees for the matchedQuantity
  returnPercentage: number; // Return on Investment for the matchedQuantity, as a percentage
  remainDays: number; // Number of days the trade was open
  annualizedReturnPercentage: number; // Annualized return based on returnPercentage and remainDays

  stockName: string;
  assetType: AssetType;
  optionDate?: Date;
  strikePrice?: number;
  optionType?: OptionType;
  closeDate: Date; // Date of the closing trade
  account: string; // New field for multi-account support
}

// Summary statistics for the dashboard
export interface SummaryData {
  totalPnL: number;
  totalTrades: number; // Total number of closed option trades (matched quantity segments)
  winningTrades: number;
  losingTrades: number;
  averagePnLPerTrade: number;
  averageReturnPercentage: number; // Average return percentage across all closed trades
  averageAnnualizedReturnPercentage: number; // Average annualized return percentage across all closed trades
  maxAnnualizedReturnPercentage: number; // Max annualized return percentage among all closed trades
  maxProfit: number;
  maxLoss: number;
  profitFactor: number; // Sum of gains / Sum of losses
  profitRatio: number; // Average win / Average loss
}
