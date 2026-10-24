const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Backend settings are compiled into the web bundle. Keep test and cloud
// bundles in distinct caches when both previews run from this checkout.
config.cacheVersion = `${config.cacheVersion || ''}:backend-${process.env.USE_FIREBASE_EMULATORS === 'true' ? 'emulator' : 'cloud'}`;
module.exports = config;
