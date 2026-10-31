ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS popup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_button_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_button_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popup_delay_seconds integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS popup_frequency text NOT NULL DEFAULT 'once';

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_popup_delay_range CHECK (popup_delay_seconds BETWEEN 0 AND 60),
  ADD CONSTRAINT store_settings_popup_frequency_values CHECK (popup_frequency IN ('once', 'visit'));

DROP POLICY IF EXISTS "Admins upload popup images" ON storage.objects;
CREATE POLICY "Admins upload popup images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'popup-ads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update popup images" ON storage.objects;
CREATE POLICY "Admins update popup images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'popup-ads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete popup images" ON storage.objects;
CREATE POLICY "Admins delete popup images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'popup-ads' AND public.has_role(auth.uid(), 'admin'));