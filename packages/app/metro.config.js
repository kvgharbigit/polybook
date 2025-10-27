const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add WASM and related file extensions to asset extensions
config.resolver.assetExts.push('wasm', 'data', 'bin');

module.exports = config;