function validateCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 10) {
    throw new Error('At least 10 candles are required');
  }

  for (const candle of candles) {
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    if (
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      high < low
    ) {
      throw new Error('Invalid candle data');
    }
  }
}

function findSwingHigh(candles, index, left, right) {
  const high = Number(candles[index].high);

  for (
    let i = index - left;
    i <= index + right;
    i += 1
  ) {
    if (i === index) continue;

    if (Number(candles[i].high) >= high) {
      return false;
    }
  }

  return true;
}

function findSwingLow(candles, index, left, right) {
  const low = Number(candles[index].low);

  for (
    let i = index - left;
    i <= index + right;
    i += 1
  ) {
    if (i === index) continue;

    if (Number(candles[i].low) <= low) {
      return false;
    }
  }

  return true;
}

function clusterLevels(levels, tolerancePercent = 0.0015) {
  if (!Array.isArray(levels)) {
    return [];
  }

  const sorted = [...levels].sort(
    (a, b) => a.price - b.price
  );

  const zones = [];

  for (const level of sorted) {
    const last = zones[zones.length - 1];

    if (!last) {
      zones.push({
        price: level.price,
        touches: 1,
        type: level.type,
        sourceIndexes: [level.index]
      });
      continue;
    }

    const tolerance =
      last.price * tolerancePercent;

    if (
      Math.abs(level.price - last.price) <=
      tolerance
    ) {
      const totalTouches =
        last.touches + 1;

      last.price =
        ((last.price * last.touches) +
          level.price) /
        totalTouches;

      last.touches = totalTouches;
      last.sourceIndexes.push(level.index);
    } else {
      zones.push({
        price: level.price,
        touches: 1,
        type: level.type,
        sourceIndexes: [level.index]
      });
    }
  }

  return zones;
}

function detectSupportResistance(
  candles,
  options = {}
) {
  validateCandles(candles);

  const {
    swingLeft = 2,
    swingRight = 2,
    lookback = 100,
    tolerancePercent = 0.0015
  } = options;

  if (
    !Number.isInteger(swingLeft) ||
    swingLeft < 1 ||
    !Number.isInteger(swingRight) ||
    swingRight < 1
  ) {
    throw new Error(
      'swingLeft and swingRight must be positive integers'
    );
  }

  const recent =
    candles.slice(-lookback);

  const levels = [];

  for (
    let i = swingLeft;
    i < recent.length - swingRight;
    i += 1
  ) {
    if (
      findSwingHigh(
        recent,
        i,
        swingLeft,
        swingRight
      )
    ) {
      levels.push({
        price: Number(recent[i].high),
        type: 'RESISTANCE',
        index: i
      });
    }

    if (
      findSwingLow(
        recent,
        i,
        swingLeft,
        swingRight
      )
    ) {
      levels.push({
        price: Number(recent[i].low),
        type: 'SUPPORT',
        index: i
      });
    }
  }

  const supportLevels =
    clusterLevels(
      levels.filter(
        (level) =>
          level.type === 'SUPPORT'
      ),
      tolerancePercent
    );

  const resistanceLevels =
    clusterLevels(
      levels.filter(
        (level) =>
          level.type === 'RESISTANCE'
      ),
      tolerancePercent
    );

  const currentPrice =
    Number(
      recent[recent.length - 1].close
    );

  const supportsBelow =
    supportLevels
      .filter(
        (level) =>
          level.price <= currentPrice
      )
      .sort(
        (a, b) =>
          b.price - a.price
      );

  const resistancesAbove =
    resistanceLevels
      .filter(
        (level) =>
          level.price >= currentPrice
      )
      .sort(
        (a, b) =>
          a.price - b.price
      );

  return {
    currentPrice,
    supportLevels,
    resistanceLevels,
    nearestSupport:
      supportsBelow[0] || null,
    nearestResistance:
      resistancesAbove[0] || null
  };
}

module.exports = {
  detectSupportResistance,
  clusterLevels
};
