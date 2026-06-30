CREATE POLICY "Users can delete profiles" ON public.profiles FOR DELETE USING (auth.role() = 'authenticated');
