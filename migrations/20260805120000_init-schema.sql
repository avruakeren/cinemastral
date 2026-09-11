-- Cinemastral: initial schema
-- Content catalog (film/series/anime/donghua), episodes, user profiles, watchlist, watch progress

-- ============ CONTENT ============
CREATE TABLE content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  alt_title text,
  synopsis text,
  type text NOT NULL CHECK (type IN ('film', 'series', 'anime', 'donghua')),
  poster_url text,
  backdrop_url text,
  release_year int,
  rating numeric(3, 1),
  duration int,
  status text,
  country text,
  source_id text,
  source_url text,
  stream_data jsonb,
  stream_updated_at timestamptz,
  featured bool DEFAULT false,
  trending bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX content_type_idx ON content (type);
CREATE INDEX content_featured_idx ON content (featured) WHERE featured = true;
CREATE INDEX content_trending_idx ON content (trending) WHERE trending = true;
CREATE INDEX content_release_year_idx ON content (release_year DESC);
CREATE INDEX content_rating_idx ON content (rating DESC);
CREATE INDEX content_source_id_idx ON content (source_id);

-- ============ GENRES ============
CREATE TABLE genres (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL
);

CREATE TABLE content_genres (
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  genre_id int REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, genre_id)
);

CREATE INDEX content_genres_genre_idx ON content_genres (genre_id);

-- ============ EPISODES ============
CREATE TABLE episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  season int DEFAULT 1,
  episode_number int NOT NULL,
  title text,
  thumbnail_url text,
  stream_data jsonb,
  stream_updated_at timestamptz,
  duration int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (content_id, season, episode_number)
);

CREATE INDEX episodes_content_idx ON episodes (content_id, season, episode_number);

-- ============ PROFILES ============
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- ============ WATCHLIST ============
CREATE TABLE watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id uuid REFERENCES content(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'watching', 'completed', 'dropped')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, content_id)
);

CREATE INDEX watchlist_user_idx ON watchlist (user_id);

-- ============ WATCH PROGRESS ============
CREATE TABLE watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id uuid REFERENCES content(id) ON DELETE CASCADE NOT NULL,
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  progress_seconds int DEFAULT 0,
  duration_seconds int,
  completed bool DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, content_id, episode_id)
);

CREATE INDEX watch_progress_user_idx ON watch_progress (user_id, updated_at DESC);

-- ============ TRIGGERS ============
-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.profile->>'name', split_part(NEW.email, '@', 1)),
    NEW.profile->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE TRIGGER content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER watch_progress_updated_at
  BEFORE UPDATE ON watch_progress
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

-- ============ RLS: CONTENT / EPISODES / GENRES (public read, no public write) ============
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_content" ON content
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_episodes" ON episodes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_genres" ON genres
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_content_genres" ON content_genres
  FOR SELECT TO anon, authenticated USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON content, episodes, genres, content_genres TO anon, authenticated;

-- ============ RLS: PROFILES (owner only) ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

GRANT SELECT, UPDATE ON profiles TO authenticated;

-- ============ RLS: WATCHLIST (owner full CRUD) ============
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_watchlist" ON watchlist
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist TO authenticated;

-- ============ RLS: WATCH PROGRESS (owner full CRUD) ============
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_watch_progress" ON watch_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON watch_progress TO authenticated;
