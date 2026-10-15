# Code map

About 1,100 lines in total, including the CSS. Read the files in the order below.

## 1. The big picture

```mermaid
flowchart LR
  UI[React UI<br/>client/src] -- REST + SSE --> API[Express API<br/>server/src/index.js]
  API --> RUNS[runs.js<br/>one run per search, streams events]
  RUNS --> PIPE[pipeline.js<br/>collect → dedupe → score → save]
  PIPE --> SRC[sources/*<br/>ats · linkedin · portals · agent]
  SRC --> TF[tinyfish.js<br/>Search · Fetch · Agent via SDK]
  PIPE --> DB[(MongoDB Atlas<br/>Search, Job)]
  CRON[scheduler.js<br/>every 30 min] --> RUNS
```

## 2. One refresh, step by step

```mermaid
sequenceDiagram
  participant P as pipeline.collect()
  participant S as sources
  participant T as TinyFish
  P->>S: run enabled sources in parallel
  S->>T: Search "role + place" (ATS, Wellfound, Internshala)
  S->>T: Fetch Greenhouse board JSON · posting pages · LinkedIn search pages
  S->>T: Agent (Naukri / careers URL) with output_schema
  T-->>S: pages / results / structured jobs
  S-->>P: raw listings {title, company, location, url, source}
  P->>P: tidy() → drop closed → dedupe() → score() → keep matches
  P->>P: save(): upsert by key, mark missing jobs stale, count new
```

## 3. Files, in reading order

| #  | File                                                               | What it does                                                                                                     |
| -- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1  | `server/src/prefs.js`                                            | Cleans the user's preferences; `combos()` = the (role, place) pairs every source searches                      |
| 2  | `server/src/tinyfish.js`                                         | SDK wrapper: `search()`, `fetchPages()` (batches of 10), `runAgent()` (stream, schema, timeout and cancel) |
| 3  | `server/src/sources/ats.js`                                      | Search on Greenhouse, Lever and Ashby, then Fetch whole Greenhouse boards and individual posting pages           |
| 4  | `server/src/sources/linkedin.js`                                 | Builds a LinkedIn search URL from the preferences and parses the job cards from the HTML                         |
| 5  | `server/src/sources/portals.js`                                  | Wellfound and Internshala: Search, then follow listing pages, then Fetch posting pages                           |
| 6  | `server/src/sources/parse.js`                                    | One tiny parser per site that turns a fetched page into a listing                                                |
| 7  | `server/src/sources/agent.js`                                    | Naukri and custom careers pages through the TinyFish Agent                                                       |
| 8  | `server/src/dedupe.js`                                           | `canonicalUrl` + `fingerprint` (company, title, city) merge duplicates                                       |
| 9  | `server/src/match.js`                                            | `score()`: role synonyms, seniority, location and NCR, keywords, recency → 0–100 plus reasons                |
| 10 | `server/src/pipeline.js`                                         | Ties it together: `collect()` then `save()`, and the `context` that counts TinyFish usage                  |
| 11 | `server/src/runs.js`                                             | Starts runs and streams their events to the browser over SSE                                                     |
| 12 | `server/src/models.js`, `db.js`                                | Mongoose models `Search` and `Job`, and the Atlas connection                                                 |
| 13 | `server/src/index.js`, `scheduler.js`                          | REST routes and the auto-refresh cron job                                                                        |
| 14 | `client/src/App.jsx`                                             | UI state: searches list, selected search, run events, jobs                                                       |
| 15 | `client/src/SearchForm.jsx` · `RunLog.jsx` · `JobList.jsx` | Preferences form · live progress · ranked jobs (filters, marks, CSV)                                           |

## 4. Data model

```mermaid
erDiagram
  SEARCH ||--o{ JOB : finds
  SEARCH { string name  object prefs  number refreshHours  object lastRun }
  JOB { string key  string title  string company  string location  string url  array sources  number score  array reasons  date firstSeenAt  date lastSeenAt  bool stale  string mark }
```

## 5. API

| Method              | Route                      | Purpose                                          |
| ------------------- | -------------------------- | ------------------------------------------------ |
| GET                 | `/api/searches`          | list saved searches                              |
| POST / PUT / DELETE | `/api/searches[/:id]`    | create, update or delete a search (and its jobs) |
| POST                | `/api/searches/:id/run`  | start a refresh and return `{ runId }`         |
| GET                 | `/api/runs/:id/events`   | progress stream (Server-Sent Events)             |
| GET                 | `/api/searches/:id/jobs` | ranked jobs                                      |
| PATCH               | `/api/jobs/:id`          | `{ mark: 'saved'                                 |
