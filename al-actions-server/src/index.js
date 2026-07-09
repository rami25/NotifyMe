import { config } from './config/env.js';
import { createApp } from './app.js';
import { startOverdueJob } from './jobs/overdueJob.js';
import { startSheetSyncPolling } from './services/sheetSync.service.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`AL Actions API listening on port ${config.port} (${config.nodeEnv})`);
//   startOverdueJob();
//   startSheetSyncPolling();
});
