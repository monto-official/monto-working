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
      // Matches the new splash artwork's own pastel background so there's
      // no visible seam around it while the image loads/fades in.
      backgroundColor: "#F5EAE9",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#F5EAE9",
    },
  },
};

export default config;
