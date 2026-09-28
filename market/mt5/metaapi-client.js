require('dotenv').config();

const MetaApiModule = require('metaapi.cloud-sdk');

const MetaApi =
  MetaApiModule.default || MetaApiModule;

const SYMBOL = 'XAUUSD';

function getConfig() {
  const token = String(
    process.env.METAAPI_TOKEN || ''
  ).trim();

  const accountId = String(
    process.env.METAAPI_ACCOUNT_ID || ''
  ).trim();

  const demoOnly =
    String(
      process.env.METAAPI_DEMO_ONLY || 'true'
    ).toLowerCase() === 'true';

  return {
    token,
    accountId,
    demoOnly
  };
}

function validateConfig() {
  const config = getConfig();

  if (!config.token) {
    throw new Error(
      'METAAPI_TOKEN is missing'
    );
  }

  if (!config.accountId) {
    throw new Error(
      'METAAPI_ACCOUNT_ID is missing'
    );
  }

  if (!config.demoOnly) {
    throw new Error(
      'METAAPI_DEMO_ONLY must remain true'
    );
  }

  return config;
}

async function connectMetaApi() {
  const {
    token,
    accountId
  } = validateConfig();

  const api = new MetaApi(token);

  const account =
    await api.metatraderAccountApi.getAccount(
      accountId
    );

  await account.waitConnected();

  const connection =
    account.getStreamingConnection();

  await connection.connect();
  await connection.waitSynchronized();

  await connection.subscribeToMarketData(
    SYMBOL
  );

  return {
    api,
    account,
    connection
  };
}

async function getRealtimeState() {
  const {
    connection
  } = await connectMetaApi();

  const terminalState =
    connection.terminalState;

  const price =
    terminalState.price(SYMBOL);

  const accountInformation =
    terminalState.accountInformation;

  return {
    symbol: SYMBOL,
    connected: terminalState.connected,
    connectedToBroker:
      terminalState.connectedToBroker,
    price,
    accountInformation
  };
}

module.exports = {
  SYMBOL,
  getConfig,
  validateConfig,
  connectMetaApi,
  getRealtimeState
};
