CREATE TABLE public.onboarding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  roadmap jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding TO authenticated;
GRANT ALL ON public.onboarding TO service_role;
ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own onboarding" ON public.onboarding FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);