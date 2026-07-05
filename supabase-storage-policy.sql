-- Allow anonymous uploads to the resumes bucket (website forms need this)
-- and public read (so the CRM can display/download links directly)
CREATE POLICY "Anyone can upload resumes" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Anyone can read resumes" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'resumes');
