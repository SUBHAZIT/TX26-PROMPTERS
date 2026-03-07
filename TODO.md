# TODO - Fix Real-time Qualify/Disqualify/Elimination Popups

## Issue
When admin releases top teams (qualify/disqualify) in admin dashboard, the competition page should instantly show the popup without manual refresh.

## Fix Plan

### Step 1: Fix Competition.tsx - Add proper real-time subscriptions
- [x] 1.1 Ensure team status subscription correctly updates isDisqualified state
- [x] 1.2 Add subscription for qualified_teams that calls checkEliminationStatus
- [x] 1.3 Fix the checkEliminationStatus to use fresh state
- [x] 1.4 Ensure useEffect dependencies are correct
- [x] 1.5 Add realtime subscription to teams table
- [x] 1.6 Add realtime subscription to qualified_teams table  
- [x] 1.7 Add realtime subscription to round_state table
- [x] 1.8 Proper cleanup with supabase.removeChannel

### Step 2: Enable realtime in Supabase
- [x] 2.1 Create migration to enable realtime on teams table
- [x] 2.2 realtime on qualified_ Create migration to enableteams table

### Step 3: Test the fix
- [ ] 3.1 Run the migration in Supabase: `supabase db push` or apply the SQL
- [ ] 3.2 Test disqualification - should instantly show DisqualificationOverlay
- [ ] 3.3 Test qualification - should instantly show EliminationOverlay (Qualified)
- [ ] 3.4 Test elimination - should instantly show EliminationOverlay (Eliminated)

## Summary of Changes Made:

### 1. SQL Migration (NEW FILE):
- Created `supabase/migrations/20260303120000_enable_realtime.sql` to enable realtime on teams and qualified_teams tables

### 2. Competition.tsx (COMPLETE REWRITE):
- **Teams Realtime Channel**: Listens for UPDATE on teams table filtered by team_id
  - When status changes to 'disqualified' → immediately sets isDisqualified(true)
  - Clears eliminationState to show disqualification overlay
  
- **Qualified Teams Realtime Channel**: Listens for INSERT/DELETE/UPDATE on qualified_teams table
  - When team is added → shows "Qualified" overlay
  - When team is removed → shows "Eliminated" overlay
  
- **Round State Realtime Channel**: Listens for changes on round_state table
  - Triggers elimination status check when round completes

- **Proper Cleanup**: All channels are properly cleaned up on unmount using supabase.removeChannel

### IMPORTANT - Next Step Required:
Run the migration to enable realtime:
```bash
cd supabase && supabase db push
```
Or apply the SQL in Supabase dashboard:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qualified_teams;
```

