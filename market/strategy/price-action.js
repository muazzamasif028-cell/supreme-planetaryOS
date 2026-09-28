function candleDirection(candle) {
  const open = Number(candle.open);
  const close = Number(candle.close);

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  if (close > open) return 'BULLISH';
  if (close < open) return 'BEARISH';

  return 'NEUTRAL';
}

function candleParts(candle) {
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    high < low ||
    low > Math.min(open, close) ||
    high < Math.max(open, close)
  ) {
    throw new Error('Invalid candle data');
  }

  const body = Math.abs(close - open);
  const upperWick = high - Math.max(open, close);
  const lowerWick = Math.min(open, close) - low;
  const range = high - low;

  return {
    open,
    high,
    low,
    close,
    body,
    upperWick,
    lowerWick,
    range,
    direction: candleDirection(candle)
  };
}

function isBullishEngulfing(previous, current) {
  const first = candleParts(previous);
  const second = candleParts(current);

  return (
    first.direction === 'BEARISH' &&
    second.direction === 'BULLISH' &&
    second.open <= first.close &&
    second.close >= first.open &&
    second.body >= first.body
  );
}

function isBearishEngulfing(previous, current) {
  const first = candleParts(previous);
  const second = candleParts(current);

  return (
    first.direction === 'BULLISH' &&
    second.direction === 'BEARISH' &&
    second.open >= first.close &&
    second.close <= first.open &&
    second.body >= first.body
  );
}

function isBullishRejection(candle, wickRatio = 1.5) {
  const parts = candleParts(candle);

  if (
    parts.range <= 0 ||
    parts.body <= 0
  ) {
    return false;
  }

  return (
    parts.direction === 'BULLISH' &&
    parts.lowerWick >= parts.body * wickRatio
  );
}

function isBearishRejection(candle, wickRatio = 1.5) {
  const parts = candleParts(candle);

  if (
    parts.range <= 0 ||
    parts.body <= 0
  ) {
    return false;
  }

  return (
    parts.direction === 'BEARISH' &&
    parts.upperWick >= parts.body * wickRatio
  );
}

function detectPriceAction(candles) {
  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error(
      'At least 2 candles are required'
    );
  }

  const current =
    candles[candles.length - 1];

  const previous =
    candles[candles.length - 2];

  const currentParts =
    candleParts(current);

  const previousParts =
    candleParts(previous);

  const patterns = [];

  if (
    isBullishEngulfing(
      previous,
      current
    )
  ) {
    patterns.push('BULLISH_ENGULFING');
  }

  if (
    isBearishEngulfing(
      previous,
      current
    )
  ) {
    patterns.push('BEARISH_ENGULFING');
  }

  if (
    isBullishRejection(current)
  ) {
    patterns.push('BULLISH_REJECTION');
  }

  if (
    isBearishRejection(current)
  ) {
    patterns.push('BEARISH_REJECTION');
  }

  return {
    direction: currentParts.direction,
    patterns,
    bullish:
      patterns.includes(
        'BULLISH_ENGULFING'
      ) ||
      patterns.includes(
        'BULLISH_REJECTION'
      ),
    bearish:
      patterns.includes(
        'BEARISH_ENGULFING'
      ) ||
      patterns.includes(
        'BEARISH_REJECTION'
      ),
    current: currentParts,
    previous: previousParts
  };
}

module.exports = {
  candleDirection,
  candleParts,
  isBullishEngulfing,
  isBearishEngulfing,
  isBullishRejection,
  isBearishRejection,
  detectPriceAction
};
