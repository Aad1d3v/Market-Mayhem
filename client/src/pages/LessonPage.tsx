import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "../lib/api.js";
import {
  Button,
  Card,
  ErrorState,
  Skeleton,
  useToast,
} from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { LessonDetail, QuizAttemptResult } from "@aadiinvest/shared";

export default function LessonPage() {
  const { lessonId = "" } = useParams();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => api.get<LessonDetail>(`/api/lessons/${lessonId}`),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) {
    return <ErrorState message="Lesson not found." onRetry={() => refetch()} />;
  }

  const answerMap = new Map((result?.answers ?? []).map((a) => [a.questionId, a]));
  const allAnswered = data.quiz.every((q) => answers[q.id]);

  const markComplete = async () => {
    try {
      const res = await api.post<{ xpAwarded: number }>(`/api/lessons/${data.id}/complete`);
      if (res.xpAwarded > 0) push(`Lesson complete! +${res.xpAwarded} XP`, "success");
      else push("Lesson already completed.", "info");
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      push("Could not save lesson progress.", "error");
    }
  };

  const submitQuiz = async () => {
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      };
      const res = await api.post<QuizAttemptResult>(`/api/lessons/${data.id}/quiz`, payload);
      setResult(res);
      if (res.passed && res.xpAwarded > 0) {
        push(`Quiz passed! +${res.xpAwarded} XP`, "success");
      }
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      await markComplete();
    } catch (e) {
      push(e instanceof ApiRequestError ? e.message : "Quiz submission failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const tryAgain = () => {
    setAnswers({});
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/learn" className="text-sm text-brand-strong hover:underline">
        ← Learning Center
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-brand-strong font-semibold">
          {data.category}
        </p>
        <h1 className="text-2xl font-bold mt-1">{data.title}</h1>
        <p className="text-sm text-ink-faint mt-1">
          ~{data.estimatedMinutes} min read · +{data.xpReward} XP
          {data.quizBestScore !== null && ` · Best quiz: ${data.quizBestScore}%`}
        </p>
      </header>

      <Card>
        <div className="space-y-4 text-[15px] leading-relaxed">
          {data.body.split("\n\n").map((para, i) => (
            <p key={i} className="text-ink/90 whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
        <div className="mt-5 card !bg-bg-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong mb-1.5">
            Example
          </p>
          <p className="text-sm text-ink-dim whitespace-pre-line">{data.example}</p>
        </div>
      </Card>

      {/* Quiz */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Knowledge check</h2>
          {result && (
            <span
              className={cn(
                "badge",
                result.passed
                  ? "bg-up-soft text-up border border-up/20"
                  : "bg-down-soft text-down border border-down/20",
              )}
            >
              {result.score}/{result.total} · {result.passed ? "Passed" : "Not passed"}
            </span>
          )}
        </div>

        <div className="space-y-5">
          {data.quiz.map((q, qi) => {
            const fb = answerMap.get(q.id);
            return (
              <fieldset key={q.id} className="space-y-2">
                <legend className="text-sm font-medium mb-1.5">
                  {qi + 1}. {q.prompt}
                </legend>
                {q.options.map((opt) => {
                  const chosen = answers[q.id] === opt.id;
                  const isCorrect = fb && fb.correctOptionId === opt.id;
                  const isWrongPick = fb && fb.chosenOptionId === opt.id && !fb.correct;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !result && setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                      disabled={Boolean(result)}
                      className={cn(
                        "w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors cursor-pointer",
                        !result && chosen && "border-brand bg-brand/10",
                        !result && !chosen && "border-edge hover:border-brand/50",
                        result && isCorrect && "border-up bg-up-soft",
                        result && isWrongPick && "border-down bg-down-soft",
                        result && !isCorrect && !isWrongPick && "border-edge-soft opacity-60",
                      )}
                    >
                      {opt.text}
                      {result && isCorrect && <span className="float-right text-up">✓</span>}
                      {result && isWrongPick && <span className="float-right text-down">✕</span>}
                    </button>
                  );
                })}
                {fb && (
                  <p className="text-xs text-ink-dim bg-bg-soft rounded-lg p-2.5">
                    <span className="font-semibold">
                      {fb.correct ? "Correct! " : "Not quite. "}
                    </span>
                    {fb.explanation}
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>

        <div className="flex gap-2 mt-5">
          {!result ? (
            <Button className="flex-1" disabled={!allAnswered || submitting} onClick={submitQuiz}>
              {submitting ? "Checking…" : "Submit answers"}
            </Button>
          ) : (
            <>
              {!result.passed && (
                <Button variant="secondary" className="flex-1" onClick={tryAgain}>
                  Try again
                </Button>
              )}
              <Link to="/learn" className="flex-1">
                <Button className="w-full">Back to lessons</Button>
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-ink-faint mt-3">
          Pass with 70% to earn +50 XP (first pass only). Completing the lesson earns +25 XP.
        </p>
      </Card>
    </div>
  );
}
