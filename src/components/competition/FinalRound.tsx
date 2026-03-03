import { ImageUploadQuestion } from './ImageUploadQuestion';

interface FinalRoundProps {
  question: {
    question_number: number;
    timer_seconds: number;
    question_text: string | null;
  };
  questionStartedAt: string | null;
  onSubmitted: () => void;
}

export function FinalRound({ question, questionStartedAt, onSubmitted }: FinalRoundProps) {
  return (
    <ImageUploadQuestion
      roundNumber={4}
      questionNumber={question.question_number}
      totalQuestions={5}
      questionStartedAt={questionStartedAt}
      timerSeconds={question.timer_seconds}
      showPromptField
      onSubmitted={onSubmitted}
    />
  );
}
