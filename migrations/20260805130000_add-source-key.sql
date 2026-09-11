-- Cinemastral: add source_key (numeric Oflix subjectId) to content + episodes indexes for watch progress
ALTER TABLE content
  ADD COLUMN source_key text;

CREATE INDEX content_source_key_idx ON content (source_key);

-- Episodes already have UNIQUE(content_id, season, episode_number).
-- Add a convenient index for episode lookup by stream metadata freshness.
CREATE INDEX episodes_stream_idx ON episodes (stream_updated_at DESC NULLS LAST);
