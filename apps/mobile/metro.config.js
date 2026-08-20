const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @react-navigation/core and @react-navigation/routers get hoisted to the
// monorepo root node_modules (npm workspace dedup). When they `require('react')`,
// Node's normal hierarchical lookup finds the root copy (18.x, used by apps/web)
// before ever reaching this project's local copy (19.x, required by react-native
// 0.81) — so extraNodeModules (a fallback used only when normal resolution fails)
// never even gets consulted. Two React instances in one app tree makes React 19's
// element check reject elements created by the other copy ("Objects are not valid
// as a React child"). Intercept resolution directly to force a single instance.
function isForcedSingleton(moduleName) {
  return (
    moduleName === 'react' ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react/') ||
    moduleName.startsWith('react-dom/') ||
    moduleName === 'scheduler' ||
    moduleName.startsWith('scheduler/')
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isForcedSingleton(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: __filename },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
