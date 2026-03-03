import { ImageUploadQuestion } from './ImageUploadQuestion';

interface Round2Props {
  question: {
    question_number: number;
    timer_seconds: number;
    question_text: string | null;
    question_type: string;
  };
  questionStartedAt: string | null;
  onSubmitted: () => void;
}

export function Round2({ question, questionStartedAt, onSubmitted }: Round2Props) {
  return (
    <ImageUploadQuestion
      roundNumber={2}
      questionNumber={question.question_number}
      totalQuestions={6}
      questionStartedAt={questionStartedAt}
      timerSeconds={question.timer_seconds}
      questionText={question.question_type === 'text_hint' ? question.question_text : undefined}
      onSubmitted={onSubmitted}
    />
  );
}
