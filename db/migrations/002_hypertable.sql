-- Paydirt — 002_hypertable.sql
-- Maintainer-response time series as a TimescaleDB hypertable.

CREATE TABLE IF NOT EXISTS maintainer_events (
  time          timestamptz NOT NULL,
  repo_id       bigint      NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  kind          text        NOT NULL, -- 'first_response' | 'pr_merged' | 'pr_closed' | 'review_comment'
  latency_hours numeric     NOT NULL,
  issue_number  int
);

-- Convert to a hypertable partitioned on time (1-chunk default interval).
SELECT create_hypertable('maintainer_events', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_maintainer_events_repo_kind_time
  ON maintainer_events (repo_id, kind, time DESC);
