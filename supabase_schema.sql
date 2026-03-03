-- =========================================================
-- MIKIR DATABASE SCHEMA (NEURO EDITION)
-- =========================================================

-- 1. Tabel Quiz
CREATE TABLE IF NOT EXISTS public.generated_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycard_id TEXT NOT NULL,
    title TEXT,
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quizzes_keycard_id ON public.generated_quizzes(keycard_id);

-- 2. Tabel Library
CREATE TABLE IF NOT EXISTS public.library_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycard_id TEXT NOT NULL,
    title TEXT,
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_library_keycard_id ON public.library_materials(keycard_id);

-- 3. Tabel Notes
CREATE TABLE IF NOT EXISTS public.neuro_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycard_id TEXT NOT NULL,
    title TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_keycard_id ON public.neuro_notes(keycard_id);

-- 4. Tabel Neuro-Sync (SRS)
CREATE TABLE IF NOT EXISTS public.neuro_srs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycard_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'quiz_question', 'note', 'library'
    content JSONB NOT NULL,
    easiness FLOAT DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetition INTEGER DEFAULT 0,
    next_review TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_srs_keycard_id ON public.neuro_srs(keycard_id);
CREATE INDEX IF NOT EXISTS idx_srs_next_review ON public.neuro_srs(next_review);

-- ENABLE RLS
ALTER TABLE public.generated_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neuro_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neuro_srs ENABLE ROW LEVEL SECURITY;

-- POLICIES (Isolation by Keycard ID)
CREATE POLICY "Keycard Access" ON public.generated_quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Keycard Access" ON public.library_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Keycard Access" ON public.neuro_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Keycard Access" ON public.neuro_srs FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- STORAGE BUCKET SETUP (Run this in SQL Editor too)
-- =========================================================
-- 1. Create Bucket 'materials'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies
-- Allow public read access to all files in 'materials' bucket
CREATE POLICY "Public Access Materials" ON storage.objects FOR SELECT USING ( bucket_id = 'materials' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload Materials" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'materials' AND auth.role() = 'authenticated' );

-- Allow users to update/delete their own files
CREATE POLICY "Owner Manage Materials" ON storage.objects FOR ALL USING ( bucket_id = 'materials' AND auth.uid() = owner );

