-- Paydirt — 001_init.sql
-- Core relational model. Runs on Tiger Data / timescaledb-ha (Timescale + pgvector).

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS repos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name     text NOT NULL UNIQUE,
  stars         int  NOT NULL DEFAULT 0,
  forks         int  NOT NULL DEFAULT 0,
  language      text,
  open_issues   int  NOT NULL DEFAULT 0,
  created_at    timestamptz,
  last_push_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  repo_id          bigint NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number           int    NOT NULL,
  title            text   NOT NULL,
  body             text,
  url              text   NOT NULL UNIQUE,
  state            text   NOT NULL DEFAULT 'open',
  labels           text[] NOT NULL DEFAULT '{}',
  bounty_amount    numeric,
  bounty_currency  text,
  bounty_source    text,  -- 'github_label' | 'algora' | 'serpapi'
  created_at       timestamptz,
  closed_at        timestamptz,
  comment_count    int    NOT NULL DEFAULT 0,
  claimant_count   int    NOT NULL DEFAULT 0,
  linked_pr_merged boolean,
  merged_at        timestamptz,
  -- snapshot-time feature columns (avoid leakage; see features.py)
  body_length      int,
  has_good_first_issue boolean NOT NULL DEFAULT false,
  embedding        vector(768),
  tsv              tsvector,
  UNIQUE (repo_id, number)
);

CREATE TABLE IF NOT EXISTS user_profile (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  github_login text NOT NULL UNIQUE,
  skills       text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_chunks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  bigint NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  source      text,
  content     text NOT NULL,
  embedding   vector(768)
);

CREATE TABLE IF NOT EXISTS predictions (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id          bigint NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  model_version     text   NOT NULL,
  p_success         float  NOT NULL,
  days_to_merge_est float,
  ev_per_hour       float,
  match_score       float,
  est_hours         float,
  features          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, model_version)
);

CREATE TABLE IF NOT EXISTS tracked (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id      bigint NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  workflow_id   text,
  status        text NOT NULL DEFAULT 'CLAIMED',
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  pr_url        text,
  payout_status text,
  notes         text
);
