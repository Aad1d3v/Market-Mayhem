import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncH, validate } from "./validate.js";
import { recordTutorialCompletion } from "../services/gamification.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const progress = await prisma.tutorialProgress.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id },
    });
    res.json({
      currentStep: progress.currentStep,
      completed: progress.completed || req.user!.tutorialCompleted,
    });
  }),
);

const stepSchema = z.object({ currentStep: z.number().int().min(0).max(10) });

router.post(
  "/step",
  requireAuth,
  asyncH(async (req, res) => {
    const { currentStep } = validate(stepSchema, req.body);
    await prisma.tutorialProgress.upsert({
      where: { userId: req.user!.id },
      update: { currentStep },
      create: { userId: req.user!.id, currentStep },
    });
    res.json({ ok: true });
  }),
);

router.post(
  "/complete",
  requireAuth,
  asyncH(async (req, res) => {
    const schema = z.object({ skipped: z.boolean().optional() });
    const { skipped } = validate(schema, req.body ?? {});
    await prisma.tutorialProgress.upsert({
      where: { userId: req.user!.id },
      update: { completed: true, currentStep: 10 },
      create: { userId: req.user!.id, completed: true, currentStep: 10 },
    });
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { tutorialCompleted: true },
    });
    // XP + achievement are only for actually finishing (not skipping).
    if (!skipped) {
      await recordTutorialCompletion(req.user!.id);
    }
    res.json({ ok: true });
  }),
);

export default router;
