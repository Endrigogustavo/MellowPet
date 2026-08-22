// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/realtime-js ships a package.json "exports" map that Metro's
// package-exports resolution can't fully follow (it loses the relative
// "./lib/websocket-factory" import and fails to resolve it), crashing the
// bundler with "Unable to resolve module ./lib/websocket-factory". Falling
// back to the classic main-field resolution avoids that codepath entirely —
// same fix documented by Supabase for Expo/Metro projects.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
