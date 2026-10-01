-- Feedback from signed-in users to the system administrator, with optional screenshots.
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('problem', 'request', 'praise', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  image_paths TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(image_paths) <= 4),
  page_url TEXT CHECK (char_length(page_url) <= 300),
  user_agent TEXT CHECK (char_length(user_agent) <= 300),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feedback_user_idx ON public.feedback (user_id);
CREATE INDEX feedback_created_idx ON public.feedback (created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback: send as myself" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "feedback: read own or admin" ON public.feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.current_role_is('super_admin'));
CREATE POLICY "feedback: admin updates" ON public.feedback FOR UPDATE TO authenticated
  USING (public.current_role_is('super_admin')) WITH CHECK (public.current_role_is('super_admin'));

-- Screenshots live in their own private bucket, so the repair-photo cleanup job never touches them.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-images', 'feedback-images', false, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feedback images: upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "feedback images: read own or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-images' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.current_role_is('super_admin')));
CREATE POLICY "feedback images: delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-images' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.current_role_is('super_admin')));
