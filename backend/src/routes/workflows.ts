import { Router, type NextFunction, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Db } from "../db";
import {
  hiddenWorkflows,
  user,
  userProfiles,
  workflowShares,
  workflows,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const workflowsRouter = Router();

type WorkflowRecord = {
  id: string;
  user_id: string | null;
  is_system: boolean;
  [key: string]: unknown;
};

type WorkflowAccess =
  | {
      workflow: WorkflowRecord;
      allowEdit: boolean;
      isOwner: boolean;
    }
  | null;

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function withWorkflowAccess<T extends Record<string, unknown>>(
  workflow: T,
  access: { allowEdit: boolean; isOwner: boolean; sharedByName?: string | null },
) {
  return {
    ...workflow,
    allow_edit: access.allowEdit,
    is_owner: access.isOwner,
    shared_by_name: access.sharedByName ?? null,
  };
}

async function loadSharerNames(
  db: Db,
  sharerIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(sharerIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (uniqueIds.length === 0) return names;

  try {
    const profiles = await db
      .select({
        user_id: userProfiles.user_id,
        display_name: userProfiles.display_name,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.user_id, uniqueIds));
    for (const profile of profiles) {
      if (profile.user_id && profile.display_name) {
        names.set(profile.user_id, profile.display_name);
      }
    }
  } catch (err) {
    console.warn("[workflows] sharer profile lookup threw", err);
  }

  // Fall back to the auth email for sharers without a display name. Replaces
  // Supabase's auth.admin.getUserById with a direct read of the user table.
  const missingIds = uniqueIds.filter((id) => !names.has(id));
  if (missingIds.length > 0) {
    try {
      const rows = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(inArray(user.id, missingIds));
      for (const row of rows) {
        if (row.email) names.set(row.id, row.email);
      }
    } catch (err) {
      console.warn("[workflows] failed to load sharer emails", err);
    }
  }

  return names;
}

async function resolveWorkflowAccess(
  workflowId: string,
  userId: string,
  userEmail: string | null | undefined,
  db: Db,
): Promise<WorkflowAccess> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);
  if (!workflow) return null;
  const workflowRecord = workflow as WorkflowRecord;
  if (workflowRecord.user_id === userId) {
    return { workflow: workflowRecord, allowEdit: true, isOwner: true };
  }

  const normalizedUserEmail = (userEmail ?? "").trim().toLowerCase();
  if (!normalizedUserEmail) return null;

  const [share] = await db
    .select({ allow_edit: workflowShares.allow_edit })
    .from(workflowShares)
    .where(
      and(
        eq(workflowShares.workflow_id, workflowId),
        eq(workflowShares.shared_with_email, normalizedUserEmail),
      ),
    )
    .limit(1);
  if (!share) return null;

  return { workflow: workflowRecord, allowEdit: !!share.allow_edit, isOwner: false };
}

// GET /workflows
workflowsRouter.get("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { type } = req.query as { type?: string };

  // Own workflows
  const ownConds = [
    eq(workflows.user_id, userId),
    eq(workflows.is_system, false),
  ];
  if (type) ownConds.push(eq(workflows.type, type));
  const own = await db
    .select()
    .from(workflows)
    .where(and(...ownConds))
    .orderBy(desc(workflows.created_at));

  // Shared workflows (where the current user's email appears in workflow_shares)
  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const shares = await db
    .select({
      workflow_id: workflowShares.workflow_id,
      shared_by_user_id: workflowShares.shared_by_user_id,
      allow_edit: workflowShares.allow_edit,
    })
    .from(workflowShares)
    .where(eq(workflowShares.shared_with_email, normalizedUserEmail));

  let sharedWorkflows: Record<string, unknown>[] = [];
  if (shares.length > 0) {
    const sharedIds = shares.map((s) => s.workflow_id);
    const sharedConds = [inArray(workflows.id, sharedIds)];
    if (type) sharedConds.push(eq(workflows.type, type));
    const wfs = await db
      .select()
      .from(workflows)
      .where(and(...sharedConds));

    if (wfs.length > 0) {
      const sharerIds = [
        ...new Set(shares.map((s) => s.shared_by_user_id).filter(Boolean)),
      ];
      const sharerNames = await loadSharerNames(db, sharerIds);

      sharedWorkflows = wfs.map((wf) => {
        const share = shares.find((s) => s.workflow_id === wf.id);
        const sharerId = share?.shared_by_user_id;
        const shared_by_name = sharerId
          ? sharerNames.get(sharerId) ?? null
          : null;
        return withWorkflowAccess(wf, {
          allowEdit: !!share?.allow_edit,
          isOwner: false,
          sharedByName: shared_by_name,
        });
      });
    }
  }

  const ownWithFlag = own.map((wf) =>
    withWorkflowAccess(wf, { allowEdit: true, isOwner: true }),
  );
  res.json([...ownWithFlag, ...sharedWorkflows]);
}));

// POST /workflows
workflowsRouter.post("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { title, type, prompt_md, columns_config, practice } = req.body as {
    title: string;
    type: string;
    prompt_md?: string;
    columns_config?: unknown;
    practice?: string | null;
  };
  if (!title?.trim())
    return void res.status(400).json({ detail: "title is required" });
  if (!["assistant", "tabular"].includes(type))
    return void res
      .status(400)
      .json({ detail: "type must be 'assistant' or 'tabular'" });

  const [data] = await db
    .insert(workflows)
    .values({
      user_id: userId,
      title: title.trim(),
      type,
      prompt_md: prompt_md ?? null,
      columns_config: columns_config ?? null,
      practice: practice ?? null,
      is_system: false,
    })
    .returning();
  res.status(201).json(data);
}));

