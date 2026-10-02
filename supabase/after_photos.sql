-- Photos taken after the repair is done, added by staff.
ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS after_image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.repair_tickets
  ADD CONSTRAINT repair_tickets_after_images_max CHECK (cardinality(after_image_urls) <= 4);

-- The reporter may look at the after photos of their own ticket (they sit in staff folders).
CREATE POLICY "repair images: reporter reads after photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'repair-images' AND EXISTS (
    SELECT 1 FROM public.repair_tickets t
    WHERE t.reporter_id = (SELECT auth.uid()) AND storage.objects.name = ANY (t.after_image_urls)));
