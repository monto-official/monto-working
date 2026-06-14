import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.monto.kids",
  appName: "Monto Kids",
  webDir:  "out",

  server: {
    // For development — point to localhost backend
    // For production APK — remove this and use hardcoded API URL
    // androidScheme: "https",
  },

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor:    "#0D0820",
      showSpinner:        false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0D0820",
    },
    Keyboard: {
      resize: "body",
      style:  "dark",
    },
  },
};

export default config;
