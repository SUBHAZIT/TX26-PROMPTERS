import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, Users, HelpCircle, Play, Square, Eye, Download, Trash2, Plus, Trophy, AlertTriangle, LogOut, CheckCircle, XCircle, Image, RotateCcw, UserCheck, UserX, ChevronLeft, ChevronRight, Check, Clock } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [roundStates, setRoundStates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [qualifiedTeams, setQualifiedTeams] = useState<any[]>([]);

  // Filters
  const [reviewRound, setReviewRound] = useState('1');
  const [reviewQuestion, setReviewQuestion] = useState('1');
  const [reviewSection, setReviewSection] = useState('ALL');

  // New: Question round filter for adding questions
  const [questionRoundFilter, setQuestionRoundFilter] = useState('1');
  const [nextQuestionNumber, setNextQuestionNumber] = useState(1);

  // New: Review popup state
  const [reviewPopupOpen, setReviewPopupOpen] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // New team form
  const [newTeamId, setNewTeamId] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newSection, setNewSection] = useState('A');

  // New question form
  const [newQ, setNewQ] = useState({
    round_number: 1, question_number: 1, question_text: '', question_type: 'image_recognition',
    correct_answer: '', timer_seconds: 10, image_url: '',
  });

  const fetchAll = async () => {
    const [t, q, r, l, s, qt] = await Promise.all([
      supabase.from('teams').select('*').order('team_id'),
      supabase.from('questions').select('*').order('round_number').order('question_number'),
      supabase.from('round_state').select('*').order('round_number'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('submissions').select('*').order('submitted_at'),
      supabase.from('qualified_teams').select('*'),
    ]);
    if (t.data) setTeams(t.data);
    if (q.data) setQuestions(q.data);
    if (r.data) setRoundStates(r.data);
    if (l.data) setLogs(l.data);
    if (s.data) setSubmissions(s.data);
    if (qt.data) setQualifiedTeams(qt.data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/admin');
    });
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  // Auto-update next question number when round filter changes
  useEffect(() => {
    const roundQuestions = questions.filter(q => q.round_number === Number(questionRoundFilter));
    const maxQNum = roundQuestions.length > 0 ? Math.max(...roundQuestions.map(q => q.question_number)) : 0;
    setNextQuestionNumber(maxQNum + 1);
    setNewQ(prev => ({ ...prev, round_number: Number(questionRoundFilter), question_number: maxQNum + 1 }));
  }, [questionRoundFilter, questions]);

  // Open review popup
  const openReviewPopup = (index: number) => {
    setCurrentReviewIndex(index);
    const sub = filteredSubs[index];
    setCurrentReviewId(sub?.id || null);
    setReviewPopupOpen(true);
  };

  // Handle accept/reject in popup
  const handleReviewAction = async (approved: boolean) => {
    if (!currentReviewId) return;
    
    setReviewActionLoading(true);
    await supabase.from('submissions').update({ admin_approved: approved }).eq('id', currentReviewId);
    await fetchAll();
    setReviewActionLoading(false);
    
    // Move to next or close
    if (currentReviewIndex < filteredSubs.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
      // Update the current review ID for the next item
      const nextSub = filteredSubs[currentReviewIndex + 1];
      setCurrentReviewId(nextSub?.id || null);
    } else if (filteredSubs.length > 1) {
      setCurrentReviewIndex(0);
      const firstSub = filteredSubs[0];
      setCurrentReviewId(firstSub?.id || null);
    } else {
      setReviewPopupOpen(false);
      setCurrentReviewId(null);
    }
  };

  // Navigate in popup
  const goToPrevReview = () => {
    const newIndex = Math.max(0, currentReviewIndex - 1);
    setCurrentReviewIndex(newIndex);
    const prevSub = filteredSubs[newIndex];
    setCurrentReviewId(prevSub?.id || null);
  };
  
  const goToNextReview = () => {
    const newIndex = Math.min(filteredSubs.length - 1, currentReviewIndex + 1);
    setCurrentReviewIndex(newIndex);
    const nextSub = filteredSubs[newIndex];
    setCurrentReviewId(nextSub?.id || null);
  };

  // Team management
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  const addTeam = async () => {
    if (!newTeamId || !newLeaderName) return;
    setTeamError(null);
    setTeamSuccess(null);
    
    const { error } = await supabase.from('teams').insert([{ team_id: newTeamId, leader_name: newLeaderName, section: newSection }]);
    if (error) {
      console.error('Error adding team:', error);
      setTeamError(error.message);
      return;
    }
    setTeamSuccess('Team added successfully!');
    setNewTeamId(''); setNewLeaderName('');
    fetchAll();
    setTimeout(() => setTeamSuccess(null), 3000);
  };

  const deleteTeam = async (teamId: string) => {
    setTeamError(null);
    setTeamSuccess(null);
    
    // First delete related records from child tables to avoid foreign key constraint violation
    await supabase.from('submissions').delete().eq('team_id', teamId);
    await supabase.from('qualified_teams').delete().eq('team_id', teamId);
    await supabase.from('round3_submissions').delete().eq('team_id', teamId);
    await supabase.from('activity_logs').delete().eq('team_id', teamId);
    
    // Now delete the team
    const { error } = await supabase.from('teams').delete().eq('team_id', teamId);
    if (error) {
      console.error('Error deleting team:', error);
      setTeamError(`Error deleting team: ${error.message}`);
      return;
    }
    setTeamSuccess('Team deleted successfully!');
    fetchAll();
    setTimeout(() => setTeamSuccess(null), 3000);
  };

  const disqualifyTeam = async (teamId: string) => {
    // First remove from qualified_teams if present
    await supabase.from('qualified_teams').delete().eq('team_id', teamId);
    // Update team status
    await supabase.from('teams').update({ status: 'disqualified', suspicious_flag: true }).eq('team_id', teamId);
    setTeamSuccess(`Team ${teamId} has been disqualified and removed from all rounds!`);
    fetchAll();
    setTimeout(() => setTeamSuccess(null), 5000);
  };

  const requalifyTeam = async (teamId: string) => {
    await supabase.from('teams').update({ status: 'active', suspicious_flag: false, warning_count: 0 }).eq('team_id', teamId);
    fetchAll();
  };

  // Question management
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSuccess, setQuestionSuccess] = useState(false);

  const addQuestion = async () => {
    setQuestionError(null);
    setQuestionSuccess(false);
    
    try {
      const { error } = await supabase.from('questions').insert([{
        round_number: newQ.round_number,
        question_number: newQ.question_number,
        question_text: newQ.question_text || null,
        question_type: newQ.question_type,
        correct_answer: newQ.correct_answer || null,
        timer_seconds: newQ.timer_seconds,
        image_url: newQ.image_url || null,
        options: null,
      }]);
      
      if (error) {
        console.error('Error adding question:', error);
        setQuestionError(error.message);
        return;
      }
      
      setQuestionSuccess(true);
      setNewQ({
        round_number: 1, 
        question_number: newQ.question_number + 1, 
        question_text: '', 
        question_type: 'image_recognition',
        correct_answer: '', 
        timer_seconds: 10, 
        image_url: '',
      });
      fetchAll();
      
      setTimeout(() => setQuestionSuccess(false), 3000);
    } catch (e) {
      console.error('Exception adding question:', e);
      setQuestionError(String(e));
    }
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    fetchAll();
  };

  // Image upload for questions
  const handleImageUpload = async (file: File) => {
    const path = `questions/${Date.now()}_${file.name}`;
    await supabase.storage.from('competition-images').upload(path, file);
    const { data } = supabase.storage.from('competition-images').getPublicUrl(path);
    setNewQ({ ...newQ, image_url: data.publicUrl });
  };

  // Round control - always restartable
  const startRound = async (roundNumber: number) => {
    // Reset round to countdown then active
    await supabase.from('round_state').update({
      status: 'countdown', started_at: new Date().toISOString(),
      current_question: 1, question_started_at: null, ended_at: null,
    }).eq('round_number', roundNumber);

    setTimeout(async () => {
      await supabase.from('round_state').update({
        status: 'active', question_started_at: new Date().toISOString(),
      }).eq('round_number', roundNumber);
      fetchAll();
    }, 5500);
    fetchAll();
  };

  const resetRound = async (roundNumber: number) => {
    await supabase.from('round_state').update({
      status: 'pending', started_at: null, ended_at: null,
      current_question: 1, question_started_at: null,
    }).eq('round_number', roundNumber);
    fetchAll();
  };

  const nextQuestion = async (roundNumber: number) => {
    const round = roundStates.find(r => r.round_number === roundNumber);
    if (!round) return;
    await supabase.from('round_state').update({
      current_question: (round.current_question || 1) + 1,
      question_started_at: new Date().toISOString(),
    }).eq('round_number', roundNumber);
    fetchAll();
  };

  const endRound = async (roundNumber: number) => {
    await supabase.from('round_state').update({
      status: 'completed', ended_at: new Date().toISOString(),
    }).eq('round_number', roundNumber);
    fetchAll();
  };

  // Approve / Reject submissions
  const toggleApproval = async (id: string, current: boolean) => {
    await supabase.from('submissions').update({ admin_approved: !current }).eq('id', id);
    fetchAll();
  };

  // Auto-select winners for a round
  const autoSelectWinners = async (roundNumber: number, topN: number) => {
    const roundSubs = submissions.filter(s =>
      s.round_number === roundNumber && s.admin_approved && s.image_url
    );

    const teamApprovals: Record<string, { count: number; earliestTime: string; section: string }> = {};
    roundSubs.forEach(s => {
      const team = teams.find(t => t.team_id === s.team_id);
      if (!team) return;
      if (!teamApprovals[s.team_id]) {
        teamApprovals[s.team_id] = { count: 0, earliestTime: s.submitted_at, section: team.section };
      }
      teamApprovals[s.team_id].count++;
      if (new Date(s.submitted_at) < new Date(teamApprovals[s.team_id].earliestTime)) {
        teamApprovals[s.team_id].earliestTime = s.submitted_at;
      }
    });

    const ranked = Object.entries(teamApprovals)
      .sort(([, a], [, b]) => {
        if (b.count !== a.count) return b.count - a.count;
        return new Date(a.earliestTime).getTime() - new Date(b.earliestTime).getTime();
      });

    if (roundNumber <= 3) {
      const sectionA = ranked.filter(([, v]) => v.section === 'A').slice(0, topN);
      const sectionB = ranked.filter(([, v]) => v.section === 'B').slice(0, topN);
      const winners = [...sectionA, ...sectionB];

      await supabase.from('qualified_teams').delete().eq('qualified_from_round', roundNumber);

      for (const [teamId] of winners) {
        await supabase.from('qualified_teams').insert([{
          team_id: teamId, qualified_from_round: roundNumber,
        }]);
      }
    } else {
      const winners = ranked.slice(0, topN);
      await supabase.from('qualified_teams').delete().eq('qualified_from_round', roundNumber);
      for (const [teamId] of winners) {
        await supabase.from('qualified_teams').insert([{
          team_id: teamId, qualified_from_round: roundNumber,
        }]);
      }
    }
    fetchAll();
  };

  // Manually add/remove qualified teams
  const addQualifiedTeam = async (teamId: string, roundNumber: number) => {
    await supabase.from('qualified_teams').insert([{ team_id: teamId, qualified_from_round: roundNumber }]);
    fetchAll();
  };

  const removeQualifiedTeam = async (id: string) => {
    await supabase.from('qualified_teams').delete().eq('id', id);
    fetchAll();
  };

  // CSV export
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => JSON.stringify(v ?? '')).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  // Filtered submissions for review
  const filteredSubs = submissions.filter(s => {
    if (s.round_number !== Number(reviewRound)) return false;
    if (s.question_number !== Number(reviewQuestion)) return false;
    if (reviewSection !== 'ALL') {
      const team = teams.find(t => t.team_id === s.team_id);
      if (!team || team.section !== reviewSection) return false;
    }
    return true;
  }).filter(s => s.image_url);

  const roundConfig: Record<number, { questions: number; topN: number; label: string }> = {
    1: { questions: 3, topN: 50, label: 'Round 1 - Image Search' },
    2: { questions: 6, topN: 20, label: 'Round 2 - Hints + Search' },
    3: { questions: 5, topN: 5, label: 'Round 3 - AI Recreation' },
    4: { questions: 5, topN: 3, label: 'Final Round' },
  };

  // For manual qualification input
  const [manualTeamId, setManualTeamId] = useState('');
  const [manualRound, setManualRound] = useState('1');

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display text-sm uppercase tracking-wider text-accent">Admin Control Center</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.open('/projector', '_blank')} className="font-mono text-xs">
            <Eye className="w-4 h-4 mr-1" /> Projector
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/winners', '_blank')} className="font-mono text-xs">
            <Trophy className="w-4 h-4 mr-1" /> Winners Page
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="p-6">
        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="bg-secondary mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="teams" className="font-mono text-xs"><Users className="w-4 h-4 mr-1" /> Teams</TabsTrigger>
            <TabsTrigger value="questions" className="font-mono text-xs"><HelpCircle className="w-4 h-4 mr-1" /> Questions</TabsTrigger>
            <TabsTrigger value="rounds" className="font-mono text-xs"><Play className="w-4 h-4 mr-1" /> Rounds</TabsTrigger>
            <TabsTrigger value="review" className="font-mono text-xs"><Image className="w-4 h-4 mr-1" /> Review</TabsTrigger>
            <TabsTrigger value="winners" className="font-mono text-xs"><Trophy className="w-4 h-4 mr-1" /> Winners</TabsTrigger>
            <TabsTrigger value="logs" className="font-mono text-xs"><AlertTriangle className="w-4 h-4 mr-1" /> Logs</TabsTrigger>
          </TabsList>

          {/* TEAMS TAB */}
          <TabsContent value="teams">
            {teamError && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded-lg mb-4 text-sm">
                Error: {teamError}
              </div>
            )}
            {teamSuccess && (
              <div className="bg-primary/10 border border-primary text-primary px-3 py-2 rounded-lg mb-4 text-sm">
                {teamSuccess}
              </div>
            )}
            <div className="glass-panel p-6 mb-6">
              <h3 className="font-display text-sm uppercase tracking-wider text-primary mb-4">Add Team</h3>
              <div className="flex gap-3 flex-wrap">
                <Input value={newTeamId} onChange={e => setNewTeamId(e.target.value)} placeholder="Team ID" className="bg-secondary font-mono w-40" />
                <Input value={newLeaderName} onChange={e => setNewLeaderName(e.target.value)} placeholder="Leader Name" className="bg-secondary font-mono w-48" />
                <Select value={newSection} onValueChange={setNewSection}>
                  <SelectTrigger className="w-24 bg-secondary font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent>
                </Select>
                <Button onClick={addTeam} size="sm" className="bg-primary text-primary-foreground font-mono"><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
            </div>
            <div className="glass-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-border text-left">
                    <th className="p-3 font-mono text-xs text-muted-foreground">Team ID</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Leader</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Section</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Status</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Warnings</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {teams.map(t => (
                      <tr key={t.team_id} className={`border-b border-border/30 ${t.suspicious_flag ? 'bg-destructive/10' : ''}`}>
                        <td className="p-3 font-mono text-sm">{t.team_id}</td>
                        <td className="p-3 font-mono text-sm">{t.leader_name}</td>
                        <td className="p-3 font-mono text-sm">{t.section}</td>
                        <td className="p-3"><span className={`font-mono text-xs px-2 py-1 rounded ${t.status === 'active' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>{t.status}</span></td>
                        <td className="p-3 font-mono text-sm">{t.warning_count}</td>
                        <td className="p-3 flex gap-2">
                          {t.status === 'active' ? (
                            <Button variant="ghost" size="sm" onClick={() => disqualifyTeam(t.team_id)} className="text-destructive font-mono text-xs">
                              <UserX className="w-3 h-3 mr-1" /> DQ
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => requalifyTeam(t.team_id)} className="text-primary font-mono text-xs">
                              <UserCheck className="w-3 h-3 mr-1" /> Requalify
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => deleteTeam(t.team_id)} className="text-destructive font-mono text-xs"><Trash2 className="w-3 h-3" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-border flex justify-between items-center">
                <span className="font-mono text-xs text-muted-foreground">{teams.length} teams</span>
                <Button variant="ghost" size="sm" onClick={() => exportCSV(teams, 'teams.csv')} className="font-mono text-xs"><Download className="w-4 h-4 mr-1" /> Export</Button>
              </div>
            </div>
          </TabsContent>

          {/* QUESTIONS TAB */}
          <TabsContent value="questions">
            <div className="glass-panel p-6 mb-6">
              <h3 className="font-display text-sm uppercase tracking-wider text-primary mb-4">Add Question</h3>
              
              {/* Round Filter for Adding Questions */}
              <div className="flex gap-3 mb-4">
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">Select Round</label>
                  <Select value={questionRoundFilter} onValueChange={setQuestionRoundFilter}>
                    <SelectTrigger className="w-40 bg-secondary font-mono">
                      <SelectValue placeholder="Select Round" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Round 1</SelectItem>
                      <SelectItem value="2">Round 2</SelectItem>
                      <SelectItem value="3">Round 3</SelectItem>
                      <SelectItem value="4">Final Round</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">Question #</label>
                  <Input 
                    type="number" 
                    value={newQ.question_number} 
                    onChange={e => setNewQ({ ...newQ, question_number: Number(e.target.value) })} 
                    className="bg-secondary font-mono w-24"
                  />
                </div>
                <div className="flex items-end">
                  <span className="font-mono text-xs text-muted-foreground pb-2">
                    {questions.filter(q => q.round_number === Number(questionRoundFilter)).length} questions in Round {questionRoundFilter}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Select value={newQ.question_type} onValueChange={v => setNewQ({ ...newQ, question_type: v })}>
                  <SelectTrigger className="bg-secondary font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image_recognition">Image Recognition</SelectItem>
                    <SelectItem value="text_hint">Text Hint</SelectItem>
                    <SelectItem value="image_mcq">Image MCQ</SelectItem>
                    <SelectItem value="ai_generation">AI Generation</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={newQ.timer_seconds} onChange={e => setNewQ({ ...newQ, timer_seconds: Number(e.target.value) })} placeholder="Timer (s)" className="bg-secondary font-mono" />
              </div>
              <Textarea value={newQ.question_text} onChange={e => setNewQ({ ...newQ, question_text: e.target.value })} placeholder="Question text / hint (for text_hint type)" className="bg-secondary font-mono mb-3" />
              <div className="flex gap-3 items-center mb-3">
                <Input value={newQ.image_url} onChange={e => setNewQ({ ...newQ, image_url: e.target.value })} placeholder="Image URL (or upload)" className="bg-secondary font-mono flex-1" />
                <label className="cursor-pointer">
                  <span className="bg-secondary px-3 py-2 rounded font-mono text-xs border border-border hover:border-primary transition-colors">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </label>
              </div>
              {newQ.image_url && <img src={newQ.image_url} alt="Preview" className="w-24 h-24 object-cover rounded-lg mb-3 border border-border" />}
              {questionError && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded-lg mb-3 text-sm">
                  Error: {questionError}
                </div>
              )}
              {questionSuccess && (
                <div className="bg-primary/10 border border-primary text-primary px-3 py-2 rounded-lg mb-3 text-sm">
                  Question added successfully!
                </div>
              )}
              <Button onClick={addQuestion} className="bg-primary text-primary-foreground font-mono"><Plus className="w-4 h-4 mr-1" /> Add Question</Button>
            </div>
            <div className="glass-panel overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-border text-left">
                  <th className="p-3 font-mono text-xs text-muted-foreground">R#</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Q#</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Type</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Text/Hint</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Image</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Timer</th>
                  <th className="p-3 font-mono text-xs text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {questions.map(q => (
                    <tr key={q.id} className="border-b border-border/30">
                      <td className="p-3 font-mono text-sm">{q.round_number}</td>
                      <td className="p-3 font-mono text-sm">{q.question_number}</td>
                      <td className="p-3 font-mono text-xs">{q.question_type}</td>
                      <td className="p-3 font-mono text-sm max-w-[200px] truncate">{q.question_text || '-'}</td>
                      <td className="p-3">{q.image_url ? <img src={q.image_url} className="w-12 h-12 object-cover rounded" /> : '-'}</td>
                      <td className="p-3 font-mono text-sm">{q.timer_seconds}s</td>
                      <td className="p-3"><Button variant="ghost" size="sm" onClick={() => deleteQuestion(q.id)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ROUNDS TAB - All buttons always available */}
          <TabsContent value="rounds">
            <div className="space-y-6">
              {roundStates.map(round => {
                const cfg = roundConfig[round.round_number];
                return (
                  <motion.div key={round.round_number} className="glass-panel neon-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display text-lg text-primary">{cfg?.label || `Round ${round.round_number}`}</h3>
                        <p className="font-mono text-xs text-muted-foreground">
                          {cfg?.questions} questions • Top {cfg?.topN} advance
                          {round.current_question && round.status === 'active' && ` • Current Q${round.current_question}`}
                        </p>
                      </div>
                      <span className={`font-mono text-xs px-3 py-1 rounded-full ${
                        round.status === 'active' ? 'bg-primary/20 text-primary neon-glow' :
                        round.status === 'completed' ? 'bg-muted text-muted-foreground' :
                        round.status === 'countdown' ? 'bg-accent/20 text-accent' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {round.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={() => startRound(round.round_number)} className="bg-primary text-primary-foreground font-mono">
                        <Play className="w-4 h-4 mr-1" /> {round.status === 'completed' ? 'Restart' : 'Start'}
                      </Button>
                      {round.status === 'active' && (
                        <Button onClick={() => nextQuestion(round.round_number)} className="bg-accent text-accent-foreground font-mono">
                          Next Q ({(round.current_question || 1) + 1})
                        </Button>
                      )}
                      {(round.status === 'active' || round.status === 'countdown') && (
                        <Button onClick={() => endRound(round.round_number)} variant="destructive" className="font-mono">
                          <Square className="w-4 h-4 mr-1" /> End
                        </Button>
                      )}
                      <Button onClick={() => resetRound(round.round_number)} variant="outline" className="font-mono">
                        <RotateCcw className="w-4 h-4 mr-1" /> Reset
                      </Button>
                      <Button onClick={() => autoSelectWinners(round.round_number, cfg?.topN || 3)} variant="outline" className="font-mono">
                        <Trophy className="w-4 h-4 mr-1" /> Auto-Select Top {cfg?.topN}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* REVIEW TAB */}
          <TabsContent value="review">
            <div className="glass-panel p-6 mb-6">
              <h3 className="font-display text-sm uppercase tracking-wider text-primary mb-4">Review Submissions</h3>
              <div className="flex gap-3 flex-wrap mb-4">
                <Select value={reviewRound} onValueChange={setReviewRound}>
                  <SelectTrigger className="w-32 bg-secondary font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Round 1</SelectItem><SelectItem value="2">Round 2</SelectItem>
                    <SelectItem value="3">Round 3</SelectItem><SelectItem value="4">Final</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={reviewQuestion} onValueChange={setReviewQuestion}>
                  <SelectTrigger className="w-28 bg-secondary font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>Q{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={reviewSection} onValueChange={setReviewSection}>
                  <SelectTrigger className="w-28 bg-secondary font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem><SelectItem value="A">Section A</SelectItem><SelectItem value="B">Section B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {filteredSubs.length} submissions • Approved: {filteredSubs.filter(s => s.admin_approved).length}
              </p>
            </div>

            {/* Grid view with team name + view icon */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredSubs.map((sub, index) => {
                const team = teams.find(t => t.team_id === sub.team_id);
                return (
                  <motion.div
                    key={sub.id}
                    className={`glass-panel p-4 rounded-xl cursor-pointer transition-all ${
                      sub.admin_approved ? 'ring-2 ring-primary neon-box-glow' : 'border border-border/30'
                    }`}
                    onClick={() => openReviewPopup(index)}
                    whileHover={{ scale: 1.02 }}
                  >
                    {/* Team Name - Primary Display */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-sm font-bold truncate">{sub.team_id}</p>
                      <span className="font-mono text-xs text-muted-foreground">{team?.section}</span>
                    </div>
                    
                    {/* View Upload Icon */}
                    <div className="w-full h-24 bg-secondary/50 rounded-lg flex items-center justify-center mb-2">
                      <div className="text-center">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                        <span className="font-mono text-xs text-muted-foreground">View Upload</span>
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-muted-foreground">{new Date(sub.submitted_at).toLocaleTimeString()}</p>
                      {sub.admin_approved ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          <CheckCircle className="w-3 h-3" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          <XCircle className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {filteredSubs.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="font-mono text-muted-foreground">No submissions with images for this question yet.</p>
                </div>
              )}
            </div>

            {/* Review Popup Dialog */}
            <Dialog open={reviewPopupOpen} onOpenChange={(open) => {
              setReviewPopupOpen(open);
              if (!open) setCurrentReviewId(null);
            }}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl">
                    Review Submission - {filteredSubs[currentReviewIndex]?.team_id}
                  </DialogTitle>
                  <DialogDescription>
                    Round {reviewRound} • Question {reviewQuestion} • {teams.find(t => t.team_id === filteredSubs[currentReviewIndex]?.team_id)?.section}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Images Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Given Image */}
                    <div className="space-y-2">
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Given Image</p>
                      <div className="aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
                        {(() => {
                          const question = questions.find(q => 
                            q.round_number === Number(reviewRound) && 
                            q.question_number === Number(reviewQuestion)
                          );
                          return question?.image_url ? (
                            <img 
                              src={question.image_url} 
                              alt="Given" 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <p className="font-mono text-xs text-muted-foreground">No image for this question</p>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Uploaded Image */}
                    <div className="space-y-2">
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Uploaded Submission</p>
                      <div className="aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
                        {filteredSubs[currentReviewIndex]?.image_url ? (
                          <img 
                            src={filteredSubs[currentReviewIndex].image_url} 
                            alt="Submission" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <p className="font-mono text-xs text-muted-foreground">No image uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Submission Details */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-muted-foreground">
                      Submitted: {filteredSubs[currentReviewIndex] ? new Date(filteredSubs[currentReviewIndex].submitted_at).toLocaleString() : ''}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      Prompt: {filteredSubs[currentReviewIndex]?.answer || 'N/A'}
                    </span>
                  </div>
                  
                  {/* Navigation & Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={goToPrevReview}
                        disabled={currentReviewIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                      <span className="font-mono text-xs text-muted-foreground">
                        {currentReviewIndex + 1} / {filteredSubs.length}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={goToNextReview}
                        disabled={currentReviewIndex === filteredSubs.length - 1}
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="destructive" 
                        onClick={() => handleReviewAction(false)}
                        disabled={reviewActionLoading}
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </Button>
                      <Button 
                        variant="default"
                        onClick={() => handleReviewAction(true)}
                        disabled={reviewActionLoading}
                        className="bg-primary gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* WINNERS TAB - with manual add/remove and confirm */}
          <TabsContent value="winners">
            <div className="space-y-6">
              {/* Manual qualification controls */}
              <div className="glass-panel p-6">
                <h3 className="font-display text-sm uppercase tracking-wider text-primary mb-4">Manual Qualification</h3>
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="font-mono text-xs text-muted-foreground block mb-1">Team ID</label>
                    <Input value={manualTeamId} onChange={e => setManualTeamId(e.target.value)} placeholder="Team ID" className="bg-secondary font-mono w-40" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground block mb-1">Round</label>
                    <Select value={manualRound} onValueChange={setManualRound}>
                      <SelectTrigger className="w-32 bg-secondary font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Round 1</SelectItem><SelectItem value="2">Round 2</SelectItem>
                        <SelectItem value="3">Round 3</SelectItem><SelectItem value="4">Final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => { if (manualTeamId) { addQualifiedTeam(manualTeamId, Number(manualRound)); setManualTeamId(''); } }} className="bg-primary text-primary-foreground font-mono">
                    <UserCheck className="w-4 h-4 mr-1" /> Add Qualified
                  </Button>
                </div>
              </div>

              {[1, 2, 3, 4].map(rn => {
                const cfg = roundConfig[rn];
                const qualified = qualifiedTeams.filter(q => q.qualified_from_round === rn);
                return (
                  <div key={rn} className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg text-primary">{cfg?.label}</h3>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => autoSelectWinners(rn, cfg?.topN || 3)} className="bg-primary text-primary-foreground font-mono text-xs">
                          <Trophy className="w-4 h-4 mr-1" /> Re-Select Top {cfg?.topN}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exportCSV(qualified, `round${rn}_qualified.csv`)} className="font-mono text-xs">
                          <Download className="w-4 h-4 mr-1" /> Export
                        </Button>
                      </div>
                    </div>
                    {qualified.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {qualified.map((q, i) => {
                          const team = teams.find(t => t.team_id === q.team_id);
                          return (
                            <div key={q.id} className={`glass-panel p-3 rounded-lg text-center relative group ${i < 3 && rn === 4 ? 'neon-border neon-box-glow' : ''}`}>
                              {i < 3 && rn === 4 && <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />}
                              <p className="font-mono text-sm font-bold">{q.team_id}</p>
                              <p className="font-mono text-xs text-muted-foreground">{team?.section || ''}</p>
                              {rn === 4 && <p className="font-display text-xs text-primary mt-1">#{i + 1}</p>}
                              <button
                                onClick={() => removeQualifiedTeam(q.id)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                                title="Remove qualification"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="font-mono text-sm text-muted-foreground">No qualifications announced yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs">
            <div className="glass-panel overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display text-sm uppercase tracking-wider text-primary">Activity Logs</h3>
                <Button variant="ghost" size="sm" onClick={() => exportCSV(logs, 'activity_logs.csv')} className="font-mono text-xs"><Download className="w-4 h-4 mr-1" /> Export</Button>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-border text-left sticky top-0 bg-card">
                    <th className="p-3 font-mono text-xs text-muted-foreground">Time</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Team</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Event</th>
                    <th className="p-3 font-mono text-xs text-muted-foreground">Details</th>
                  </tr></thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className={`border-b border-border/30 ${
                        log.event_type.includes('disqualification') ? 'bg-destructive/10' :
                        log.event_type === 'tab_switch' ? 'bg-accent/10' : ''
                      }`}>
                        <td className="p-3 font-mono text-xs">{new Date(log.created_at).toLocaleTimeString()}</td>
                        <td className="p-3 font-mono text-xs">{log.team_id}</td>
                        <td className="p-3 font-mono text-xs">{log.event_type}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate">{JSON.stringify(log.metadata)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
