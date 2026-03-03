import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeamSession } from './useTeamSession';

export function useAntiCheat() {
  const { session } = useTeamSession();
  const warningCount = useRef(0);

  const logActivity = useCallback(async (eventType: string, metadata?: Record<string, unknown>) => {
    if (!session) return;
    await supabase.from('activity_logs').insert([{
      team_id: session.teamId,
      event_type: eventType,
      metadata: (metadata || {}) as unknown as Record<string, never>,
    }]);
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      warningCount.current++;
      logActivity('right_click', { warning: warningCount.current });
      if (warningCount.current >= 3) {
        logActivity('auto_disqualification', { reason: 'exceeded_warnings' });
        supabase.from('teams').update({ status: 'disqualified', suspicious_flag: true }).eq('team_id', session.teamId).then();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        warningCount.current++;
        logActivity('inspect_attempt', { key: e.key, warning: warningCount.current });
        if (warningCount.current >= 3) {
          logActivity('auto_disqualification', { reason: 'exceeded_warnings' });
          supabase.from('teams').update({ status: 'disqualified', suspicious_flag: true }).eq('team_id', session.teamId).then();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logActivity('tab_switch');
      }
    };

    const handleBeforeUnload = () => {
      logActivity('page_refresh');
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, logActivity]);

  return { logActivity };
}
