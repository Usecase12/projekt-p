CREATE TABLE public.analysis_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  trade_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  signal text NOT NULL,
  price numeric NOT NULL,
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  r_multiple numeric,
  upside_pct numeric,
  horizon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, trade_date)
);
CREATE INDEX analysis_history_symbol_date_idx ON public.analysis_history (symbol, trade_date DESC);
GRANT SELECT ON public.analysis_history TO anon, authenticated;
GRANT ALL ON public.analysis_history TO service_role;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read analysis history" ON public.analysis_history FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ai_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  trade_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, trade_date)
);
GRANT SELECT ON public.ai_analysis TO anon, authenticated;
GRANT ALL ON public.ai_analysis TO service_role;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ai analysis" ON public.ai_analysis FOR SELECT TO anon, authenticated USING (true);