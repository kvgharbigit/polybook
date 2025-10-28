const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add WASM and related file extensions to asset extensions
config.resolver.assetExts.push('wasm', 'data', 'bin');

// Add text and epub files as assets for sample books
config.resolver.assetExts.push('txt', 'epub');

module.exports = config;