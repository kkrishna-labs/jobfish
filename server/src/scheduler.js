// Keep results fresh: every 30 minutes, re-run saved searches whose refresh interval has passed.
// Scheduled refreshes skip the metered Agent so they cost nothing.
import cron from 'node-cron';
import { Search } from './models.js';
import { startRun } from './runs.js';

export function startScheduler() {
  cron.schedule('*/30 * * * *', async () => {
    const searches = await Search.find({ refreshHours: { $gt: 0 } });
    for (const doc of searches) {
      const due = !doc.lastRun?.at || Date.now() - doc.lastRun.at >= doc.refreshHours * 36e5;
      if (due) startRun(doc, { allowAgent: false });
    }
  });
}