async function handleWorkflowUpdate(req: Request, res: Response) {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const updates: {
    title?: string;
    prompt_md?: string | null;
    columns_config?: unknown;
    practice?: string | null;
  } = {};
  if (req.body.title != null) updates.title = req.body.title;
  if (req.body.prompt_md != null) updates.prompt_md = req.body.prompt_md;
  if (req.body.columns_config != null)
    updates.columns_config = req.body.columns_config;
  if ("practice" in req.body) updates.practice = req.body.practice ?? null;

  const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
  if (!access || access.workflow.is_system || !access.allowEdit) {
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });
  }
  const [data] = await db
    .update(workflows)
    .set(updates)
    .where(and(eq(workflows.id, workflowId), eq(workflows.is_system, false)))
    .returning();
  if (!data)
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });
  res.json(
    withWorkflowAccess(data, {
      allowEdit: access.allowEdit,
      isOwner: access.isOwner,
    }),
  );
}

// PUT /workflows/:workflowId
workflowsRouter.put("/:workflowId", requireAuth, asyncRoute(handleWorkflowUpdate));

// PATCH /workflows/:workflowId
workflowsRouter.patch("/:workflowId", requireAuth, asyncRoute(handleWorkflowUpdate));

// DELETE /workflows/:workflowId
workflowsRouter.delete("/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;
  await db
    .delete(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.user_id, userId),
        eq(workflows.is_system, false),
      ),
    );
  res.status(204).send();
}));

// GET /workflows/hidden
workflowsRouter.get("/hidden", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select({ workflow_id: hiddenWorkflows.workflow_id })
    .from(hiddenWorkflows)
    .where(eq(hiddenWorkflows.user_id, userId));
  res.json(rows.map((r) => r.workflow_id));
}));

// POST /workflows/hidden
workflowsRouter.post("/hidden", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflow_id } = req.body as { workflow_id: string };
  if (!workflow_id?.trim())
    return void res.status(400).json({ detail: "workflow_id is required" });
  await db
    .insert(hiddenWorkflows)
    .values({ user_id: userId, workflow_id })
    .onConflictDoNothing({
      target: [hiddenWorkflows.user_id, hiddenWorkflows.workflow_id],
    });
  res.status(204).send();
}));

// DELETE /workflows/hidden/:workflowId
workflowsRouter.delete("/hidden/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;
  await db
    .delete(hiddenWorkflows)
    .where(
      and(
        eq(hiddenWorkflows.user_id, userId),
        eq(hiddenWorkflows.workflow_id, workflowId),
      ),
    );
  res.status(204).send();
}));

// GET /workflows/:workflowId
workflowsRouter.get("/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
  if (!access)
    return void res.status(404).json({ detail: "Workflow not found" });
  res.json(
    withWorkflowAccess(access.workflow, {
      allowEdit: access.allowEdit,
      isOwner: access.isOwner,
    }),
  );
}));

// GET /workflows/:workflowId/shares
workflowsRouter.get("/:workflowId/shares", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;

  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.user_id, userId),
        eq(workflows.is_system, false),
      ),
    )
    .limit(1);
  if (!wf)
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });

  const shares = await db
    .select({
      id: workflowShares.id,
      shared_with_email: workflowShares.shared_with_email,
      allow_edit: workflowShares.allow_edit,
      created_at: workflowShares.created_at,
    })
    .from(workflowShares)
    .where(eq(workflowShares.workflow_id, workflowId))
    .orderBy(asc(workflowShares.created_at));

  res.json(shares);
}));

// DELETE /workflows/:workflowId/shares/:shareId
workflowsRouter.delete("/:workflowId/shares/:shareId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId, shareId } = req.params;

  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.user_id, userId)))
    .limit(1);
  if (!wf) return void res.status(404).json({ detail: "Workflow not found" });

  await db
    .delete(workflowShares)
    .where(
      and(
        eq(workflowShares.id, shareId),
        eq(workflowShares.workflow_id, workflowId),
      ),
    );
  res.status(204).send();
}));

// POST /workflows/:workflowId/share
workflowsRouter.post("/:workflowId/share", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const { emails, allow_edit } = req.body as { emails: string[]; allow_edit: boolean };

  if (!emails?.length) return void res.status(400).json({ detail: "emails is required" });
  const normalizedEmails = [
    ...new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (normalizedEmails.length === 0) {
    return void res.status(400).json({ detail: "emails is required" });
  }
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  if (normalizedUserEmail && normalizedEmails.includes(normalizedUserEmail)) {
    return void res
      .status(400)
      .json({ detail: "You cannot share a workflow with yourself." });
  }

  // Verify ownership
  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.user_id, userId),
        eq(workflows.is_system, false),
      ),
    )
    .limit(1);
  if (!wf)
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });

  const rows = normalizedEmails.map((email: string) => ({
    workflow_id: workflowId,
    shared_by_user_id: userId,
    shared_with_email: email,
    allow_edit: allow_edit ?? false,
  }));
  // Upsert on (workflow_id, shared_with_email) so re-sharing to the same
  // person updates the existing row instead of stacking duplicates.
  await db
    .insert(workflowShares)
    .values(rows)
    .onConflictDoUpdate({
      target: [workflowShares.workflow_id, workflowShares.shared_with_email],
      set: { allow_edit: sql`excluded.allow_edit` },
    });

  res.status(204).send();
}));

workflowsRouter.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("[workflows] unhandled route error", err);
    res.status(500).json({ detail: "Failed to process workflow request" });
  },
);
