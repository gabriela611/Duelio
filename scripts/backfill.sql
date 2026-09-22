-- ============================================================================
-- Duelio Social & Game Migration: Clean Seed Backfill
-- Generated At: 2026-09-21T22:05:44.722Z
-- Idempotent execution: ON CONFLICT (id) DO NOTHING
-- ============================================================================

-- 1. Migrate Genuine Posts
INSERT INTO public.posts (id, author_address, author_name, author_initials, kind, eyebrow, title, description, content, asset, stake_mon, is_live_challenge, created_at, updated_at) VALUES ('genesis-challenge-1', '0x836ef90000000000000000000000000000000001', 'Duelist Alpha', 'DA', 'challenges', 'Open 30s Arena Challenge', 'Who can predict BTC in 30s?', 'Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC to the moon! 🚀', 'Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC to the moon! 🚀', 'BTC', 0.1, true, TIMESTAMPTZ '2026-03-22T11:46:40.000Z', TIMESTAMPTZ '2026-03-22T11:46:40.000Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.posts (id, author_address, author_name, author_initials, kind, eyebrow, title, description, content, asset, stake_mon, is_live_challenge, created_at, updated_at) VALUES ('genesis-challenge-2', '0x836ef90000000000000000000000000000000002', 'MonadMaster', 'MM', 'challenges', 'Monad Testnet Duel', 'ETH Speed Clash Challenge', 'Ready for two-wallet on-chain duels with Pyth oracle settlement. $ETH looking bullish this hour.', 'Ready for two-wallet on-chain duels with Pyth oracle settlement. $ETH looking bullish this hour.', 'ETH', 0.25, true, TIMESTAMPTZ '2026-03-22T10:46:40.000Z', TIMESTAMPTZ '2026-03-22T10:46:40.000Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.posts (id, author_address, author_name, author_initials, kind, eyebrow, title, description, content, asset, stake_mon, is_live_challenge, created_at, updated_at) VALUES ('genesis-tweet-3', '0x836ef90000000000000000000000000000000003', 'CryptoWhale', 'CW', 'tweets', 'Market Alpha', 'Monad sub-second finality is a game changer', 'Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.', 'Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.', NULL, NULL, false, TIMESTAMPTZ '2026-03-22T09:00:00.000Z', TIMESTAMPTZ '2026-03-22T09:00:00.000Z') ON CONFLICT (id) DO NOTHING;

-- 2. Migrate Genuine Replies
INSERT INTO public.replies (id, post_id, author_address, author_name, author_initials, content, created_at) VALUES ('reply-genesis-1', 'genesis-challenge-1', '0x836ef90000000000000000000000000000000002', 'MonadMaster', 'MM', 'Accepted! Let''s see your prediction reflexes on $BTC.', TIMESTAMPTZ '2026-03-22T11:53:20.000Z') ON CONFLICT (id) DO NOTHING;

-- Verification summary counts
SELECT (SELECT count(*) FROM public.posts) as posts_count, (SELECT count(*) FROM public.replies) as replies_count;
