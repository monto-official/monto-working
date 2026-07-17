import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.monto.parent",
  appName: "Monto Parent",
  webDir: "out",

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
