const {
  detectTradeSetup
} = require('../strategy/trade-setup');

const {
  simulateTrade
} = require('../paper/paper-trade-engine');

const {
  analyzePerformance
} = require('./performance-analyzer');

const {
  calculateIndicators
} = require('../indicators/technical-indicators');

const SYMBOL = 'XAU/USD';

function evaluatePriceActionStrategy({
  candles,
  maxTrades = 10,
  stopLossPercent = 0.01,
  takeProfitPercent = 0.02,
  atrStopMultiplier = 1.5,
  atrTakeProfitMultiplier = 3
}) {
  if (!Array.isArray(candles) || candles.length < 60) {
    throw new Error('At least 60 candles are required');
  }

  if (!Number.isInteger(maxTrades) || maxTrades <= 0) {
    throw new Error(
      'maxTrades must be a positive integer'
    );
  }

  const trades = [];
  let nextAvailableSignalIndex = 49;

  for (
    let signalIndex = 49;
    signalIndex < candles.length - 1;
    signalIndex += 1
  ) {
    if (trades.length >= maxTrades) {
      break;
    }

    if (signalIndex < nextAvailableSignalIndex) {
      continue;
    }

    const history =
      candles.slice(0, signalIndex + 1);

    const setup =
      detectTradeSetup(history, {
        symbol: SYMBOL
      });

    if (!['BUY', 'SELL'].includes(setup.signal)) {
      continue;
    }

    const indicators =
      calculateIndicators(history);

    const atr14 = indicators.atr14;

    const trade =
      simulateTrade({
        candles,
        signal: setup.signal,
        signalIndex,
        stopLossPercent,
        takeProfitPercent,
        atr: atr14,
        atrStopMultiplier,
        atrTakeProfitMultiplier
      });

    if (
      trade.result !== 'WIN' &&
      trade.result !== 'LOSS'
    ) {
      continue;
    }

    trades.push({
      ...trade,
      setupSignal: setup.signal,
      setupReason: setup.reason,
      priceActionPatterns:
        setup.priceAction.patterns,
      nearSupport: setup.nearSupport,
      nearResistance: setup.nearResistance,
      supportPrice:
        setup.support?.price ?? null,
      resistancePrice:
        setup.resistance?.price ?? null
    });

    nextAvailableSignalIndex =
      trade.exitIndex + 1;
  }

  return {
    symbol: SYMBOL,
    trades,
    performance: analyzePerformance(trades)
  };
}

module.exports = {
  SYMBOL,
  evaluatePriceActionStrategy
};
