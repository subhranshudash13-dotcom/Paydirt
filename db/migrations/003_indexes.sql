-- Paydirt — 003_indexes.sql
-- Search, vector, and lookup indexes + hybrid_search (reciprocal rank fusion).

-- Keep issues.tsv populated for keyword search.
CREATE OR REPLACE FUNCTION issues_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A')
          || setweight(to_tsvector('english', coalesce(array_to_string(NEW.labels, ' '), '')), 'B')
          || setweight(to_tsvector('english', coalesce(NEW.body, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issues_tsv ON issues;
CREATE TRIGGER trg_issues_tsv
  BEFORE INSERT OR UPDATE OF title, body, labels ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_tsv_trigger();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_issues_tsv        ON issues USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_issues_repo_num   ON issues (repo_id, number);
CREATE INDEX IF NOT EXISTS idx_predictions_issue ON predictions (issue_id, model_version);
CREATE INDEX IF NOT EXISTS idx_tracked_issue     ON tracked (issue_id);

-- HNSW (cosine) vector indexes. Dimension is fixed at 768 (EmbeddingGemma).
CREATE INDEX IF NOT EXISTS idx_issues_embedding
  ON issues USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_user_chunks_embedding
  ON user_chunks USING hnsw (embedding vector_cosine_ops);

-- hybrid_search: reciprocal-rank fusion of tsvector rank and cosine distance.
CREATE OR REPLACE FUNCTION hybrid_search(q text, q_emb vector(768), k int)
RETURNS TABLE (issue_id bigint, text_rank real, vec_rank real, fused real) AS $$
WITH kw AS (
  SELECT id AS issue_id,
         ts_rank(tsv, websearch_to_tsquery('english', q)) AS score,
         row_number() OVER (ORDER BY ts_rank(tsv, websearch_to_tsquery('english', q)) DESC) AS rnk
  FROM issues
  WHERE tsv @@ websearch_to_tsquery('english', q)
  LIMIT 100
),
vec AS (
  SELECT id AS issue_id,
         (1 - (embedding <=> q_emb))::real AS score,
         row_number() OVER (ORDER BY embedding <=> q_emb) AS rnk
  FROM issues
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> q_emb
  LIMIT 100
)
SELECT
  COALESCE(kw.issue_id, vec.issue_id) AS issue_id,
  COALESCE(kw.score, 0)::real          AS text_rank,
  COALESCE(vec.score, 0)::real         AS vec_rank,
  (CASE WHEN kw.rnk  IS NOT NULL THEN 1.0/(60 + kw.rnk)  ELSE 0 END)::real
  + (CASE WHEN vec.rnk IS NOT NULL THEN 1.0/(60 + vec.rnk) ELSE 0 END)::real AS fused
FROM kw
FULL OUTER JOIN vec USING (issue_id)
ORDER BY fused DESC
LIMIT k;
$$ LANGUAGE SQL;
