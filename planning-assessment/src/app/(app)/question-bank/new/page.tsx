import { QuestionForm } from '@/components/QuestionForm';

export default function NewQuestionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-ink-900">New Question</h1>
      <QuestionForm />
    </div>
  );
}
