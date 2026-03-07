# TODO - State-Based Access Control System

## Task: Implement strict state-based access control for competition players

### Steps:

- [x] 1. Analyze codebase and understand existing structure
- [x] 2. Create `useTeamAccessControl` hook with:
  - [x] State tracking: isDisqualified, isEliminated, isQualified
  - [x] Real-time subscriptions on teams, qualified_teams, round_state tables
  - [x] Permanent elimination logic (once eliminated, always eliminated)
  - [x] Re-qualification logic when disqualification is lifted
- [x] 3. Update Competition.tsx to use the new hook
- [x] 4. Verify logic gate wraps Round components correctly
- [x] 5. Verify priority order: Disqualified > Eliminated > Qualified > Active

### Key Requirements:
- Disqualified: Show DisqualificationOverlay, re-qualify if admin sets back to false
- Eliminated: PERMANENT - once true, never re-enter
- Qualified: Show "Qualified!" success until next round starts
- Priority: Disqualified (Highest) → Eliminated → Qualified → Active Play

