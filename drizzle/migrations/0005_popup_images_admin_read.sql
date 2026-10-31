DROP POLICY IF EXISTS "Admins read popup images" ON storage.objects;
CREATE POLICY "Admins read popup images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'popup-ads' AND public.has_role(auth.uid(), 'admin'));