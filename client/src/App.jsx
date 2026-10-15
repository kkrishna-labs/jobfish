// Layout and state: saved searches on the left, the selected search's run log and jobs on the right.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import SearchForm from './SearchForm.jsx';
import RunLog from './RunLog.jsx';
import JobList from './JobList.jsx';

export default function App() {
  const [searches, setSearches] = useState([]);
  const [selected, setSelected] = useState(null); // a search, or {} for a new one
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadSearches = () => api.searches().then(setSearches).catch(e => setError(e.message));
  useEffect(() => { loadSearches(); }, []);
  useEffect(() => {
    setJobs([]);
    setEvents([]);
    if (selected?._id) api.jobs(selected._id).then(setJobs).catch(e => setError(e.message));
  }, [selected?._id]);

  async function save(search, andRun) {
    setError('');
    try {
      const saved = await api.saveSearch(search);
      setSelected(saved);
      await loadSearches();
      if (andRun) await run(saved);
    } catch (e) {
      setError(e.message);
    }
  }

  async function run(search) {
    setEvents([]);
    setRunning(true);
    const { runId } = await api.run(search._id);
    api.follow(runId, event => {
      setEvents(list => [...list, event]);
      if (event.type === 'end') {
        setRunning(false);
        api.jobs(search._id).then(setJobs);
        loadSearches();
      }
    });
  }

  async function remove(search) {
    if (!confirm(`Delete "${search.name}" and its jobs?`)) return;
    await api.deleteSearch(search._id);
    setSelected(null);
    loadSearches();
  }

  const current = searches.find(s => s._id === selected?._id) ?? selected;

  return (
    <div className="app">
      <header>
        <h1>🐟 JobFish</h1>
        <p>Live jobs &amp; internships from company boards and job portals, powered by TinyFish Search, Fetch and Agent.</p>
      </header>
      {error && <p className="error">{error}</p>}
      <main>
        <aside>
          <button className="primary" onClick={() => setSelected({})}>+ New search</button>
          <ul className="searches">
            {searches.map(s => (
              <li key={s._id} className={s._id === selected?._id ? 'active' : ''} onClick={() => setSelected(s)}>
                <strong>{s.name}</strong>
                <small>{s.lastRun?.at ? `${s.lastRun.stats.matches} matches · ${new Date(s.lastRun.at).toLocaleString()}` : 'never run'}</small>
              </li>
            ))}
          </ul>
        </aside>
        <section>
          {!current && <p className="muted">Create a search to start: pick roles, places and seniority, then hit “Save &amp; run”.</p>}
          {current && <SearchForm key={current._id ?? 'new'} search={current} onSave={save} onDelete={remove} running={running} />}
          {current?._id && <RunLog events={events} running={running} onRun={() => run(current)} lastRun={current.lastRun} />}
          {current?._id && <JobList jobs={jobs} lastRunAt={current.lastRun?.at} onMark={async (job, mark) => {
            const updated = await api.markJob(job._id, mark);
            setJobs(list => list.map(j => (j._id === updated._id ? updated : j)));
          }} />}
        </section>
      </main>
    </div>
  );
}
