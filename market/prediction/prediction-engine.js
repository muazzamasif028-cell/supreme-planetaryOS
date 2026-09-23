const {
  calculateIndicators
} = require('../indicators/technical-indicators');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function generatePrediction(candles) {
  if (!Array.isArray(candles) || candles.length < 50) {
    throw new Error(
      'At least 50 candles are required for prediction'
    );
  }

  const indicators = calculateIndicators(candles);

  const {
    price,
    sma20,
    ema9,
    ema21,
    rsi14,
    macd,
    atr14,
    volatility20,
    volumeRatio20,
    momentum10,
    roc10,
    adx14
  } = indicators;

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(sma20) ||
    !Number.isFinite(ema9) ||
    !Number.isFinite(ema21) ||
    !Number.isFinite(rsi14) ||
    !macd
  ) {
    throw new Error(
      'Insufficient indicator data for prediction'
    );
  }

  let score = 0;
  const reasons = [];

  // Trend
  if (price > ema21) {
    score += 2;
    reasons.push('Price is above EMA21');
  } else {
    score -= 2;
    reasons.push('Price is below EMA21');
  }

  if (ema9 > ema21) {
    score += 2;
    reasons.push('EMA9 is above EMA21');
  } else {
    score -= 2;
    reasons.push('EMA9 is below EMA21');
  }

  // ADX trend regime
  let trendStrength = 'UNKNOWN';

  if (Number.isFinite(adx14)) {
    if (adx14 < 20) {
      trendStrength = 'WEAK';
      reasons.push('ADX indicates a weak or sideways market');
    } else if (adx14 < 25) {
      trendStrength = 'DEVELOPING';
      reasons.push('ADX indicates a developing trend');
    } else {
      trendStrength = 'STRONG';
      reasons.push('ADX indicates a strong trend');
    }
  }

  // SMA confirmation
  if (price > sma20) {
    score += 1;
    reasons.push('Price is above SMA20');
  } else {
    score -= 1;
    reasons.push('Price is below SMA20');
  }

  // MACD momentum
  const macdEpsilon = Math.max(
    Math.abs(price) * 0.000001,
    0.000001
  );

  if (macd.histogram > macdEpsilon) {
    score += 2;
    reasons.push('MACD histogram is positively meaningful');
  } else if (macd.histogram < -macdEpsilon) {
    score -= 2;
    reasons.push('MACD histogram is negatively meaningful');
  } else {
    reasons.push('MACD histogram is neutral');
  }

  // Momentum + ROC confirmation
  if (
    Number.isFinite(momentum10) &&
    Number.isFinite(roc10)
  ) {
    if (momentum10 > 0 && roc10 > 0) {
      score += 2;
      reasons.push(
        'Momentum and ROC confirm bullish direction'
      );
    } else if (momentum10 < 0 && roc10 < 0) {
      score -= 2;
      reasons.push(
        'Momentum and ROC confirm bearish direction'
      );
    } else {
      reasons.push(
        'Momentum and ROC give mixed direction'
      );
    }
  } else {
    reasons.push(
      'Momentum and ROC are unavailable'
    );
  }

  // RSI
  if (rsi14 >= 50 && rsi14 < 70) {
    score += 1;
    reasons.push('RSI supports bullish momentum');
  } else if (rsi14 > 30 && rsi14 < 50) {
    score -= 1;
    reasons.push('RSI supports bearish momentum');
  } else if (rsi14 >= 70) {
    reasons.push('RSI is overbought');
  } else if (rsi14 <= 30) {
    reasons.push('RSI is oversold');
  }

  // Volume confirmation
  if (Number.isFinite(volumeRatio20)) {
    if (volumeRatio20 >= 1.2) {
      if (score > 0) {
        score += 1;
        reasons.push('Volume confirms the current direction');
      } else if (score < 0) {
        score -= 1;
        reasons.push('Volume confirms the current direction');
      }
    } else {
      reasons.push('Volume confirmation is weak');
    }
  }

  const atrRatio =
    Number.isFinite(atr14) && price > 0
      ? atr14 / price
      : null;

  let volatilityState = 'UNKNOWN';

  if (Number.isFinite(atrRatio)) {
    if (atrRatio < 0.0005) {
      volatilityState = 'LOW';
      reasons.push('ATR indicates unusually low volatility');
    } else {
      volatilityState = 'NORMAL';
      reasons.push('ATR indicates normal price movement');
    }
  }

  let signal = 'HOLD';

  const bullishAlignment =
    price > ema21 &&
    ema9 > ema21 &&
    momentum10 > 0 &&
    roc10 > 0 &&
    macd.histogram > macdEpsilon;

  const bearishAlignment =
    price < ema21 &&
    ema9 < ema21 &&
    momentum10 < 0 &&
    roc10 < 0 &&
    macd.histogram < -macdEpsilon;

  if (trendStrength === 'WEAK') {
    score = 0;
    reasons.push(
      'Signal suppressed because trend strength is weak'
    );
  } else if (bullishAlignment && score >= 4) {
    signal = 'BUY';
    reasons.push(
      'Bullish indicators are directionally aligned'
    );
  } else if (bearishAlignment && score <= -4) {
    signal = 'SELL';
    reasons.push(
      'Bearish indicators are directionally aligned'
    );
  } else if (score >= 4 || score <= -4) {
    reasons.push(
      'Signal held because directional indicators are mixed'
    );
  }

  const maxScore = 11;

  const confidence = clamp(
    50 + (Math.abs(score) / maxScore) * 45,
    50,
    95
  );

  return {
    signal,
    score,
    confidence: Number(confidence.toFixed(2)),
    price,
    indicators,
    trendStrength,
    volatilityState,
    reasons,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  generatePrediction
};
