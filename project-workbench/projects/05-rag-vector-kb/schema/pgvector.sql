CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag.documents (
  document_id BIGSERIAL PRIMARY KEY,
  collection_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  document_version TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag.chunks (
  chunk_id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES rag.documents(document_id),
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT NOT NULL,
  start_offset INT NOT NULL,
  end_offset INT NOT NULL,
  source_uri TEXT NOT NULL,
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS rag.embeddings (
  embedding_id BIGSERIAL PRIMARY KEY,
  chunk_id BIGINT NOT NULL REFERENCES rag.chunks(chunk_id),
  embedding_model TEXT NOT NULL,
  embedding_version TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, embedding_model, embedding_version)
);

CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx
  ON rag.embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS rag.retrieval_logs (
  retrieval_id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  metadata_filter JSONB NOT NULL,
  candidate_chunk_ids BIGINT[] NOT NULL,
  reranked_chunk_ids BIGINT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag.evaluations (
  evaluation_id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  expected_source_uri TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  required_access_scope TEXT NOT NULL,
  passed BOOLEAN,
  notes TEXT
);
