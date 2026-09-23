function validateCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error('At least 2 candles are required');
  }

  for (const candle of candles) {
    for (const field of ['open', 'high', 'low', 'close']) {
      if (!Number.isFinite(Number(candle[field]))) {
        throw new Error(`Invalid candle ${field} value`);
      }
    }
  }
}

function calculateLevels({
  signal,
  entryPrice,
  stopLossPercent = 0.01,
  takeProfitPercent = 0.02,
  atr = null,
  atrStopMultiplier = 1.5,
  atrTakeProfitMultiplier = 3
}) {
  if (!['BUY', 'SELL'].includes(signal)) {
    throw new Error('signal must be BUY or SELL');
  }

  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {
    throw new Error('entryPrice must be positive');
  }

  if (
    !Number.isFinite(stopLossPercent) ||
    stopLossPercent <= 0
  ) {
    throw new Error('stopLossPercent must be positive');
  }

  if (
    !Number.isFinite(takeProfitPercent) ||
    takeProfitPercent <= 0
  ) {
    throw new Error('takeProfitPercent must be positive');
  }

  const useAtr =
    Number.isFinite(atr) &&
    atr > 0;

  if (useAtr) {
    if (
      !Number.isFinite(atrStopMultiplier) ||
      atrStopMultiplier <= 0
    ) {
      throw new Error(
        'atrStopMultiplier must be positive'
      );
    }

    if (
      !Number.isFinite(atrTakeProfitMultiplier) ||
      atrTakeProfitMultiplier <= 0
    ) {
      throw new Error(
        'atrTakeProfitMultiplier must be positive'
      );
    }
  }

  const stopDistance = useAtr
    ? atr * atrStopMultiplier
    : entryPrice * stopLossPercent;

  const targetDistance = useAtr
    ? atr * atrTakeProfitMultiplier
    : entryPrice * takeProfitPercent;

  if (signal === 'BUY') {
    return {
      stopLoss: entryPrice - stopDistance,
      takeProfit: entryPrice + targetDistance
    };
  }

  return {
    stopLoss: entryPrice + stopDistance,
    takeProfit: entryPrice - targetDistance
  };
}

function simulateTrade({
  candles,
  signal,
  signalIndex,
  stopLossPercent = 0.01,
  takeProfitPercent = 0.02,
  atr = null,
  atrStopMultiplier = 1.5,
  atrTakeProfitMultiplier = 3
}) {
  validateCandles(candles);

  if (!['BUY', 'SELL'].includes(signal)) {
    throw new Error('Only BUY and SELL can be paper traded');
  }

  if (
    !Number.isInteger(signalIndex) ||
    signalIndex < 0 ||
    signalIndex >= candles.length - 1
  ) {
    throw new Error(
      'signalIndex must have a following candle for entry'
    );
  }

  const entryCandle = candles[signalIndex + 1];

  const entryPrice = Number(entryCandle.open);

  const levels = calculateLevels({
    signal,
    entryPrice,
    stopLossPercent,
    takeProfitPercent,
    atr,
    atrStopMultiplier,
    atrTakeProfitMultiplier
  });

  for (
    let i = signalIndex + 1;
    i < candles.length;
    i += 1
  ) {
    const candle = candles[i];

    const high = Number(candle.high);
    const low = Number(candle.low);

    let exitPrice = null;
    let exitReason = null;

    if (signal === 'BUY') {
      const stopHit = low <= levels.stopLoss;
      const targetHit = high >= levels.takeProfit;

      // Conservative rule when both are touched
      // inside the same candle: stop loss wins.
      if (stopHit) {
        exitPrice = levels.stopLoss;
        exitReason = 'STOP_LOSS';
      } else if (targetHit) {
        exitPrice = levels.takeProfit;
        exitReason = 'TAKE_PROFIT';
      }
    }

    if (signal === 'SELL') {
      const stopHit = high >= levels.stopLoss;
      const targetHit = low <= levels.takeProfit;

      // Conservative rule when both are touched
      // inside the same candle: stop loss wins.
      if (stopHit) {
        exitPrice = levels.stopLoss;
        exitReason = 'STOP_LOSS';
      } else if (targetHit) {
        exitPrice = levels.takeProfit;
        exitReason = 'TAKE_PROFIT';
      }
    }

    if (exitPrice !== null) {
      const pnl =
        signal === 'BUY'
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;

      const pnlPercent =
        (pnl / entryPrice) * 100;

      return {
        signal,
        signalIndex,
        entryIndex: signalIndex + 1,
        exitIndex: i,
        entryPrice,
        exitPrice,
        stopLoss: levels.stopLoss,
        takeProfit: levels.takeProfit,
        exitReason,
        pnl,
        pnlPercent,
        result: pnl > 0 ? 'WIN' : 'LOSS',
        entryTime: entryCandle.openTime,
        exitTime: candle.openTime
      };
    }
  }

  return {
    signal,
    signalIndex,
    entryIndex: signalIndex + 1,
    entryPrice,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    exitPrice: null,
    exitReason: 'OPEN',
    pnl: null,
    pnlPercent: null,
    result: 'OPEN',
    entryTime: entryCandle.openTime,
    exitTime: null
  };
}

module.exports = {
  calculateLevels,
  simulateTrade
};
