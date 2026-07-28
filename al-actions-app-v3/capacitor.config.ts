import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.airliquide.tn.actions',
  appName: 'AL Actions',
  webDir: 'www',
  backgroundColor: '#FFFFFF',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#FFFFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#375F9B',
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // MUST be a "Web application" type OAuth Client ID from Google Cloud
      // Console — NOT the Android or iOS client ID. This is what ends up
      // in the ID token's `aud` claim, and the backend verifies against
      // exactly this value (see GOOGLE_OAUTH_CLIENT_ID in the server's
      // .env / src/config/env.js -> config.googleOAuthClientId). If these
      // two don't match character-for-character, every sign-in will be
      // rejected by the API with "Invalid Google token".
      serverClientId: 'REPLACE_WITH_GOOGLE_WORKSPACE_OAUTH_CLIENT_ID',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
