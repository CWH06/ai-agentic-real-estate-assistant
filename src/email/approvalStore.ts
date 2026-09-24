import { randomUUID } from "node:crypto";

import type { EmailDraft, EmailMessage } from "./types";

const DEFAULT_DRAFT_TTL_MS = 30 * 60 * 1_000;

export interface EmailApprovalStoreOptions {
  clock?: () => Date;
  createId?: () => string;
  draftTtlMs?: number;
}

export class EmailApprovalStore {
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly draftTtlMs: number;
  private readonly drafts = new Map<string, EmailDraft>();
  private readonly pendingDraftIds = new Map<string, string>();

  constructor(options: EmailApprovalStoreOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.draftTtlMs = options.draftTtlMs ?? DEFAULT_DRAFT_TTL_MS;

    if (!Number.isFinite(this.draftTtlMs) || this.draftTtlMs <= 0) {
      throw new Error("Email draft lifetime must be a positive number.");
    }
  }

  createDraft(userId: string, message: EmailMessage): EmailDraft {
    const normalizedUserId = requireUserId(userId);
    const existing = this.getPendingDraft(normalizedUserId);

    if (existing) {
      this.updateStatus(existing.id, "cancelled");
    }

    const createdAt = this.clock();
    const draft: EmailDraft = {
      ...message,
      id: this.createId(),
      userId: normalizedUserId,
      status: "pending_approval",
      createdAt,
      expiresAt: new Date(createdAt.getTime() + this.draftTtlMs),
      updatedAt: createdAt,
    };

    this.drafts.set(draft.id, draft);
    this.pendingDraftIds.set(normalizedUserId, draft.id);
    return cloneDraft(draft);
  }

  getPendingDraft(userId: string): EmailDraft | null {
    const normalizedUserId = requireUserId(userId);
    const draftId = this.pendingDraftIds.get(normalizedUserId);

    if (!draftId) return null;

    const draft = this.drafts.get(draftId);
    if (!draft || draft.status !== "pending_approval") {
      this.pendingDraftIds.delete(normalizedUserId);
      return null;
    }

    if (draft.expiresAt.getTime() <= this.clock().getTime()) {
      this.updateStatus(draft.id, "expired");
      return null;
    }

    return cloneDraft(draft);
  }

  beginApproval(userId: string): EmailDraft | null {
    const draft = this.getPendingDraft(userId);
    if (!draft) return null;

    const lockedDraft = this.updateStatus(draft.id, "sending");
    return lockedDraft ? cloneDraft(lockedDraft) : null;
  }

  cancelPending(userId: string): EmailDraft | null {
    const draft = this.getPendingDraft(userId);
    if (!draft) return null;

    const cancelledDraft = this.updateStatus(draft.id, "cancelled");
    return cancelledDraft ? cloneDraft(cancelledDraft) : null;
  }

  markSent(draftId: string): EmailDraft | null {
    return this.finishSending(draftId, "sent");
  }

  markFailed(draftId: string): EmailDraft | null {
    return this.finishSending(draftId, "failed");
  }

  getDraft(draftId: string): EmailDraft | null {
    const draft = this.drafts.get(draftId);
    return draft ? cloneDraft(draft) : null;
  }

  clear(userId?: string): void {
    if (userId === undefined) {
      this.drafts.clear();
      this.pendingDraftIds.clear();
      return;
    }

    const normalizedUserId = requireUserId(userId);
    for (const [draftId, draft] of this.drafts) {
      if (draft.userId === normalizedUserId) {
        this.drafts.delete(draftId);
      }
    }
    this.pendingDraftIds.delete(normalizedUserId);
  }

  private finishSending(
    draftId: string,
    status: "sent" | "failed",
  ): EmailDraft | null {
    const draft = this.drafts.get(draftId);
    if (!draft || draft.status !== "sending") return null;
    return this.updateStatus(draftId, status);
  }

  private updateStatus(
    draftId: string,
    status: EmailDraft["status"],
  ): EmailDraft | null {
    const draft = this.drafts.get(draftId);
    if (!draft) return null;

    draft.status = status;
    draft.updatedAt = this.clock();
    this.drafts.set(draftId, draft);

    if (status !== "pending_approval") {
      const pendingDraftId = this.pendingDraftIds.get(draft.userId);
      if (pendingDraftId === draftId) {
        this.pendingDraftIds.delete(draft.userId);
      }
    }

    return draft;
  }
}

function requireUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) throw new Error("User ID is required for email approval.");
  return normalized;
}

function cloneDraft(draft: EmailDraft): EmailDraft {
  return {
    ...draft,
    createdAt: new Date(draft.createdAt),
    expiresAt: new Date(draft.expiresAt),
    updatedAt: new Date(draft.updatedAt),
  };
}
