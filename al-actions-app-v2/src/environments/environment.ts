export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api',
  googleWorkspaceDomain: 'gmail.com',
//   googleWorkspaceDomain: 'airliquide.com',
  // Same value as capacitor.config.ts -> plugins.GoogleAuth.serverClientId,
  // and must match the backend's GOOGLE_OAUTH_CLIENT_ID exactly. Native
  // platforms (Android/iOS) auto-init from capacitor.config.ts; the web
  // target (`ionic serve`) needs this passed explicitly to
  // GoogleAuth.initialize() — see auth.service.ts.
  googleWebClientId: '271237633904-k8mihjqai35i3pl6hrosk615sdp2mkec.apps.googleusercontent.com'
};
