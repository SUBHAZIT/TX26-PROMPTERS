import { ImageUploadQuestion } from './ImageUploadQuestion';

interface Round1Props {
  question: {
    question_number: number;
    timer_seconds: number;
    question_text: string | null;
  };
  questionStartedAt: string | null;
  onSubmitted: () => void;
}

export function Round1({ question, questionStartedAt, onSubmitted }: Round1Props) {
  return (
    <ImageUploadQuestion
      roundNumber={1}
      questionNumber={question.question_number}
      totalQuestions={3}
      questionStartedAt={questionStartedAt}
      timerSeconds={question.timer_seconds}
      onSubmitted={onSubmitted}
    />
  );
}
