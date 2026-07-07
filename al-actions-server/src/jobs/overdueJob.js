import cron from 'node-cron';
import { config } from '../config/env.js';
import { sweepOverdueActions } from '../services/actions.repository.js';
import { getPushToken } from '../services/users.repository.js';
import { notifyEmployeeActionPostponed } from '../services/notifications.service.js';

async function runOverdueSweep() {
  const postponed = await sweepOverdueActions();
  if (postponed.length === 0) return;

  console.log(`Overdue job: ${postponed.length} action(s) moved to postponed.`);

  for (const action of postponed) {
    const pushToken = await getPushToken(action.assigned_to_email);
    notifyEmployeeActionPostponed(
      { id: action.id, title: action.title },
      pushToken
    );
  }
}

/** Registers the cron job. Also runs once immediately at boot to catch anything missed while down. */
export function startOverdueJob() {
  console.log(`Overdue job scheduled: "${config.overdueJobCron}"`);
  runOverdueSweep().catch(err => console.error('Overdue sweep failed:', err.message));

  cron.schedule(config.overdueJobCron, () => {
    runOverdueSweep().catch(err => console.error('Overdue sweep failed:', err.message));
  });
}
