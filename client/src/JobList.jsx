// Ranked, deduplicated jobs with quick filters, apply links, save/hide marks and CSV export.
import { useState } from 'react';

const MARKS = { saved: 'save', applied: 'applied', hidden: 'hide' };

const ago = date => {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date)) / 864e5);
  return days < 1 ? 'today' : `${days}d ago`;
};

function exportCsv(jobs) {
  const cols = ['score', 'title', 'company', 'location', 'level', 'postedAt', 'url'];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...jobs.map(j => cols.map(c => cell(j[c])).join(','))].join('\n');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'jobs.csv' });
  link.click();
}

export default function JobList({ jobs, lastRunAt, onMark }) {
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [view, setView] = useState('open'); // open | new | saved | applied | hidden

  const isNew = j => lastRunAt && new Date(j.firstSeenAt) >= new Date(lastRunAt);
  const shown = jobs.filter(j =>
    j.score >= minScore
    && `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(query.toLowerCase())
    && (view === 'open' ? !j.stale && j.mark !== 'hidden'
      : view === 'new' ? isNew(j) && j.mark !== 'hidden'
        : j.mark === view));

  return (
    <div className="card">
      <div className="row filters">
        <input placeholder="Filter by title, company, place" value={query} onChange={e => setQuery(e.target.value)} />
        <label>Min score {minScore}<input type="range" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} /></label>
        <select value={view} onChange={e => setView(e.target.value)}>
          <option value="open">Open</option><option value="new">New this refresh</option>
          <option value="saved">Saved</option><option value="applied">Applied</option><option value="hidden">Hidden</option>
        </select>
        <button onClick={() => exportCsv(shown)} disabled={!shown.length}>Export CSV</button>
      </div>
      <p className="muted">{shown.length} of {jobs.length} jobs</p>
      <ul className="jobs">
        {shown.map(j => (
          <li key={j._id} className={j.stale ? 'stale' : ''}>
            <span className="score" title={j.reasons.join('\n')}>{j.score}</span>
            <div className="job">
              <a href={j.url} target="_blank" rel="noreferrer"><b>{j.title}</b></a>
              {isNew(j) && <span className="badge new">NEW</span>}
              {j.level && <span className="badge">{j.level}</span>}
              {j.remote && <span className="badge">remote</span>}
              <div className="muted">{j.company} · {j.location || 'location n/a'} {j.salary && `· ${j.salary}`} {j.postedAt && `· ${ago(j.postedAt)}`}</div>
              <div className="reasons">{j.reasons.join(' · ')}</div>
              <div className="sources">
                {j.sources.map(s => <a key={s.name} href={s.url} target="_blank" rel="noreferrer">{s.name}</a>)}
              </div>
            </div>
            <div className="marks">
              <a className="button primary" href={j.url} target="_blank" rel="noreferrer">Apply</a>
              {Object.entries(MARKS).map(([mark, label]) => (
                <button key={mark} className={j.mark === mark ? 'on' : ''} onClick={() => onMark(j, j.mark === mark ? '' : mark)}>{label}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
