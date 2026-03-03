import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RoundState {
  round_number: number;
  status: string;
  current_question: number | null;
  question_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export function useRoundState() {
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRounds = async () => {
    try {
      const { data, error: err } = await supabase
        .from('round_state')
        .select('*')
        .order('round_number');
      
      if (err) {
        console.error('Error fetching rounds:', err);
        setError(err.message);
      }
      
      if (data) setRounds(data as RoundState[]);
      setLoading(false);
    } catch (e) {
      console.error('Exception fetching rounds:', e);
      setError(String(e));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();

    const channel = supabase
      .channel('round_state_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'round_state' 
      }, (payload) => {
        console.log('Round state changed:', payload);
        fetchRounds();
      })
      .subscribe((status) => {
        console.log('Round state channel status:', status);
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to round state changes');
        }
      });

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, []);

  const activeRound = rounds.find(r => r.status === 'active' || r.status === 'countdown');

  return { rounds, activeRound, loading, error, refetch: fetchRounds };
}
