-- Cinemastral: multi-source support
-- Allow each content to have additional provider sources
-- (VidCore=primary iframe/TMDB-based, Oflix=alternative HLS)
CREATE TABLE content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  provider text NOT NULL,          -- e.g. 'vidcore', 'oflix'
  source_key text,                 -- e.g. TMDB id (vidcore) / subjectKey (oflix)
  external_url text,               -- e.g. vidcore embed url
  priority int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (content_id, provider)
);

CREATE INDEX content_sources_provider_idx ON content_sources (provider);
CREATE INDEX content_sources_source_key_idx ON content_sources (source_key);

CREATE TRIGGER content_sources_updated_at
  BEFORE UPDATE ON content_sources
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_sources public read"
  ON content_sources FOR SELECT USING (true);
-- Writes go through the admin (service_role) client, bypassing RLS.
