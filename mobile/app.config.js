require('dotenv').config();

module.exports = {
  expo: {
    name: "Investor Network",
    slug: "investor-network-mobile",
    // URL scheme used by Linking and deep links (used by expo-linking / expo-router)
    // Set a unique scheme so Linking.createURL() and deep links work in production.
    scheme: "investornetwork",
    version: "1.0.0",
    orientation: "portrait",
    // During development we don't require the production icon/splash assets.
    // Remove or add real assets at `mobile/assets/` if you need them for production builds.
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.amrmek.investornetworkmobile"
    },
    web: {},
    extra: {
      API_URL: process.env.API_URL,
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    }
  }
};