import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  googleOAuthClientId: required('GOOGLE_OAUTH_CLIENT_ID'),
  allowedGoogleDomain: process.env.ALLOWED_GOOGLE_DOMAIN || 'airliquide.com',

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER,
    appPassword: process.env.SMTP_APP_PASSWORD,
    from: process.env.NOTIFICATIONS_FROM || process.env.SMTP_USER
  },
  adminNotificationEmails: (process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean),

  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,

  googleSheets: {
    sheetId: process.env.GOOGLE_SHEETS_ID,
    range: process.env.GOOGLE_SHEETS_RANGE || 'Actions!A2:H',
    serviceAccountPath: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH,
    syncIntervalMinutes: Number(process.env.SHEET_SYNC_INTERVAL_MINUTES || 5)
  },

  overdueJobCron: process.env.OVERDUE_JOB_CRON || '*/15 * * * *'
};
