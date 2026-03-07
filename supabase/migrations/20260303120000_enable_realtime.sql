-- Enable realtime on teams and qualified_teams tables for real-time disqualification/qualification updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qualified_teams;

