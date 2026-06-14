import { RawTrade } from '../types';

export type BrokerName = 'tda' | 'ibkr' | 'tastytrade' | 'unknown';

export const BROKER_DISPLAY_NAMES: Record<BrokerName, string> = {
  tda: 'TD Ameritrade / Schwab',
  ibkr: 'Interactive Brokers',
  tastytrade: 'Tastytrade',
  unknown: 'Unknown Format',
};

interface BrokerConfig {
  name: BrokerName;
  columnMap: {
    Date: string;
    Action: string | null;
    Symbol: string | null;
    Description: string;
    Quantity: string;
    Price: string;
    Fees: string;
    Amount: string;
    Account?: string;
  };
  deriveAction?: (row: Record<string, string>) => string;
  deriveSymbol?: (row: Record<string, string>) => string;
  normalizeQuantity?: (row: Record<string, string>) => string;
}

const TDA_CONFIG: BrokerConfig = {
  name: 'tda',
  columnMap: {
    Date: 'Date',
    Action: 'Action',
    Symbol: 'Symbol',
    Description: 'Description',
    Quantity: 'Quantity',
    Price: 'Price',
    Fees: 'Fees & Comm',
    Amount: 'Amount',
    Account: 'Account',
  },
};

const IBKR_CONFIG: BrokerConfig = {
  name: 'ibkr',
  columnMap: {
    Date: 'TradeDate',
    Action: null,
    Symbol: null,
    Description: 'Description',
    Quantity: 'Quantity',
    Price: 'TradePrice',
    Fees: 'IBCommission',
    Amount: 'NetCash',
    Account: 'ClientAccountID',
  },
  deriveAction: (row) => {
    const isOpen = (row['Open/CloseIndicator'] ?? '').trim() === 'O';
    const qty = parseFloat(row['Quantity'] ?? '0');
    const isBuy = qty > 0;
    if (isBuy && isOpen) return 'Buy to Open';
    if (isBuy && !isOpen) return 'Buy to Close';
    if (!isBuy && isOpen) return 'Sell to Open';
    return 'Sell to Close';
  },
  deriveSymbol: (row) => {
    const assetClass = (row['AssetClass'] ?? row['asset_class'] ?? '').trim().toUpperCase();
    const underlying = (row['UnderlyingSymbol'] ?? row['Symbol'] ?? '').trim();
    if (assetClass !== 'OPT') return underlying;
    const expiryRaw = (row['Expiry'] ?? '').trim(); // IBKR: YYYYMMDD
    if (!expiryRaw || expiryRaw.length < 8) return underlying;
    const mm = expiryRaw.slice(4, 6);
    const dd = expiryRaw.slice(6, 8);
    const yyyy = expiryRaw.slice(0, 4);
    const strike = (row['Strike'] ?? '').trim();
    const right = (row['Put/Call'] ?? row['Right'] ?? '').trim().charAt(0).toUpperCase();
    return `${underlying} ${mm}/${dd}/${yyyy} ${strike} ${right}`;
  },
  normalizeQuantity: (row) => String(Math.abs(parseFloat(row['Quantity'] ?? '0'))),
};

const TASTYTRADE_CONFIG: BrokerConfig = {
  name: 'tastytrade',
  columnMap: {
    Date: 'Date/Time',
    Action: null,
    Symbol: null,
    Description: 'Description',
    Quantity: 'Quantity',
    Price: 'Price',
    Fees: 'Fees',
    Amount: 'Amount',
    Account: 'Account Reference',
  },
  deriveAction: (row) => {
    const buySell = (row['Buy/Sell'] ?? '').trim();
    const openClose = (row['Open/Close'] ?? '').trim();
    const b = buySell.toLowerCase();
    const o = openClose.toLowerCase();
    if (b === 'buy' && o === 'open') return 'Buy to Open';
    if (b === 'buy' && o === 'close') return 'Buy to Close';
    if (b === 'sell' && o === 'open') return 'Sell to Open';
    if (b === 'sell' && o === 'close') return 'Sell to Close';
    // Fallback: use Buy/Sell directly for stock rows
    if (b === 'buy') return 'Buy';
    if (b === 'sell') return 'Sell';
    return buySell;
  },
  deriveSymbol: (row) => {
    const underlying = (row['Symbol'] ?? '').trim();
    const expiry = (row['Expiration Date'] ?? '').trim(); // MM/DD/YYYY
    const strike = (row['Strike Price'] ?? '').trim();
    const callPut = (row['Call/Put'] ?? '').trim().charAt(0).toUpperCase();
    if (expiry && strike && callPut) {
      return `${underlying} ${expiry} ${strike} ${callPut}`;
    }
    return underlying;
  },
};

const BROKER_CONFIGS: Record<BrokerName, BrokerConfig> = {
  tda: TDA_CONFIG,
  ibkr: IBKR_CONFIG,
  tastytrade: TASTYTRADE_CONFIG,
  unknown: TDA_CONFIG, // fallback — will likely fail but at least uses same path
};

export function detectBroker(headers: string[]): BrokerName {
  const h = new Set(headers.map(s => s.trim()));

  // IBKR Flex Query fingerprint
  if (h.has('ClientAccountID') || h.has('Open/CloseIndicator') || h.has('UnderlyingSymbol')) {
    return 'ibkr';
  }

  // Tastytrade fingerprint — unique combination of split Buy/Sell + Open/Close columns
  if (
    (h.has('Transaction Code') || h.has('Transaction Subcode')) &&
    h.has('Buy/Sell') &&
    h.has('Open/Close') &&
    h.has('Expiration Date')
  ) {
    return 'tastytrade';
  }

  // TD Ameritrade / Schwab (same format)
  if (h.has('Date') && h.has('Action') && h.has('Symbol') && h.has('Fees & Comm')) {
    return 'tda';
  }

  return 'unknown';
}

export function getBrokerConfig(broker: BrokerName): BrokerConfig {
  return BROKER_CONFIGS[broker];
}

export function normalizeRow(
  row: Record<string, string>,
  config: BrokerConfig,
): RawTrade {
  const { columnMap } = config;

  const action = columnMap.Action
    ? (row[columnMap.Action] ?? '')
    : (config.deriveAction ? config.deriveAction(row) : '');

  const symbol = columnMap.Symbol
    ? (row[columnMap.Symbol] ?? '')
    : (config.deriveSymbol ? config.deriveSymbol(row) : '');

  const qty = config.normalizeQuantity
    ? config.normalizeQuantity(row)
    : (row[columnMap.Quantity] ?? '');

  return {
    Date: row[columnMap.Date] ?? '',
    Action: action,
    Symbol: symbol,
    Description: row[columnMap.Description] ?? '',
    Quantity: qty,
    Price: row[columnMap.Price] ?? '',
    'Fees & Comm': row[columnMap.Fees] ?? '',
    Amount: row[columnMap.Amount] ?? '',
    Account: columnMap.Account ? (row[columnMap.Account] ?? '') : '',
  };
}
