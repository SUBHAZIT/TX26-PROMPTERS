
-- Add image_url and admin_approved to submissions table
ALTER TABLE public.submissions ADD COLUMN image_url text;
ALTER TABLE public.submissions ADD COLUMN admin_approved boolean NOT NULL DEFAULT false;

-- Add round 4 (final round) to round_state
INSERT INTO public.round_state (round_number, status) VALUES (4, 'pending')
ON CONFLICT DO NOTHING;

-- Update the qualified_teams table to support round tracking better
-- We'll use this to track which teams advance from each round
