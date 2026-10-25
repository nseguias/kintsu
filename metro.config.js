const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ponytail: Stellar SDK's Horizon streaming pulls in `eventsource`, which subclasses the
// DOM `Event` at load and crashes Hermes. We only use Soroban RPC, so stub it.
// Need Horizon streaming later? Polyfill `Event`/`EventTarget` instead.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'eventsource') return { type: 'empty' };
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
