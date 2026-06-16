/**
 * Babel configuration for Expo SDK 54.
 *
 * Important notes:
 * - babel-preset-expo automatically includes:
 *     • @babel/preset-env / preset-typescript
 *     • react-native-worklets/plugin   (REPLACES the old react-native-reanimated/plugin)
 *     • expo-router/babel
 *
 * - Do NOT add 'react-native-reanimated/plugin' here — it is deprecated in
 *   Reanimated 4 (the version shipped with SDK 54).
 *
 * - Do NOT add custom plugins after the preset unless absolutely required;
 *   the order matters and worklets must remain last (already handled by the preset).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
