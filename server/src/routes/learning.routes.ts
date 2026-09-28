import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../utils/errors.js";
import {
  addXp,
  evaluateLearningAchievements,
  logActivity,
  progressChallenge,
} from "../services/gamification.js";
import { asyncH, validate } from "./validate.js";
import type { LessonSummary, QuizAttemptResult } from "@aadiinvest/shared";

const router = Router();

const PASS_THRESHOLD = 0.7;

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const lessons = await prisma.lesson.findMany({
      orderBy: { order: "asc" },
      include: { questions: { select: { id: true } } },
    });
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: req.user!.id },
      select: { lessonId: true },
    });
    const completedSet = new Set(progress.map((p) => p.lessonId));
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: req.user!.id, passed: true },
      select: { lessonId: true, score: true, total: true },
    });
    const best = new Map<string, number>();
    for (const a of attempts) {
      const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
      best.set(a.lessonId, Math.max(best.get(a.lessonId) ?? 0, pct));
    }

    const items: LessonSummary[] = lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      category: l.category,
      estimatedMinutes: l.estimatedMinutes,
      xpReward: l.xpReward,
      completed: completedSet.has(l.id),
      quizBestScore: best.get(l.id) ?? null,
    }));
    res.json({ items });
  }),
);

router.get(
  "/:idOrSlug",
  requireAuth,
  asyncH(async (req, res) => {
    const key = String(req.params.idOrSlug);
    const lesson = await prisma.lesson.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!lesson) throw notFound("Lesson not found.");
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    });
    const attempts = await prisma.quizAttempt.findFirst({
      where: { userId: req.user!.id, lessonId: lesson.id, passed: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      category: lesson.category,
      estimatedMinutes: lesson.estimatedMinutes,
      xpReward: lesson.xpReward,
      completed: Boolean(progress),
      quizBestScore: attempts
        ? Math.round((attempts.score / attempts.total) * 100)
        : null,
      body: lesson.body,
      example: lesson.example,
      quiz: lesson.questions.map((q) => {
        // options is stored as a JSON string (SQLite)
        let opts: string[] = [];
        if (typeof q.options === "string") {
          try {
            opts = JSON.parse(q.options) as string[];
          } catch {
            opts = [];
          }
        } else if (Array.isArray(q.options)) {
          opts = q.options as string[];
        }
        return {
          id: q.id,
          prompt: q.prompt,
          options: opts.map((text, i) => ({ id: String(i), text })),
        };
      }),
    });
  }),
);

router.post(
  "/:idOrSlug/complete",
  requireAuth,
  asyncH(async (req, res) => {
    const key = String(req.params.idOrSlug);
    const lesson = await prisma.lesson.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
    });
    if (!lesson) throw notFound("Lesson not found.");

    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    });
    if (!existing) {
      await prisma.lessonProgress.create({
        data: { userId: req.user!.id, lessonId: lesson.id },
      });
      await addXp(req.user!.id, lesson.xpReward, `Lesson: ${lesson.title}`);
      await logActivity(
        req.user!.id,
        "LESSON",
        `Completed lesson: ${lesson.title}`,
        `+${lesson.xpReward} XP`,
      );
      const lessonsCompleted = await prisma.lessonProgress.count({
        where: { userId: req.user!.id },
      });
      const quizzesPassed = await prisma.quizAttempt.count({
        where: { userId: req.user!.id, passed: true },
      });
      await evaluateLearningAchievements(req.user!.id, lessonsCompleted, quizzesPassed);
      await progressChallenge(req.user!.id, "visit-learn");
    }
    res.json({ ok: true, xpAwarded: existing ? 0 : lesson.xpReward });
  }),
);

const attemptSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), optionId: z.string() })).min(1),
});

router.post(
  "/:idOrSlug/quiz",
  requireAuth,
  asyncH(async (req, res) => {
    const key = String(req.params.idOrSlug);
    const input = validate(attemptSchema, req.body);
    const lesson = await prisma.lesson.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!lesson) throw notFound("Lesson not found.");

    const byId = new Map(lesson.questions.map((q) => [q.id, q]));
    const answers = lesson.questions.map((q) => {
      const chosen = input.answers.find((a) => a.questionId === q.id);
      const chosenIndex = chosen ? parseInt(chosen.optionId, 10) : NaN;
      const correct = chosenIndex === q.correctIndex;
      return {
        questionId: q.id,
        correctOptionId: String(q.correctIndex),
        chosenOptionId: chosen ? chosen.optionId : null,
        correct,
        explanation: q.explanation,
      };
    });
    const score = answers.filter((a) => a.correct).length;
    const total = lesson.questions.length;
    const passed = total > 0 && score / total >= PASS_THRESHOLD;

    // XP: first-time pass earns the quiz XP; retakes earn nothing.
    let xpAwarded = 0;
    const priorPass = await prisma.quizAttempt.findFirst({
      where: { userId: req.user!.id, lessonId: lesson.id, passed: true },
    });
    if (passed && !priorPass) {
      xpAwarded = 50;
      await addXp(req.user!.id, xpAwarded, `Quiz passed: ${lesson.title}`);
      await logActivity(req.user!.id, "QUIZ", `Passed quiz: ${lesson.title}`, `+${xpAwarded} XP`);
      const quizzesPassed = await prisma.quizAttempt.count({
        where: { userId: req.user!.id, passed: true },
      });
      const lessonsCompleted = await prisma.lessonProgress.count({
        where: { userId: req.user!.id },
      });
      await evaluateLearningAchievements(req.user!.id, lessonsCompleted, quizzesPassed + 1);
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: req.user!.id,
        lessonId: lesson.id,
        score,
        total,
        passed,
        xpAwarded,
      },
    });

    const result: QuizAttemptResult = {
      attemptId: attempt.id,
      score,
      total,
      passed,
      xpAwarded,
      answers,
    };
    res.json(result);
  }),
);

export default router;
