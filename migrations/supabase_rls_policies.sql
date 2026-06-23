-- ─── SUPABASE ROW-LEVEL SECURITY (RLS) POLICIES FOR BLACKHOLE 🌌 ───
-- Execute these commands in the Supabase SQL Editor to enforce ownership isolation at the database layer.

-- 1. Add user_id column referencing auth.users(id) if it does not exist
ALTER TABLE files ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Enable RLS on the files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Authenticated users can insert their own file metadata records
CREATE POLICY "Users can insert their own files" 
ON files 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Policy: Authenticated users can view only their own file records
CREATE POLICY "Users can select their own files" 
ON files 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Policy: Authenticated users can update only their own file records (e.g., tags update)
CREATE POLICY "Users can update their own files" 
ON files 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Policy: Authenticated users can delete only their own file records
CREATE POLICY "Users can delete their own files" 
ON files 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- ─── VERIFICATION QUERY ───
-- Run this query to verify that policies are active on the files table:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'files';
