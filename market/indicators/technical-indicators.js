function toNumbers(values) {
  if (!Array.isArray(values)) {
    throw new TypeError('values must be an array');
  }

  const numbers = values.map(Number);

  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error('values must contain only finite numbers');
  }

  return numbers;
}

function sma(values, period) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length < period) {
    return null;
  }

  const slice = numbers.slice(-period);

  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values, period) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);

  let current =
    numbers
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < numbers.length; i += 1) {
    current =
      (numbers[i] - current) * multiplier + current;
  }

  return current;
}

function rsi(values, period = 14) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = numbers[i] - numbers[i - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < numbers.length; i += 1) {
    const change = numbers[i] - numbers[i - 1];

    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain =
      ((averageGain * (period - 1)) + gain) / period;

    averageLoss =
      ((averageLoss * (period - 1)) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;

  return 100 - (100 / (1 + relativeStrength));
}

function macd(
  values,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const numbers = toNumbers(values);

  if (
    numbers.length < slowPeriod + signalPeriod
  ) {
    return null;
  }

  const multiplierFast = 2 / (fastPeriod + 1);
  const multiplierSlow = 2 / (slowPeriod + 1);

  let fastEma =
    numbers
      .slice(0, fastPeriod)
      .reduce((sum, value) => sum + value, 0) /
    fastPeriod;

  let slowEma =
    numbers
      .slice(0, slowPeriod)
      .reduce((sum, value) => sum + value, 0) /
    slowPeriod;

  const macdValues = [];

  for (let i = fastPeriod; i < slowPeriod; i += 1) {
    fastEma =
      (numbers[i] - fastEma) * multiplierFast + fastEma;
  }

  for (let i = slowPeriod; i < numbers.length; i += 1) {
    fastEma =
      (numbers[i] - fastEma) * multiplierFast + fastEma;

    slowEma =
      (numbers[i] - slowEma) * multiplierSlow + slowEma;

    macdValues.push(fastEma - slowEma);
  }

  if (macdValues.length < signalPeriod) {
    return null;
  }

  const signal = ema(macdValues, signalPeriod);
  const macdLine = macdValues[macdValues.length - 1];

  return {
    macd: macdLine,
    signal,
    histogram: macdLine - signal
  };
}


function atr(candles, period = 14) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (candles.length < period + 1) {
    return null;
  }

  const trueRanges = [];

  for (let i = 1; i < candles.length; i += 1) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const previousClose = Number(candles[i - 1].close);

    if (
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(previousClose)
    ) {
      throw new Error('Invalid candle values for ATR');
    }

    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      )
    );
  }

  let current =
    trueRanges
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) /
    period;

  for (let i = period; i < trueRanges.length; i += 1) {
    current =
      ((current * (period - 1)) + trueRanges[i]) /
      period;
  }

  return current;
}

function volatility(candles, period = 20) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (candles.length < period) {
    return null;
  }

  const recent = candles.slice(-period);

  const returns = [];

  for (let i = 1; i < recent.length; i += 1) {
    const previousClose = Number(recent[i - 1].close);
    const currentClose = Number(recent[i].close);

    if (
      !Number.isFinite(previousClose) ||
      !Number.isFinite(currentClose) ||
      previousClose <= 0
    ) {
      throw new Error('Invalid candle close value');
    }

    returns.push((currentClose - previousClose) / previousClose);
  }

  const mean =
    returns.reduce((sum, value) => sum + value, 0) /
    returns.length;

  const variance =
    returns.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / returns.length;

  return Math.sqrt(variance);
}


function momentum(values, period = 10) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length <= period) {
    return null;
  }

  const current = numbers[numbers.length - 1];
  const previous = numbers[numbers.length - 1 - period];

  return current - previous;
}

