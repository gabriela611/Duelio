CREATE INDEX IF NOT EXISTS idx_follows_follower_user_id ON public.follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target_user_id ON public.follows(target_user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reposts_user_id ON public.post_reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_matches_user_id ON public.practice_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_user_id ON public.replies(user_id);
