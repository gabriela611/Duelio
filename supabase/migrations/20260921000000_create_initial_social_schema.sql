CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Identity: app_users
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_did TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

-- 2. Identity: user_wallets
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  address TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_wallets_chain_address UNIQUE (chain_id, address),
  CONSTRAINT chk_user_wallets_address_lower CHECK (address = lower(address))
);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON public.user_wallets(address);

-- 3. Identity: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  display_name TEXT,
  handle TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Social: posts
CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  author_address TEXT NOT NULL,
  author_name TEXT,
  author_initials TEXT,
  kind TEXT NOT NULL DEFAULT 'tweets' CHECK (kind IN ('tweets', 'challenges', 'duels')),
  eyebrow TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  asset TEXT,
  stake_mon NUMERIC(78, 18),
  chain_id BIGINT,
  duel_contract TEXT,
  onchain_duel_id TEXT,
  is_live_challenge BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_posts_author_address_lower CHECK (author_address = lower(author_address))
);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_address ON public.posts(author_address);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_kind ON public.posts(kind) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_onchain_duel ON public.posts(onchain_duel_id) WHERE onchain_duel_id IS NOT NULL;

-- 5. Social: replies
CREATE TABLE IF NOT EXISTS public.replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  author_address TEXT NOT NULL,
  author_name TEXT,
  author_initials TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_replies_author_address_lower CHECK (author_address = lower(author_address))
);
CREATE INDEX IF NOT EXISTS idx_replies_post_id ON public.replies(post_id);
CREATE INDEX IF NOT EXISTS idx_replies_author_address ON public.replies(author_address);

-- 6. Social: post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_address),
  CONSTRAINT chk_post_likes_address_lower CHECK (user_address = lower(user_address))
);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_address ON public.post_likes(user_address);

-- 7. Social: post_reposts
CREATE TABLE IF NOT EXISTS public.post_reposts (
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_address),
  CONSTRAINT chk_post_reposts_address_lower CHECK (user_address = lower(user_address))
);
CREATE INDEX IF NOT EXISTS idx_post_reposts_user_address ON public.post_reposts(user_address);

-- 8. Social: follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_address TEXT NOT NULL,
  target_address TEXT NOT NULL,
  follower_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_address, target_address),
  CONSTRAINT chk_follows_follower_lower CHECK (follower_address = lower(follower_address)),
  CONSTRAINT chk_follows_target_lower CHECK (target_address = lower(target_address)),
  CONSTRAINT chk_no_self_follow CHECK (follower_address <> target_address)
);
CREATE INDEX IF NOT EXISTS idx_follows_target_address ON public.follows(target_address);

-- 9. Game: practice_matches (Strictly offline practice, never onchain authority)
CREATE TABLE IF NOT EXISTS public.practice_matches (
  id TEXT PRIMARY KEY,
  player_address TEXT NOT NULL,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  asset TEXT NOT NULL,
  strike_price NUMERIC NOT NULL,
  settled_price NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('HIGHER', 'LOWER')),
  outcome TEXT NOT NULL CHECK (outcome IN ('WIN', 'LOSS', 'DRAW')),
  stake NUMERIC NOT NULL DEFAULT 0,
  payout NUMERIC NOT NULL DEFAULT 0,
  elo_delta NUMERIC NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'practice' CHECK (mode = 'practice'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_practice_player_lower CHECK (player_address = lower(player_address))
);
CREATE INDEX IF NOT EXISTS idx_practice_matches_player ON public.practice_matches(player_address);

-- Enable RLS on all tables
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_matches ENABLE ROW LEVEL SECURITY;

-- Grants: read-only for public/anon/authenticated, full access for service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- RLS SELECT Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public wallets are viewable" ON public.user_wallets FOR SELECT USING (is_public = true);
CREATE POLICY "Non-deleted posts are viewable by everyone" ON public.posts FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Replies are viewable by everyone" ON public.replies FOR SELECT USING (true);
CREATE POLICY "Likes are viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Reposts are viewable by everyone" ON public.post_reposts FOR SELECT USING (true);
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Practice matches are viewable by everyone" ON public.practice_matches FOR SELECT USING (true);
