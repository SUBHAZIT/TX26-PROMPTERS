# TODO - Disqualification & Real-time Updates

## Step 1: Create DisqualificationOverlay Component
- [x] Create new component for disqualified teams

## Step 2: Update Competition.tsx
- [x] Add team status check on load
- [x] Subscribe to teams table for disqualification status changes
- [x] Subscribe to qualified_teams for real-time updates
- [x] Show disqualification overlay when team is disqualified
- [x] Auto-refresh elimination status without manual refresh

## Step 3: Update AdminDashboard.tsx
- [x] When disqualifying, remove team from qualified_teams table
- [x] Add success message for disqualification action

