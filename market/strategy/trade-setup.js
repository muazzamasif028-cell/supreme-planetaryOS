const {
  detectSupportResistance
} = require('./support-resistance');

const {
  detectPriceAction
} = require('./price-action');

const SYMBOL = 'XAU/USD';

function validateSymbol(symbol) {
  const normalized =
    String(symbol || '').trim().toUpperCase();

  if (normalized !== SYMBOL) {
    throw new Error('Only XAU/USD is supported');
  }

  return SYMBOL;
}

function getDistancePercent(price, level) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(level) ||
    price <= 0
  ) {
    return null;
  }

  return Math.abs(price - level) / price;
}

function detectTradeSetup(
  candles,
  options = {}
) {
  const symbol =
    validateSymbol(options.symbol || SYMBOL);

  const {
    zoneDistancePercent = 0.0015,
    minimumTouches = 2
  } = options;

  if (
    !Number.isFinite(zoneDistancePercent) ||
    zoneDistancePercent <= 0
  ) {
    throw new Error(
      'zoneDistancePercent must be positive'
    );
  }

  const supportResistance =
    detectSupportResistance(
      candles,
      options.supportResistance
    );

  const priceAction =
    detectPriceAction(candles);

  const price =
    supportResistance.currentPrice;

  const support =
    supportResistance.nearestSupport;

  const resistance =
    supportResistance.nearestResistance;

  const supportDistance =
    support
      ? getDistancePercent(
          price,
          support.price
        )
      : null;

  const resistanceDistance =
    resistance
      ? getDistancePercent(
          price,
          resistance.price
        )
      : null;

  const nearSupport =
    Number.isFinite(supportDistance) &&
    supportDistance <= zoneDistancePercent;

  const nearResistance =
    Number.isFinite(resistanceDistance) &&
    resistanceDistance <= zoneDistancePercent;

  const validSupport =
    nearSupport &&
    !nearResistance &&
    support &&
    support.touches >= minimumTouches;

  const validResistance =
    nearResistance &&
    !nearSupport &&
    resistance &&
    resistance.touches >= minimumTouches;

  let signal = 'HOLD';
  let reason =
    'No confirmed support/resistance price-action setup';

  if (
    validSupport &&
    priceAction.bullish
  ) {
    signal = 'BUY';
    reason =
      'Confirmed support with bullish price action';
  } else if (
    validResistance &&
    priceAction.bearish
  ) {
    signal = 'SELL';
    reason =
      'Confirmed resistance with bearish price action';
  } else if (
    nearSupport &&
    nearResistance
  ) {
    reason =
      'Support and resistance are both too close; setup rejected';
  } else if (
    nearSupport &&
    !validSupport
  ) {
    reason =
      'Support is present but zone strength is insufficient';
  } else if (
    nearResistance &&
    !validResistance
  ) {
    reason =
      'Resistance is present but zone strength is insufficient';
  } else if (
    nearSupport &&
    priceAction.bearish
  ) {
    reason =
      'Support found but price action is bearish';
  } else if (
    nearResistance &&
    priceAction.bullish
  ) {
    reason =
      'Resistance found but price action is bullish';
  } else {
    reason =
      'Price is not at a confirmed trade location';
  }

  return {
    symbol,
    signal,
    reason,
    price,
    nearSupport,
    nearResistance,
    support,
    resistance,
    supportDistance,
    resistanceDistance,
    priceAction,
    supportResistance
  };
}

module.exports = {
  SYMBOL,
  validateSymbol,
  getDistancePercent,
  detectTradeSetup
};
