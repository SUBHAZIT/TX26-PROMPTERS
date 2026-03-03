import { ImageUploadQuestion } from './ImageUploadQuestion';

interface Round3Props {
  question: {
    question_number: number;
    timer_seconds: number;
    question_text: string | null;
  };
  questionStartedAt: string | null;
  onSubmitted: () => void;
}

export function Round3({ question, questionStartedAt, onSubmitted }: Round3Props) {
  return (
    <ImageUploadQuestion
      roundNumber={3}
      questionNumber={question.question_number}
      totalQuestions={5}
      questionStartedAt={questionStartedAt}
      timerSeconds={question.timer_seconds}
      showPromptField
      onSubmitted={onSubmitted}
    />
  );
}
