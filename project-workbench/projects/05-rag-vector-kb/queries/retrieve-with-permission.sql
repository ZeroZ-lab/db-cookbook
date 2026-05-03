WITH visible_documents AS (
  SELECT document_id
  FROM rag.documents
  WHERE collection_id = :collection_id
    AND (
      owner_id = :user_id
      OR access_scope = ANY(:allowed_scopes)
    )
),
candidate_chunks AS (
  SELECT
    c.chunk_id,
    c.document_id,
    c.content,
    c.source_uri,
    e.embedding <=> :query_embedding AS distance
  FROM rag.embeddings e
  JOIN rag.chunks c
    ON e.chunk_id = c.chunk_id
  JOIN visible_documents vd
    ON c.document_id = vd.document_id
  WHERE e.embedding_model = :embedding_model
    AND e.embedding_version = :embedding_version
  ORDER BY e.embedding <=> :query_embedding
  LIMIT 50
)
SELECT
  chunk_id,
  document_id,
  content,
  source_uri,
  distance
FROM candidate_chunks
ORDER BY distance
LIMIT 10;

INSERT INTO rag.retrieval_logs (
  request_id,
  user_id,
  collection_id,
  query_text,
  metadata_filter,
  candidate_chunk_ids,
  reranked_chunk_ids
)
VALUES (
  :request_id,
  :user_id,
  :collection_id,
  :query_text,
  :metadata_filter,
  :candidate_chunk_ids,
  :reranked_chunk_ids
);
