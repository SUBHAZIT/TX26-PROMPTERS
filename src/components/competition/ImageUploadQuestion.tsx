import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTeamSession } from '@/hooks/useTeamSession';
import { CircularTimer } from './CircularTimer';
import { useServerTimer } from '@/hooks/useServerTimer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Check, Camera } from 'lucide-react';

interface ImageUploadQuestionProps {
  roundNumber: number;
  questionNumber: number;
  totalQuestions: number;
  questionStartedAt: string | null;
  timerSeconds: number;
  questionText?: string | null;
  showPromptField?: boolean;
  onSubmitted: () => void;
}

export function ImageUploadQuestion({
  roundNumber,
  questionNumber,
  totalQuestions,
  questionStartedAt,
  timerSeconds,
  questionText,
  showPromptField = false,
  onSubmitted,
}: ImageUploadQuestionProps) {
  const { session } = useTeamSession();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const submittedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { timeLeft, isExpired } = useServerTimer({
    questionStartedAt,
    timerSeconds,
    isActive: true,
  });

  // Reset state when question changes
  useEffect(() => {
    setImageFile(null);
    setImagePreview(null);
    setPromptText('');
    setSubmitted(false);
    submittedRef.current = false;
    setUploading(false);
  }, [questionNumber, roundNumber]);

  // Check if already submitted
  useEffect(() => {
    if (!session) return;
    supabase
      .from('submissions')
      .select('id')
      .eq('team_id', session.teamId)
      .eq('round_number', roundNumber)
      .eq('question_number', questionNumber)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSubmitted(true);
          submittedRef.current = true;
        }
      });
  }, [session, roundNumber, questionNumber]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!session || submittedRef.current) return;
    if (!imageFile) {
      // Auto-submit empty on expire
      submittedRef.current = true;
      await supabase.from('submissions').insert([{
        team_id: session.teamId,
        round_number: roundNumber,
        question_number: questionNumber,
        answer: promptText || null,
        image_url: null,
        is_correct: false,
        score: 0,
      }]);
      setSubmitted(true);
      onSubmitted();
      return;
    }

    setUploading(true);
    submittedRef.current = true;
    const ext = imageFile.name.split('.').pop();
    const path = `r${roundNumber}/q${questionNumber}/${session.teamId}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('competition-images')
      .upload(path, imageFile, { upsert: true });

    if (uploadError) {
      submittedRef.current = false;
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('competition-images')
      .getPublicUrl(path);

    await supabase.from('submissions').insert([{
      team_id: session.teamId,
      round_number: roundNumber,
      question_number: questionNumber,
      answer: promptText || null,
      image_url: urlData.publicUrl,
      is_correct: false,
      score: 0,
    }]);

    setSubmitted(true);
    setUploading(false);
    onSubmitted();
  };

  // Auto-submit on expire
  useEffect(() => {
    if (isExpired && !submittedRef.current) {
      handleSubmit();
    }
  }, [isExpired]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between w-full">
        <span className="font-mono text-sm text-muted-foreground">
          Question {questionNumber}/{totalQuestions}
        </span>
        <CircularTimer timeLeft={timeLeft} totalTime={timerSeconds} />
      </div>

      {/* Text hint (for Round 2 text_hint questions) */}
      {questionText && (
        <div className="glass-panel neon-border p-6 w-full rounded-xl">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Hint</p>
          <h3 className="font-display text-xl text-center text-foreground">
            {questionText}
          </h3>
        </div>
      )}

      {/* Note: Images are shown on projector ONLY */}
      <div className="glass-panel p-4 w-full rounded-xl text-center">
        <p className="font-mono text-xs text-muted-foreground mb-1">
          📺 Look at the projector screen for the image
        </p>
        <p className="font-mono text-xs text-primary">
          Search & upload the matching image below
        </p>
      </div>

      {!submitted ? (
        <div className="w-full space-y-4">
          {/* Image upload */}
          <div
            className="glass-panel neon-border p-6 rounded-xl text-center cursor-pointer transition-all hover:border-primary/60"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="space-y-3">
                <img src={imagePreview} alt="Preview" className="max-h-[200px] mx-auto rounded-lg" />
                <p className="font-mono text-xs text-muted-foreground">{imageFile?.name}</p>
                <p className="font-mono text-xs text-primary">Click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <span className="font-mono text-sm text-muted-foreground">Tap to upload image</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isExpired || submitted}
            />
          </div>

          {/* Prompt field (for Round 3/Final) */}
          {showPromptField && (
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the AI prompt you used..."
              disabled={isExpired}
              className="bg-secondary border-border font-mono min-h-[80px]"
            />
          )}

          <Button
            onClick={handleSubmit}
            disabled={!imageFile || isExpired || uploading}
            className="w-full bg-primary text-primary-foreground font-display uppercase tracking-wider text-lg py-6 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2"><Upload className="w-5 h-5" /> Submit Image</span>
            )}
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel neon-border p-8 rounded-xl text-center w-full"
        >
          <Check className="w-12 h-12 text-primary mx-auto mb-3" />
          <p className="font-display text-xl text-primary neon-glow">Image Submitted!</p>
          <p className="font-mono text-sm text-muted-foreground mt-2">Waiting for next question...</p>
        </motion.div>
      )}
    </motion.div>
  );
}