function roc(values, period = 10) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length <= period) {
    return null;
  }

  const current = numbers[numbers.length - 1];
  const previous = numbers[numbers.length - 1 - period];

  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function volumeRatio(candles, period = 20) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (candles.length < period + 1) {
    return null;
  }

  const currentVolume = Number(
    candles[candles.length - 1].volume
  );

  const previous = candles
    .slice(-(period + 1), -1)
    .map((candle) => Number(candle.volume));

  if (
    !Number.isFinite(currentVolume) ||
    previous.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Invalid candle volume value');
  }

  const averageVolume =
    previous.reduce((sum, value) => sum + value, 0) /
    previous.length;

  if (averageVolume === 0) {
    return null;
  }

  return currentVolume / averageVolume;
}


function adx(candles, period = 14) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (candles.length < (period * 2) + 1) {
    return null;
  }

  const trueRanges = [];
  const plusDirectionalMovement = [];
  const minusDirectionalMovement = [];

  for (let i = 1; i < candles.length; i += 1) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const previousHigh = Number(candles[i - 1].high);
    const previousLow = Number(candles[i - 1].low);
    const previousClose = Number(candles[i - 1].close);

    if (
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(previousHigh) ||
      !Number.isFinite(previousLow) ||
      !Number.isFinite(previousClose)
    ) {
      throw new Error('Invalid candle values for ADX');
    }

    const trueRange = Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    );

    const upMove = high - previousHigh;
    const downMove = previousLow - low;

    const plusDm =
      upMove > downMove && upMove > 0
        ? upMove
        : 0;

    const minusDm =
      downMove > upMove && downMove > 0
        ? downMove
        : 0;

    trueRanges.push(trueRange);
    plusDirectionalMovement.push(plusDm);
    minusDirectionalMovement.push(minusDm);
  }

  if (trueRanges.length < period * 2) {
    return null;
  }

  let smoothedTrueRange =
    trueRanges
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0);

  let smoothedPlusDm =
    plusDirectionalMovement
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0);

  let smoothedMinusDm =
    minusDirectionalMovement
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0);

  const dxValues = [];

  for (let i = period; i < trueRanges.length; i += 1) {
    smoothedTrueRange =
      smoothedTrueRange -
      (smoothedTrueRange / period) +
      trueRanges[i];

    smoothedPlusDm =
      smoothedPlusDm -
      (smoothedPlusDm / period) +
      plusDirectionalMovement[i];

    smoothedMinusDm =
      smoothedMinusDm -
      (smoothedMinusDm / period) +
      minusDirectionalMovement[i];

    if (smoothedTrueRange <= 0) {
      continue;
    }

    const plusDi =
      (smoothedPlusDm / smoothedTrueRange) * 100;

    const minusDi =
      (smoothedMinusDm / smoothedTrueRange) * 100;

    const denominator = plusDi + minusDi;

    if (denominator === 0) {
      dxValues.push(0);
      continue;
    }

    dxValues.push(
      (Math.abs(plusDi - minusDi) / denominator) * 100
    );
  }

  if (dxValues.length < period) {
    return null;
  }

  let adxValue =
    dxValues
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) /
    period;

  for (let i = period; i < dxValues.length; i += 1) {
    adxValue =
      ((adxValue * (period - 1)) + dxValues[i]) /
      period;
  }

  return adxValue;
}

function calculateIndicators(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error('candles must be a non-empty array');
  }

  const closes = candles.map((candle) => Number(candle.close));

  return {
    price: closes[closes.length - 1],
    sma20: sma(closes, 20),
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    atr14: atr(candles, 14),
    volatility20: volatility(candles, 20),
    volumeRatio20: volumeRatio(candles, 20),
    momentum10: momentum(closes, 10),
    roc10: roc(closes, 10),
    adx14: adx(candles, 14)
  };
}

module.exports = {
  sma,
  ema,
  rsi,
  macd,
  atr,
  volatility,
  volumeRatio,
  momentum,
  roc,
  adx,
  calculateIndicators
};
