-- Setup Script for Storage Buckets and Policies (agendaly-prod)
-- Replicates the structure from agendaly

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('provider-logos', 'provider-logos', true, 5242880, '{"image/png","image/jpeg","image/jpg","image/webp"}'::text[]),
  ('service-images', 'service-images', true, null, null)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Create Policies for bucket: provider-logos
CREATE POLICY "Public Access Logo" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'provider-logos'::text);

CREATE POLICY "Provider Upload Logo" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'provider-logos'::text AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Provider Update Logo" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'provider-logos'::text AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Provider Delete Logo" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'provider-logos'::text AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Create Policies for bucket: service-images
CREATE POLICY "Service images are publicly accessible" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'service-images'::text);

CREATE POLICY "Providers can upload service images" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (
  bucket_id = 'service-images'::text 
  AND auth.role() = 'authenticated'::text 
  AND EXISTS (SELECT 1 FROM providers WHERE providers.auth_user_id = auth.uid())
);

CREATE POLICY "Providers can update their service images" 
ON storage.objects FOR UPDATE 
TO public 
USING (
  bucket_id = 'service-images'::text 
  AND auth.role() = 'authenticated'::text 
  AND EXISTS (SELECT 1 FROM providers WHERE providers.auth_user_id = auth.uid())
);

CREATE POLICY "Providers can delete their service images" 
ON storage.objects FOR DELETE 
TO public 
USING (
  bucket_id = 'service-images'::text 
  AND auth.role() = 'authenticated'::text 
  AND EXISTS (SELECT 1 FROM providers WHERE providers.auth_user_id = auth.uid())
);
