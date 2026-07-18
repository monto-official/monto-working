import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.monto.parent",
  appName: "Monto Parent",
  webDir: "out",

  // Default Android WebView origin is https://localhost, which makes fetches
  // to a plain http:// backend fail as mixed content — switch it to http so
  // both sides match (this app talks to a local dev backend, not TLS).
  server: {
    androidScheme: "http",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0F0F1A",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0F0F1A",
    },
  },
};

export default config;
