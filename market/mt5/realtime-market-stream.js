require('dotenv').config();

const {
  connectMetaApi,
  SYMBOL
} = require('./metaapi-client');

const BRIDGE_URL =
  'http://127.0.0.1:8787/mt5/decision';

const TIMEFRAME = 'M5';
const MIN_BARS = 60;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeQuote(price) {
  if (!price) return null;

  return {
    time:
      price.time instanceof Date
        ? price.time.toISOString()
        : String(price.time || ''),
    bid: toNumber(price.bid),
    ask: toNumber(price.ask)
  };
}

async function requestDecision(payload) {
  const response = await fetch(
    BRIDGE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      `Bridge returned invalid JSON (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Bridge HTTP ${response.status}`
    );
  }

  return result;
}

async function startRealtimeStream() {
  const { connection } =
    await connectMetaApi();

  const terminalState =
    connection.terminalState;

  console.log(
    '========================================'
  );
  console.log(
    ' SUPREME REAL-TIME XAU/USD STREAM'
  );
  console.log(
    '========================================'
  );

  console.log(
    'Connected:',
    terminalState.connected
  );

  console.log(
    'Broker:',
    terminalState.connectedToBroker
  );

  await connection.subscribeToMarketData(
    SYMBOL,
    [
      {
        type: 'quotes',
        intervalInMilliseconds: 1000
      },
      {
        type: 'candles',
        timeframe: TIMEFRAME,
        intervalInMilliseconds: 5000
      },
      {
        type: 'ticks'
      }
    ]
  );

  console.log(
    'Market data subscription: ACTIVE'
  );

  let lastCandleTime = null;

  setInterval(async () => {
    try {
      const price =
        terminalState.price(SYMBOL);

      const quote =
        normalizeQuote(price);

      if (
        !quote ||
        quote.bid === null ||
        quote.ask === null
      ) {
        console.log(
          '[SUPREME] Waiting for XAU/USD quote...'
        );
        return;
      }

      console.log(
        `[QUOTE] ${quote.time} ` +
        `BID=${quote.bid} ASK=${quote.ask}`
      );

      const candles =
        await account.getHistoricalCandles(
          SYMBOL,
          TIMEFRAME,
          undefined,
          MIN_BARS
        );

      if (
        !Array.isArray(candles) ||
        candles.length < MIN_BARS
      ) {
        console.log(
          `[SUPREME] Waiting for candles: ` +
          `${candles?.length || 0}/${MIN_BARS}`
        );
        return;
      }

      const normalizedCandles =
        candles.map((candle) => ({
          openTime:
            candle.time instanceof Date
              ? candle.time.toISOString()
              : String(candle.time || ''),
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
          volume:
            candle.tickVolume == null
              ? null
              : Number(candle.tickVolume)
        }));

      const latestCandle =
        normalizedCandles[
          normalizedCandles.length - 1
        ];

      if (
        latestCandle.openTime ===
        lastCandleTime
      ) {
        return;
      }

      lastCandleTime =
        latestCandle.openTime;

      console.log(
        '[SUPREME] New M5 candle:',
        latestCandle.openTime
      );

      const decision =
        await requestDecision({
          symbol: 'XAU/USD',
          timeframe: 'M5',
          bid: quote.bid,
          ask: quote.ask,
          bars: normalizedCandles
        });

      console.log(
        '----------------------------------------'
      );

      console.log(
        'Decision:',
        decision.decision
      );

      console.log(
        'Entry:',
        decision.entry
      );

      console.log(
        'Stop Loss:',
        decision.stopLoss
      );

      console.log(
        'Take Profit:',
        decision.takeProfit
      );

      console.log(
        'ATR:',
        decision.atr
      );

      console.log(
        'Reason:',
        decision.reason
      );

      console.log(
        'Price Action:',
        decision.priceAction
      );

      console.log(
        'Execution:',
        decision.execution
      );

      console.log(
        '----------------------------------------'
      );

    } catch (error) {
      console.error(
        '[SUPREME REALTIME ERROR]',
        error.message
      );
    }
  }, 1000);

  process.on(
    'SIGINT',
    async () => {
      console.log(
        '\n[SUPREME] Stopping realtime stream...'
      );

      try {
        await connection.unsubscribeFromMarketData(
          SYMBOL,
          [
            { type: 'quotes' },
            { type: 'candles', timeframe: TIMEFRAME },
            { type: 'ticks' }
          ]
        );
      } catch (error) {
        console.error(
          '[SUPREME] Unsubscribe error:',
          error.message
        );
      }

      try {
        await connection.close();
      } catch (error) {
        console.error(
          '[SUPREME] Connection close error:',
          error.message
        );
      }

      process.exit(0);
    }
  );
}

startRealtimeStream().catch((error) => {
  console.error(
    '[SUPREME REALTIME START FAILED]',
    error.message
  );
  process.exit(1);
});
