const {
  getCandles,
  getTicker
} = require('../data/market-data.service');

const {
  detectTradeSetup
} = require('../strategy/trade-setup');

const {
  calculateIndicators
} = require('../indicators/technical-indicators');

const SYMBOL = 'XAU/USD';
const INTERVAL = '5min';

class LivePaperEngine {
  constructor({
    pollMs = 30000,
    maxHistory = 100,
    atrStopMultiplier = 2,
    atrTakeProfitMultiplier = 3
  } = {}) {
    this.pollMs = pollMs;
    this.maxHistory = maxHistory;
    this.atrStopMultiplier = atrStopMultiplier;
    this.atrTakeProfitMultiplier =
      atrTakeProfitMultiplier;

    this.timer = null;
    this.lastCandleTime = null;

    this.position = null;

    this.trades = [];
    this.transactions = [];

    this.stats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      netPnl: 0
    };
  }

  calculateLevels(signal, entryPrice, atr) {
    if (
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(atr) ||
      entryPrice <= 0 ||
      atr <= 0
    ) {
      throw new Error('Invalid entry price or ATR');
    }

    const stopDistance =
      atr * this.atrStopMultiplier;

    const targetDistance =
      atr * this.atrTakeProfitMultiplier;

    if (signal === 'BUY') {
      return {
        stopLoss: entryPrice - stopDistance,
        takeProfit: entryPrice + targetDistance
      };
    }

    if (signal === 'SELL') {
      return {
        stopLoss: entryPrice + stopDistance,
        takeProfit: entryPrice - targetDistance
      };
    }

    throw new Error(`Unsupported signal: ${signal}`);
  }

  calculatePnl(
    signal,
    entryPrice,
    exitPrice
  ) {
    return signal === 'BUY'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
  }

  calculateUnrealizedPnl(price) {
    if (!this.position) {
      return 0;
    }

    return this.calculatePnl(
      this.position.signal,
      this.position.entryPrice,
      price
    );
  }

  calculateUnrealizedPnlPercent(price) {
    if (!this.position) {
      return 0;
    }

    const pnl =
      this.calculateUnrealizedPnl(price);

    return (
      pnl /
      this.position.entryPrice
    ) * 100;
  }

  recordTransaction(type, payload = {}) {
    const transaction = {
      transactionId:
        this.transactions.length + 1,
      type,
      timestamp:
        new Date().toISOString(),
      symbol: SYMBOL,
      ...payload
    };

    this.transactions.push(transaction);

    return transaction;
  }

  openPosition(
    signal,
    entryPrice,
    candleTime,
    prediction,
    atr,
    setup
  ) {
    const levels =
      this.calculateLevels(
        signal,
        entryPrice,
        atr
      );

    this.position = {
      symbol: SYMBOL,
      interval: INTERVAL,
      signal,
      entryPrice,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      atr,
      atrStopMultiplier:
        this.atrStopMultiplier,
      atrTakeProfitMultiplier:
        this.atrTakeProfitMultiplier,
      entryTime: candleTime,

      predictionScore:
        prediction?.score ?? null,

      predictionConfidence:
        prediction?.confidence ?? null,

      setupReason:
        setup?.reason ?? null,

      priceActionPatterns:
        setup?.priceAction?.patterns ?? [],

      support:
        setup?.support?.price ?? null,

      resistance:
        setup?.resistance?.price ?? null
    };

    this.recordTransaction(
      'OPEN',
      {
        signal,
        entryPrice,
        stopLoss: levels.stopLoss,
        takeProfit: levels.takeProfit,
        atr,
        entryTime: candleTime,
        setupReason:
          setup?.reason ?? null,
        priceActionPatterns:
          setup?.priceAction?.patterns ?? []
      }
    );

    return this.position;
  }

  closePosition(
    exitPrice,
    exitReason,
    exitTime
  ) {
    if (!this.position) {
      return null;
    }

    const pnl =
      this.calculatePnl(
        this.position.signal,
        this.position.entryPrice,
        exitPrice
      );

    const trade = {
      ...this.position,
      exitPrice,
      exitReason,
      exitTime,
      pnl,
      pnlPercent:
        (
          pnl /
          this.position.entryPrice
        ) * 100,
      result:
        pnl > 0 ? 'WIN' : 'LOSS'
    };

    this.trades.push(trade);

    this.stats.totalTrades += 1;

    if (trade.result === 'WIN') {
      this.stats.wins += 1;
    } else {
      this.stats.losses += 1;
    }

    this.stats.netPnl += pnl;

    this.recordTransaction(
      'CLOSE',
      {
        signal: trade.signal,
        entryPrice: trade.entryPrice,
        exitPrice,
        exitReason,
        pnl,
        pnlPercent: trade.pnlPercent,
        result: trade.result,
        entryTime: trade.entryTime,
        exitTime
      }
    );

    this.position = null;

    return trade;
  }

  evaluatePrice(
    price,
    timestamp
  ) {
    if (!this.position) {
      return null;
    }

    const {
      signal,
      stopLoss,
      takeProfit
    } = this.position;

    if (
      signal === 'BUY' &&
      price <= stopLoss
    ) {
      return this.closePosition(
        stopLoss,
        'STOP_LOSS',
        timestamp
      );
    }

    if (
      signal === 'BUY' &&
      price >= takeProfit
    ) {
      return this.closePosition(
        takeProfit,
        'TAKE_PROFIT',
        timestamp
      );
    }

    if (
      signal === 'SELL' &&
      price >= stopLoss
    ) {
      return this.closePosition(
        stopLoss,
        'STOP_LOSS',
        timestamp
      );
    }

    if (
      signal === 'SELL' &&
      price <= takeProfit
    ) {
      return this.closePosition(
        takeProfit,
        'TAKE_PROFIT',
        timestamp
      );
    }

    return null;
  }

  async monitorPrice() {
    const ticker =
      await getTicker(SYMBOL);

    if (
      !ticker ||
      !Number.isFinite(
        Number(ticker.price)
      )
    ) {
      throw new Error(
        'Invalid XAU/USD ticker price'
      );
    }

    const price =
      Number(ticker.price);

    const timestamp =
      new Date().toISOString();

    const closedTrade =
      this.evaluatePrice(
        price,
        timestamp
      );

    const unrealizedPnl =
      this.calculateUnrealizedPnl(
        price
      );

    const unrealizedPnlPercent =
      this.calculateUnrealizedPnlPercent(
        price
      );

    return {
      symbol: SYMBOL,
      price,
      timestamp,

      status: closedTrade
        ? 'TRADE_CLOSED'
        : this.position
          ? 'POSITION_OPEN'
          : 'NO_POSITION',

      transaction:
        closedTrade
          ? this.transactions[
              this.transactions.length - 1
            ]
          : null,

      trade: closedTrade,

      position: this.position,

      unrealizedPnl,
      unrealizedPnlPercent,

      stats: {
        ...this.stats
      }
    };
  }

  async tick() {
    const candles = await getCandles({
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: this.maxHistory
    });

    if (!Array.isArray(candles) || candles.length < 60) {
      throw new Error(
        'At least 60 XAU/USD candles are required'
      );
    }

    const latest = candles[candles.length - 1];

    if (!latest) {
      throw new Error('No XAU/USD candle received');
    }

    // Live ticker: manage open position and calculate
    // real-time unrealized P&L.
    const tickerResult = await this.monitorPrice();

    // Do not generate another signal on the same
    // 5-minute candle.
    if (latest.openTime === this.lastCandleTime) {
      return {
        ...tickerResult,
        status:
          tickerResult.status === 'TRADE_CLOSED'
            ? 'TRADE_CLOSED'
            : this.position
              ? 'POSITION_OPEN'
              : 'NO_NEW_CANDLE',
        interval: INTERVAL,
        candleTime: latest.openTime
      };
    }

    this.lastCandleTime = latest.openTime;

    // Never open a second position while one is active.
    if (this.position) {
      return {
        ...tickerResult,
        status:
          tickerResult.status === 'TRADE_CLOSED'
            ? 'TRADE_CLOSED'
            : 'POSITION_OPEN',
        interval: INTERVAL,
        candleTime: latest.openTime
      };
    }

    // The latest candle may still be forming.
    // Use ONLY the previous completed candle for signals.
    const completedCandles = candles.slice(0, -1);

    if (completedCandles.length < 60) {
      return {
        ...tickerResult,
        status: 'NO_SIGNAL',
        interval: INTERVAL,
        candleTime: latest.openTime,
        reason: 'Insufficient completed candle history'
      };
    }

    const completedCandle =
      completedCandles[completedCandles.length - 1];

    const setup = detectTradeSetup(
      completedCandles,
      {
        symbol: SYMBOL
      }
    );

    if (!['BUY', 'SELL'].includes(setup.signal)) {
      return {
        ...tickerResult,
        status: 'NO_SIGNAL',
        interval: INTERVAL,
        candleTime: latest.openTime,
        signalCandleTime: completedCandle.openTime,
        price: tickerResult.price,
        setupReason: setup.reason,
        priceActionPatterns:
          setup.priceAction.patterns,
        setup
      };
    }

    const indicators =
      calculateIndicators(completedCandles);

    const atr14 = indicators.atr14;

    if (
      !Number.isFinite(atr14) ||
      atr14 <= 0
    ) {
      return {
        ...tickerResult,
        status: 'NO_SIGNAL',
        interval: INTERVAL,
        candleTime: latest.openTime,
        signalCandleTime: completedCandle.openTime,
        price: tickerResult.price,
        reason: 'ATR unavailable'
      };
    }

    // Execute PAPER entry using the current live ticker price.
    const liveEntryPrice = Number(tickerResult.price);

    if (
      !Number.isFinite(liveEntryPrice) ||
      liveEntryPrice <= 0
    ) {
      throw new Error(
        'Invalid live XAU/USD entry price'
      );
    }

    const position = this.openPosition(
      setup.signal,
      liveEntryPrice,
      new Date().toISOString(),
      null,
      atr14,
      setup
    );

    return {
      ...tickerResult,
      status: 'POSITION_OPENED',
      interval: INTERVAL,
      candleTime: latest.openTime,
      signalCandleTime: completedCandle.openTime,
      signal: setup.signal,
      setupReason: setup.reason,
      priceActionPatterns:
        setup.priceAction.patterns,
      price: liveEntryPrice,
      position,
      stats: {
        ...this.stats
      }
    };
  }

  start() {
    if (this.timer) {
      return;
    }

    console.log(
      '======================================'
    );
    console.log(
      ' LIVE XAU/USD PAPER SESSION'
    );
    console.log(
      '======================================'
    );
    console.log(
      `Maximum closed trades: 10`
    );
    console.log(
      `Polling interval: ${this.pollMs} ms`
    );
    console.log(
      'Real-money execution: DISABLED'
    );
    console.log(
      `ATR stop: ${this.atrStopMultiplier}x`
    );
    console.log(
      `ATR target: ${this.atrTakeProfitMultiplier}x`
    );
    console.log('');

    const runTick = async () => {
      if (
        this.stats.totalTrades >= 10
      ) {
        console.log(
          '\n=== 10 CLOSED TRADES REACHED ==='
        );
        console.table([
          {
            trades:
              this.stats.totalTrades,
            wins:
              this.stats.wins,
            losses:
              this.stats.losses,
            netPnl:
              this.stats.netPnl
          }
        ]);

        this.stop();
        return;
      }

      try {
        const result =
          await this.tick();

        console.log('\n--- CYCLE ---');
        console.log(
          'Status:',
          result.status
        );
        console.log(
          'Time:',
          result.timestamp ??
          result.candleTime
        );
        console.log(
          'Price:',
          result.price
        );

        if (result.signal) {
          console.log(
            'Signal:',
            result.signal
          );
        }

        if (result.setupReason) {
          console.log(
            'Reason:',
            result.setupReason
          );
        }

        if (
          result.priceActionPatterns
            ?.length
        ) {
          console.log(
            'Price Action:',
            result.priceActionPatterns.join(
              ', '
            )
          );
        }

        if (result.position) {
          console.log(
            'Position:',
            result.position.signal,
            '| Entry:',
            result.position.entryPrice,
            '| SL:',
            result.position.stopLoss,
            '| TP:',
            result.position.takeProfit
          );
        }

        if (
          Number.isFinite(
            result.unrealizedPnl
          )
        ) {
          console.log(
            'Unrealized P&L:',
            result.unrealizedPnl
          );
        }

        if (result.trade) {
          console.log(
            'CLOSED:',
            result.trade.result,
            '| Reason:',
            result.trade.exitReason,
            '| Realized P&L:',
            result.trade.pnl
          );
        }

        console.log(
          'Daily trades:',
          result.stats.totalTrades,
          '| Wins:',
          result.stats.wins,
          '| Losses:',
          result.stats.losses,
          '| Realized P&L:',
          result.stats.netPnl
        );

      } catch (error) {
        console.error(
          '[LIVE PAPER ERROR]',
          error.stack ||
          error.message
        );
      }
    };

    runTick();

    this.timer =
      setInterval(
        runTick,
        this.pollMs
      );
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;

    console.log(
      '\n[LIVE PAPER] Monitor stopped.'
    );
  }

  getState() {
    return {
      symbol: SYMBOL,
      interval: INTERVAL,
      position: this.position,
      trades: [...this.trades],
      transactions: [
        ...this.transactions
      ],
      stats: {
        ...this.stats
      }
    };
  }
}

module.exports = {
  LivePaperEngine,
  SYMBOL,
  INTERVAL
};
