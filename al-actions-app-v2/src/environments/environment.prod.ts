export const environment = {
  production: true,
  apiBaseUrl: 'https://actions-api.airliquide-tn.internal/api',
  googleWorkspaceDomain: 'airliquide.com',
  // Same OAuth Web Client ID as capacitor.config.ts and the backend's
  // GOOGLE_OAUTH_CLIENT_ID — see the comment in environment.ts.
  googleWebClientId: 'REPLACE_WITH_GOOGLE_WORKSPACE_OAUTH_CLIENT_ID'
};
