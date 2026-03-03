import { create } from 'zustand';

interface TeamSession {
  teamId: string;
  leaderName: string;
  section: string;
  sessionToken: string;
}

interface TeamSessionStore {
  session: TeamSession | null;
  setSession: (session: TeamSession | null) => void;
  logout: () => void;
}

export const useTeamSession = create<TeamSessionStore>((set) => {
  const stored = localStorage.getItem('team_session');
  return {
    session: stored ? JSON.parse(stored) : null,
    setSession: (session) => {
      if (session) {
        localStorage.setItem('team_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('team_session');
      }
      set({ session });
    },
    logout: () => {
      localStorage.removeItem('team_session');
      set({ session: null });
    },
  };
});
