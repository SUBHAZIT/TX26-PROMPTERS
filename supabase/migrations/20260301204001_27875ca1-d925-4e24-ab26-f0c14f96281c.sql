
-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE,
  leader_name TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('A', 'B')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disqualified', 'eliminated')),
  total_score INTEGER NOT NULL DEFAULT 0,
  suspicious_flag BOOLEAN NOT NULL DEFAULT false,
  session_token TEXT,
  ip_address TEXT,
  warning_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Round state (tracks current competition state)
CREATE TABLE public.round_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'countdown', 'active', 'completed')),
  current_question INTEGER DEFAULT 1,
  question_started_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  question_text TEXT,
  question_type TEXT NOT NULL CHECK (question_type IN ('image_recognition', 'text_hint', 'image_mcq', 'ai_generation')),
  image_url TEXT,
  correct_answer TEXT,
  options JSONB,
  timer_seconds INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_number, question_number)
);

-- Submissions for rounds 1 & 2
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.teams(team_id),
  round_number INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, round_number, question_number)
);

-- Round 3 submissions (image generation)
CREATE TABLE public.round3_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.teams(team_id) UNIQUE,
  image_url TEXT NOT NULL,
  prompt_text TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_selected BOOLEAN NOT NULL DEFAULT false,
  rank INTEGER
);

-- Round 3 config (reference image)
CREATE TABLE public.round3_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_image_url TEXT,
  timer_minutes INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity logs for anti-cheat
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Qualified teams tracking
CREATE TABLE public.qualified_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.teams(team_id),
  qualified_from_round INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, qualified_from_round)
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round3_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round3_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualified_teams ENABLE ROW LEVEL SECURITY;

-- Admin policies (authenticated = admin)
CREATE POLICY "admin_all_teams" ON public.teams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_round_state" ON public.round_state FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_questions" ON public.questions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_submissions" ON public.submissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_round3_submissions" ON public.round3_submissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_round3_config" ON public.round3_config FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_activity_logs" ON public.activity_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_qualified_teams" ON public.qualified_teams FOR ALL USING (auth.role() = 'authenticated');

-- Anon read policies for team operations
CREATE POLICY "anon_read_teams" ON public.teams FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_teams" ON public.teams FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_round_state" ON public.round_state FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_questions" ON public.questions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_submissions" ON public.submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_submissions" ON public.submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_read_round3_config" ON public.round3_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_round3_submissions" ON public.round3_submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_round3_submissions" ON public.round3_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_activity_logs" ON public.activity_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_read_qualified_teams" ON public.qualified_teams FOR SELECT TO anon USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.round3_submissions;

-- Storage bucket for competition images
INSERT INTO storage.buckets (id, name, public) VALUES ('competition-images', 'competition-images', true);
CREATE POLICY "public_read_competition_images" ON storage.objects FOR SELECT USING (bucket_id = 'competition-images');
CREATE POLICY "anyone_upload_competition_images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'competition-images');
CREATE POLICY "admin_delete_competition_images" ON storage.objects FOR DELETE USING (bucket_id = 'competition-images' AND auth.role() = 'authenticated');

-- Initialize round states
INSERT INTO public.round_state (round_number, status) VALUES (1, 'pending'), (2, 'pending'), (3, 'pending');
