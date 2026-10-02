-- Browser push subscriptions (one row per device). Users manage only their own; the server reads
-- others' rows with the service role to send notifications.
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT CHECK (char_length(user_agent) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push: manage own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
