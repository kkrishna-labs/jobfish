import './env.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { connectDb } from './db.js';
import { Search, Job } from './models.js';
import { normalizePrefs } from './prefs.js';
import { startRun, followRun } from './runs.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.use(express.json());

const searchBody = body => {
  const prefs = normalizePrefs(body.prefs);
  return {
    name: String(body.name ?? '').trim() || prefs.roles.join(', ') || 'My search',
    prefs,
    refreshHours: [0, 6, 12, 24].includes(Number(body.refreshHours)) ? Number(body.refreshHours) : 0,
  };
};

app.get('/api/health', (req, res) => res.json({ ok: true, tinyfishKey: Boolean(process.env.TINYFISH_API_KEY) }));

app.get('/api/searches', async (req, res) => res.json(await Search.find().sort('-updatedAt')));
app.post('/api/searches', async (req, res) => res.status(201).json(await Search.create(searchBody(req.body))));
app.put('/api/searches/:id', async (req, res) =>
  res.json(await Search.findByIdAndUpdate(req.params.id, searchBody(req.body), { new: true })));
app.delete('/api/searches/:id', async (req, res) => {
  await Job.deleteMany({ search: req.params.id });
  await Search.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.post('/api/searches/:id/run', async (req, res) => {
  const doc = await Search.findById(req.params.id);
  if (!doc) return res.sendStatus(404);
  res.json({ runId: startRun(doc) });
});
app.get('/api/runs/:id/events', (req, res) => followRun(req.params.id, res));

app.get('/api/searches/:id/jobs', async (req, res) =>
  res.json(await Job.find({ search: req.params.id }).sort({ score: -1, postedAt: -1 }).limit(500)));
app.patch('/api/jobs/:id', async (req, res) =>
  res.json(await Job.findByIdAndUpdate(req.params.id, { mark: req.body.mark ?? '' }, { new: true, runValidators: true })));

// Serve the built React app (npm run build) from the same server.
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
app.use(express.static(dist));
app.get(/^\/(?!api).*/, (req, res) => res.sendFile('index.html', { root: dist }));

app.use((err, req, res, next) => res.status(err.name === 'CastError' ? 400 : 500).json({ error: err.message }));

const port = Number(process.env.PORT) || 5050;
await connectDb();
startScheduler();
app.listen(port, () => console.log(`JobFish API on http://localhost:${port}`));
