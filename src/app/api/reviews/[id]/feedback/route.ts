import { NextRequest, after } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { z } from "zod";
import { recordReviewFeedbackChange } from "@/lib/services/learning";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const feedbackSchema = z.object({
  feedback: z.enum(["helpful", "not_helpful"]),
  comment: z.string().max(1000).optional(),
});

/**
 * POST /api/reviews/[id]/feedback
 * Submit feedback for a PR review
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_001", "Invalid feedback data", 400);
    }

    // Find the review and verify ownership
    const review = await db.prReview.findFirst({
      where: { id },
      include: {
        repository: {
          select: { userId: true },
        },
      },
    });

    if (!review) {
      return jsonError("REVIEW_001", "Review not found", 404);
    }

    if (review.repository.userId !== session.userId) {
      return jsonError("AUTH_003", "Not authorized to provide feedback", 403);
    }

    const previousFeedback = review.feedback as "helpful" | "not_helpful" | null;

    // Update the review with feedback
    const updated = await db.prReview.update({
      where: { id },
      data: {
        feedback: parsed.data.feedback,
        feedbackComment: parsed.data.comment || null,
        feedbackAt: new Date(),
      },
    });

    after(async () => {
      try {
        await recordReviewFeedbackChange({
          reviewId: updated.id,
          previousFeedback,
          nextFeedback: parsed.data.feedback,
        });
      } catch (error) {
        console.error("[Learning] Failed to record feedback change:", error);
      }
    });

    return jsonSuccess({
      review: {
        id: updated.id,
        feedback: updated.feedback,
        feedbackAt: updated.feedbackAt,
      },
    });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return jsonError("INTERNAL_001", "Failed to submit feedback", 500);
  }
}

/**
 * DELETE /api/reviews/[id]/feedback
 * Remove feedback for a PR review
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    // Find the review and verify ownership
    const review = await db.prReview.findFirst({
      where: { id },
      include: {
        repository: {
          select: { userId: true },
        },
      },
    });

    if (!review) {
      return jsonError("REVIEW_001", "Review not found", 404);
    }

    if (review.repository.userId !== session.userId) {
      return jsonError("AUTH_003", "Not authorized", 403);
    }

    const previousFeedback = review.feedback as "helpful" | "not_helpful" | null;

    // Remove the feedback
    const updated = await db.prReview.update({
      where: { id },
      data: {
        feedback: null,
        feedbackComment: null,
        feedbackAt: null,
      },
    });

    after(async () => {
      try {
        await recordReviewFeedbackChange({
          reviewId: updated.id,
          previousFeedback,
          nextFeedback: null,
        });
      } catch (error) {
        console.error("[Learning] Failed to record feedback change:", error);
      }
    });

    return jsonSuccess({
      review: {
        id: updated.id,
        feedback: updated.feedback,
      },
    });
  } catch (error) {
    console.error("Failed to remove feedback:", error);
    return jsonError("INTERNAL_001", "Failed to remove feedback", 500);
  }
}
