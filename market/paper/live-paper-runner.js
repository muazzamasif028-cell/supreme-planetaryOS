require('dotenv').config();

const {
  LivePaperEngine
} = require('./live-paper-engine');

const MAX_TRADES = 10;
const POLL_MS = 30000;

async function runSession() {
  const engine = new LivePaperEngine({
    pollMs: POLL_MS,
    maxHistory: 100,
    atrStopMultiplier: 2,
    atrTakeProfitMultiplier: 3
  });

  console.log('======================================');
  console.log(' REAL-TIME XAU/USD PAPER SESSION');
  console.log('======================================');
  console.log(`Maximum closed trades: ${MAX_TRADES}`);
  console.log(`Polling interval: ${POLL_MS} ms`);
  console.log('ATR Stop: 2x');
  console.log('ATR Target: 3x');
  console.log('Real-money execution: DISABLED');
  console.log('');

  let timer = null;

  const runCycle = async () => {
    try {
      const result = await engine.tick();
      const state = engine.getState();

      console.log('\n--- REAL-TIME CYCLE ---');
      console.log('Status:', result.status);
      console.log(
        'Time:',
        result.timestamp ||
        result.candleTime ||
        'N/A'
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
        Array.isArray(
          result.priceActionPatterns
        ) &&
        result.priceActionPatterns.length
      ) {
        console.log(
          'Price Action:',
          result.priceActionPatterns.join(', ')
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
          result.position.takeProfit,
          '| ATR:',
          result.position.atr
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
        console.log(
          'Unrealized P&L %:',
          result.unrealizedPnlPercent
        );
      }

      if (result.trade) {
        console.log(
          'TRADE CLOSED:',
          result.trade.result
        );
        console.log(
          'Exit reason:',
          result.trade.exitReason
        );
        console.log(
          'Entry:',
          result.trade.entryPrice
        );
        console.log(
          'Exit:',
          result.trade.exitPrice
        );
        console.log(
          'Realized P&L:',
          result.trade.pnl
        );
        console.log(
          'Realized P&L %:',
          result.trade.pnlPercent
        );
      }

      if (result.transaction) {
        console.log(
          'TRANSACTION:',
          result.transaction.transactionId,
          '|',
          result.transaction.type
        );
      }

      console.log(
        'Closed trades:',
        state.stats.totalTrades,
        '/',
        MAX_TRADES,
        '| Wins:',
        state.stats.wins,
        '| Losses:',
        state.stats.losses,
        '| Realized P&L:',
        state.stats.netPnl
      );

      if (
        state.stats.totalTrades >= MAX_TRADES
      ) {
        console.log(
          '\n======================================'
        );
        console.log(
          ' 10 CLOSED PAPER TRADES REACHED'
        );
        console.log(
          ' SESSION STOPPED'
        );
        console.log(
          '======================================'
        );

        console.table(
          state.stats
        );

        clearInterval(timer);
        timer = null;
      }

    } catch (error) {
      console.error(
        '\n[LIVE SESSION ERROR]',
        error.stack || error.message
      );
    }
  };

  await runCycle();

  if (
    engine.getState().stats.totalTrades >=
    MAX_TRADES
  ) {
    return;
  }

  timer = setInterval(
    runCycle,
    POLL_MS
  );

  process.on('SIGINT', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    console.log(
      '\n======================================'
    );
    console.log(
      ' SESSION INTERRUPTED'
    );
    console.log(
      '======================================'
    );

    console.log('\n=== FINAL STATS ===');
    console.table(
      engine.getState().stats
    );

    console.log('\n=== TRANSACTIONS ===');
    console.table(
      engine.getState().transactions
    );

    process.exit(0);
  });
}

runSession().catch((error) => {
  console.error(
    'SESSION ERROR:',
    error.stack || error.message
  );
  process.exitCode = 1;
});
