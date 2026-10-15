// Live progress of a refresh: one line per event streamed from the server.
const ICONS = { source: '🔎', agent: '🤖', warn: '⚠️', match: '🧮', done: '✅', error: '❌' };

export default function RunLog({ events, running, onRun, lastRun }) {
  const stats = events.find(e => e.type === 'done')?.stats ?? lastRun?.stats;
  return (
    <div className="card">
      <div className="row">
        <button className="primary" onClick={onRun} disabled={running}>{running ? 'Refreshing…' : 'Refresh now'}</button>
        {stats && (
          <span className="muted">
            {stats.searches} searches · {stats.pages} pages fetched · {stats.agentRuns} agent runs → {stats.listings} listings → {stats.matches} matches
            {stats.new != null && <> · <b>{stats.new} new</b></>}
          </span>
        )}
      </div>
      {events.length > 0 && (
        <ol className="log">
          {events.filter(e => e.type !== 'end' && e.type !== 'done').map((e, i) => (
            <li key={i} className={e.type}>
              {ICONS[e.type]} {e.source && <b>{e.source}</b>} {e.message}
              {e.liveUrl && <a href={e.liveUrl} target="_blank" rel="noreferrer"> watch the agent live ↗</a>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
