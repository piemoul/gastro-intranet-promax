/**
 * SQ → SO lifecycle (pure logic, unit-testable).
 *
 *   (SQ)  soStatus = null       — salesman is still editing the quotation
 *   SUBMITTED                    — salesman submitted it for approval
 *   APPROVED                     — admin approved; may now be pushed to Accurate
 *   REJECTED                     — admin rejected; salesman can revise & resubmit
 *
 * Only an APPROVED order is allowed to reach Accurate, and only once.
 */
export const SO_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

export type SoState = {
  soStatus: string | null;
  accurateSyncedAt: Date | string | null;
};

export type Viewer = { id: number; isAdmin: boolean };

/** A quotation can be submitted while it is a plain SQ or after a rejection. */
export function canSubmit(q: SoState): boolean {
  return q.soStatus == null || q.soStatus === "REJECTED";
}

/** Only an admin decides, and only on something awaiting a decision. */
export function canDecide(q: SoState, viewer: Viewer): boolean {
  return viewer.isAdmin && q.soStatus === "SUBMITTED";
}

/** Approved and not yet pushed → eligible for Accurate. */
export function canPushToAccurate(q: SoState, viewer: Viewer): boolean {
  return viewer.isAdmin && q.soStatus === "APPROVED" && !q.accurateSyncedAt;
}

/** Editing is frozen once submitted, unless it came back rejected. */
export function isLocked(q: SoState): boolean {
  return q.soStatus === "SUBMITTED" || q.soStatus === "APPROVED";
}

/** Label + colour hint for the UI badge. */
export function soBadge(q: SoState): { label: string; tone: "neutral" | "info" | "good" | "bad" } {
  if (q.accurateSyncedAt) return { label: "DI ACCURATE", tone: "good" };
  switch (q.soStatus) {
    case "SUBMITTED":
      return { label: "MENUNGGU APPROVAL", tone: "info" };
    case "APPROVED":
      return { label: "APPROVED", tone: "good" };
    case "REJECTED":
      return { label: "DITOLAK", tone: "bad" };
    default:
      return { label: "SQ", tone: "neutral" };
  }
}
