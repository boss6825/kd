import { Router } from "express";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type Db } from "../db";
import {
  chats,
  documents,
  documentVersions,
  projectSubfolders,
  projects,
  tabularReviews,
  user,
  userProfiles,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  attachActiveVersionPaths,
  attachLatestVersionNumbers,
} from "../lib/documentVersions";
import { downloadFile, uploadFile, storageKey } from "../lib/storage";
import { docxToPdf, convertedPdfKey } from "../lib/convert";
import { checkProjectAccess } from "../lib/access";
import { singleFileUpload } from "../lib/upload";

export const projectsRouter = Router();
const ALLOWED_TYPES = new Set(["pdf", "docx", "doc"]);

function normalizeDocumentFilename(nextName: unknown, currentName: string) {
  if (typeof nextName !== "string") return null;
  const trimmed = nextName.trim().slice(0, 200);
  if (!trimmed) return null;
  if (/\.[a-z0-9]{1,6}$/i.test(trimmed)) return trimmed;
  const ext = currentName.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? "";
  return `${trimmed}${ext}`;
}

// GET /projects
projectsRouter.get("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;

  const ownProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.user_id, userId))
    .orderBy(desc(projects.created_at));

  const sharedProjects = userEmail
    ? await db
        .select()
        .from(projects)
        .where(
          and(
            sql`${projects.shared_with} @> ${JSON.stringify([userEmail])}::jsonb`,
            ne(projects.user_id, userId),
          ),
        )
        .orderBy(desc(projects.created_at))
    : [];

  const allProjects = [...ownProjects, ...sharedProjects].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const result = await Promise.all(
    allProjects.map(async (p) => {
      const [docCount, chatCount, reviewCount] = await Promise.all([
        db
          .select({ c: count() })
          .from(documents)
          .where(eq(documents.project_id, p.id)),
        db.select({ c: count() }).from(chats).where(eq(chats.project_id, p.id)),
        db
          .select({ c: count() })
          .from(tabularReviews)
          .where(eq(tabularReviews.project_id, p.id)),
      ]);
      return {
        ...p,
        is_owner: p.user_id === userId,
        document_count: docCount[0]?.c ?? 0,
        chat_count: chatCount[0]?.c ?? 0,
        review_count: reviewCount[0]?.c ?? 0,
      };
    }),
  );
  res.json(result);
});

// POST /projects
projectsRouter.post("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { name, cm_number, shared_with } = req.body as {
    name: string;
    cm_number?: string;
    shared_with?: string[];
  };
  if (!name?.trim())
    return void res.status(400).json({ detail: "name is required" });
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  const cleanedSharedWith: string[] = [];
  const seenSharedEmails = new Set<string>();
  if (Array.isArray(shared_with)) {
    for (const raw of shared_with) {
      if (typeof raw !== "string") continue;
      const e = raw.trim().toLowerCase();
      if (!e || seenSharedEmails.has(e)) continue;
      if (normalizedUserEmail && e === normalizedUserEmail) {
        return void res
          .status(400)
          .json({ detail: "You cannot share a project with yourself." });
      }
      seenSharedEmails.add(e);
      cleanedSharedWith.push(e);
    }
  }

  const [data] = await db
    .insert(projects)
    .values({
      user_id: userId,
      name: name.trim(),
      cm_number: cm_number ?? null,
      shared_with: cleanedSharedWith,
    })
    .returning();
  if (!data)
    return void res.status(500).json({ detail: "Failed to create project" });
  res.status(201).json({ ...data, documents: [] });
});

// GET /projects/:projectId
projectsRouter.get("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { projectId } = req.params;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project)
    return void res.status(404).json({ detail: "Project not found" });

  const canAccess =
    project.user_id === userId ||
    (userEmail &&
      Array.isArray(project.shared_with) &&
      project.shared_with.includes(userEmail));
  if (!canAccess)
    return void res.status(404).json({ detail: "Project not found" });

  const [docs, folderData] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.project_id, projectId))
      .orderBy(asc(documents.created_at)),
    db
      .select()
      .from(projectSubfolders)
      .where(eq(projectSubfolders.project_id, projectId))
      .orderBy(asc(projectSubfolders.created_at)),
  ]);
  const docsTyped = docs as unknown as {
    id: string;
    current_version_id?: string | null;
  }[];
  await attachLatestVersionNumbers(db, docsTyped);
  await attachActiveVersionPaths(db, docsTyped);
  res.json({
    ...project,
    is_owner: project.user_id === userId,
    documents: docsTyped,
    folders: folderData,
  });
});

// GET /projects/:projectId/people
// Resolve the owner + every shared member to {email, display_name}. Used
// by the People modal so the UI can show display names where available
// and tag the current user as "You".
projectsRouter.get("/:projectId/people", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const [project] = await db
    .select({
      id: projects.id,
      user_id: projects.user_id,
      shared_with: projects.shared_with,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project)
    return void res.status(404).json({ detail: "Project not found" });

  const isOwner = project.user_id === userId;
  const sharedWith = (
    Array.isArray(project.shared_with) ? project.shared_with : []
  ).map((e) => e.toLowerCase());
  const isShared = !!userEmail && sharedWith.includes(userEmail.toLowerCase());
  if (!isOwner && !isShared)
    return void res.status(404).json({ detail: "Project not found" });

  // Pull every user (replaces Supabase's auth.admin.listUsers). For larger
  // deployments this should page or resolve by id, but it keeps things simple
  // while user counts are modest.
  const allUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user);
  const userByEmail = new Map<string, { id: string; email: string }>();
  const userById = new Map<string, { id: string; email: string }>();
  for (const u of allUsers) {
    if (!u.email) continue;
    const lower = u.email.toLowerCase();
    userByEmail.set(lower, { id: u.id, email: u.email });
    userById.set(u.id, { id: u.id, email: u.email });
  }

  const memberUserIds: string[] = [];
  for (const email of sharedWith) {
    const u = userByEmail.get(email);
    if (u) memberUserIds.push(u.id);
  }

  const profileIds = [project.user_id, ...memberUserIds].filter(
    (x, i, arr) => arr.indexOf(x) === i,
  );

  const profileByUserId = new Map<
    string,
    { display_name: string | null; organisation: string | null }
  >();
  if (profileIds.length > 0) {
    const profiles = await db
      .select({
        user_id: userProfiles.user_id,
        display_name: userProfiles.display_name,
        organisation: userProfiles.organisation,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.user_id, profileIds));
    for (const p of profiles) {
      profileByUserId.set(p.user_id, {
        display_name: p.display_name ?? null,
        organisation: p.organisation ?? null,
      });
    }
  }

  const ownerInfo = userById.get(project.user_id);
  const owner = {
    user_id: project.user_id,
    email: ownerInfo?.email ?? null,
    display_name: profileByUserId.get(project.user_id)?.display_name ?? null,
  };
  const members = sharedWith.map((email) => {
    const u = userByEmail.get(email);
    const display_name = u
      ? profileByUserId.get(u.id)?.display_name ?? null
      : null;
    return { email, display_name };
  });

  res.json({ owner, members });
});

// PATCH /projects/:projectId
projectsRouter.patch("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;
  const updates: {
    name?: string;
    cm_number?: string | null;
    shared_with?: string[];
  } = {};
  if (req.body.name != null) updates.name = req.body.name;
  if (req.body.cm_number != null) updates.cm_number = req.body.cm_number;
  if (Array.isArray(req.body.shared_with)) {
    // Normalise: lowercase + dedupe + drop empties.
    const normalizedUserEmail = userEmail?.trim().toLowerCase();
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of req.body.shared_with) {
      if (typeof raw !== "string") continue;
      const e = raw.trim().toLowerCase();
      if (!e || seen.has(e)) continue;
      if (normalizedUserEmail && e === normalizedUserEmail) {
        return void res
          .status(400)
          .json({ detail: "You cannot share a project with yourself." });
      }
      seen.add(e);
      cleaned.push(e);
    }
    updates.shared_with = cleaned;
  }

  const [data] = await db
    .update(projects)
    .set({ ...updates, updated_at: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.user_id, userId)))
    .returning();
  if (!data)
    return void res.status(404).json({ detail: "Project not found" });

  const [docs, folderData] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.project_id, projectId))
      .orderBy(asc(documents.created_at)),
    db
      .select()
      .from(projectSubfolders)
      .where(eq(projectSubfolders.project_id, projectId))
      .orderBy(asc(projectSubfolders.created_at)),
  ]);
  const docsTyped = docs as unknown as {
    id: string;
    current_version_id?: string | null;
  }[];
  await attachActiveVersionPaths(db, docsTyped);
  res.json({ ...data, documents: docsTyped, folders: folderData });
});

// DELETE /projects/:projectId
projectsRouter.delete("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { projectId } = req.params;
  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.user_id, userId)));
  res.status(204).send();
});

// GET /projects/:projectId/documents
projectsRouter.get("/:projectId/documents", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.project_id, projectId))
    .orderBy(asc(documents.created_at));
  const docsTyped = docs as unknown as {
    id: string;
    current_version_id?: string | null;
  }[];
  await attachActiveVersionPaths(db, docsTyped);
  res.json(docsTyped);
});

// POST /projects/:projectId/documents/:documentId — assign or copy existing doc into project
projectsRouter.post(
  "/:projectId/documents/:documentId",
  requireAuth,
  async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { projectId, documentId } = req.params;

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok)
      return void res.status(404).json({ detail: "Project not found" });

    // Adding-by-id pulls a doc into the project — only the doc's owner
    // is allowed to do that, so other people's standalone docs can't be
    // siphoned into a project the requester happens to share.
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.user_id, userId)))
      .limit(1);
    if (!doc)
      return void res.status(404).json({ detail: "Document not found" });

    // Already in this project — idempotent
    if (doc.project_id === projectId) return void res.json(doc);

    if (doc.project_id === null) {
      // Standalone → assign project_id
      const [updated] = await db
        .update(documents)
        .set({ project_id: projectId, updated_at: new Date() })
        .where(eq(documents.id, documentId))
        .returning();
      if (!updated)
        return void res
          .status(500)
          .json({ detail: "Failed to update document" });
      return void res.json(updated);
    } else {
      // Belongs to another project → duplicate record AND copy the
      // underlying storage objects so each project's copy is fully
      // independent (edits/version bumps on one don't leak into the
      // other).
      const [copy] = await db
        .insert(documents)
        .values({
          project_id: projectId,
          user_id: userId,
          filename: doc.filename,
          file_type: doc.file_type,
          size_bytes: doc.size_bytes,
          page_count: doc.page_count,
          structure_tree: doc.structure_tree,
          status: doc.status,
        })
        .returning();
      if (!copy)
        return void res.status(500).json({ detail: "Failed to copy document" });

      let copyVersionRowId: string | null = null;
      if (doc.current_version_id) {
        const [srcV] = await db
          .select({
            storage_path: documentVersions.storage_path,
            pdf_storage_path: documentVersions.pdf_storage_path,
            version_number: documentVersions.version_number,
            display_name: documentVersions.display_name,
            source: documentVersions.source,
          })
          .from(documentVersions)
          .where(eq(documentVersions.id, doc.current_version_id))
          .limit(1);
        if (srcV?.storage_path) {
          const srcBytes = await downloadFile(srcV.storage_path);
          if (!srcBytes) {
            return void res
              .status(500)
              .json({ detail: "Failed to read source document bytes" });
          }
          const newKey = storageKey(userId, copy.id, doc.filename);
          const contentType =
            doc.file_type === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          await uploadFile(newKey, srcBytes, contentType);

          // PDFs share one object for source + display rendition. DOCX
          // store the converted PDF at a separate `converted-pdfs/` key —
          // copy that too if it exists so the copy renders without going
          // back through libreoffice.
          let newPdfPath: string | null = null;
          if (srcV.pdf_storage_path) {
            if (srcV.pdf_storage_path === srcV.storage_path) {
              newPdfPath = newKey;
            } else {
              const pdfBytes = await downloadFile(srcV.pdf_storage_path);
              if (pdfBytes) {
                const newPdfKey = convertedPdfKey(userId, copy.id);
                await uploadFile(newPdfKey, pdfBytes, "application/pdf");
                newPdfPath = newPdfKey;
              }
            }
          }

          const [newV] = await db
            .insert(documentVersions)
            .values({
              document_id: copy.id,
              storage_path: newKey,
              pdf_storage_path: newPdfPath,
              source: srcV.source ?? "upload",
              version_number: srcV.version_number ?? 1,
              display_name: srcV.display_name ?? doc.filename,
            })
            .returning({ id: documentVersions.id });
          copyVersionRowId = newV?.id ?? null;
          if (copyVersionRowId) {
            await db
              .update(documents)
              .set({ current_version_id: copyVersionRowId })
              .where(eq(documents.id, copy.id));
          }
        }
      }
      return void res.status(201).json(copy);
    }
  },
);

// PATCH /projects/:projectId/documents/:documentId — rename a project document
projectsRouter.patch("/:projectId/documents/:documentId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, documentId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const [doc] = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      current_version_id: documents.current_version_id,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.project_id, projectId)))
    .limit(1);
  if (!doc)
    return void res.status(404).json({ detail: "Document not found" });

  const filename = normalizeDocumentFilename(req.body?.filename, doc.filename);
  if (!filename)
    return void res.status(400).json({ detail: "filename is required" });

  const [updated] = await db
    .update(documents)
    .set({ filename, updated_at: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.project_id, projectId)))
    .returning();
  if (!updated)
    return void res.status(404).json({ detail: "Document not found" });

  if (doc.current_version_id) {
    await db
      .update(documentVersions)
      .set({ display_name: filename })
      .where(
        and(
          eq(documentVersions.id, doc.current_version_id),
          eq(documentVersions.document_id, documentId),
        ),
      );
  }

  res.json(updated);
});

// POST /projects/:projectId/documents
projectsRouter.post(
  "/:projectId/documents",
  requireAuth,
  singleFileUpload("file"),
  async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { projectId } = req.params;

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok)
      return void res.status(404).json({ detail: "Project not found" });

    await handleDocumentUpload(req, res, userId, projectId, db);
  },
);

// GET /projects/:projectId/chats — every assistant chat under this project
// (any author with project access). Used by the project page's chat tab so
// it doesn't have to filter the global GET /chat list — and so collaborators
// see each other's chats inside the project even though those don't appear
// in the global list.
projectsRouter.get("/:projectId/chats", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const data = await db
    .select()
    .from(chats)
    .where(eq(chats.project_id, projectId))
    .orderBy(desc(chats.created_at));
  res.json(data);
});

// ── Folder routes ─────────────────────────────────────────────────────────────

// POST /projects/:projectId/folders
projectsRouter.post("/:projectId/folders", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;
  const { name, parent_folder_id } = req.body as { name: string; parent_folder_id?: string | null };
  if (!name?.trim()) return void res.status(400).json({ detail: "name is required" });

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  // Verify parent folder belongs to this project
  if (parent_folder_id) {
    const parent = await loadProjectFolder(db, projectId, parent_folder_id);
    if (!parent) return void res.status(404).json({ detail: "Parent folder not found" });
  }

  const [data] = await db
    .insert(projectSubfolders)
    .values({
      project_id: projectId,
      user_id: userId,
      name: name.trim(),
      parent_folder_id: parent_folder_id ?? null,
    })
    .returning();
  res.status(201).json(data);
});

// PATCH /projects/:projectId/folders/:folderId
projectsRouter.patch("/:projectId/folders/:folderId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, folderId } = req.params;
  const body = req.body as { name?: string; parent_folder_id?: string | null };

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  const updates: {
    name?: string;
    parent_folder_id?: string | null;
    updated_at: Date;
  } = { updated_at: new Date() };
  if (body.name != null) updates.name = body.name.trim();
  if ("parent_folder_id" in body) {
    // Cycle check: walk up the tree from the proposed parent to ensure folderId is not an ancestor
    if (body.parent_folder_id) {
      const parent = await loadProjectFolder(db, projectId, body.parent_folder_id);
      if (!parent) return void res.status(404).json({ detail: "Parent folder not found" });

      let cur: string | null = body.parent_folder_id;
      while (cur) {
        if (cur === folderId) return void res.status(400).json({ detail: "Cannot move a folder into itself or a descendant" });
        const p = await loadProjectFolder(db, projectId, cur);
        if (!p) return void res.status(404).json({ detail: "Parent folder not found" });
        cur = p?.parent_folder_id ?? null;
      }
    }
    updates.parent_folder_id = body.parent_folder_id ?? null;
  }

  const [data] = await db
    .update(projectSubfolders)
    .set(updates)
    .where(
      and(
        eq(projectSubfolders.id, folderId),
        eq(projectSubfolders.project_id, projectId),
      ),
    )
    .returning();
  if (!data) return void res.status(404).json({ detail: "Folder not found" });
  res.json(data);
});

// DELETE /projects/:projectId/folders/:folderId
projectsRouter.delete("/:projectId/folders/:folderId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, folderId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  const folder = await loadProjectFolder(db, projectId, folderId);
  if (!folder) return void res.status(404).json({ detail: "Folder not found" });

  // Move direct documents to root before cascade-deleting subfolders
  await db
    .update(documents)
    .set({ folder_id: null })
    .where(
      and(
        eq(documents.folder_id, folderId),
        eq(documents.project_id, projectId),
      ),
    );

  await db
    .delete(projectSubfolders)
    .where(
      and(
        eq(projectSubfolders.id, folderId),
        eq(projectSubfolders.project_id, projectId),
      ),
    );
  res.status(204).send();
});

// PATCH /projects/:projectId/documents/:documentId/folder — move doc to a folder
projectsRouter.patch("/:projectId/documents/:documentId/folder", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, documentId } = req.params;
  const { folder_id } = req.body as { folder_id: string | null };

  const access = await checkProjectAccess(projectId, userId, userEmail, db);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  if (folder_id) {
    const folder = await loadProjectFolder(db, projectId, folder_id);
    if (!folder) return void res.status(404).json({ detail: "Folder not found" });
  }

  const [data] = await db
    .update(documents)
    .set({ folder_id: folder_id ?? null, updated_at: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.project_id, projectId)))
    .returning();
  if (!data) return void res.status(404).json({ detail: "Document not found" });
  res.json(data);
});

async function loadProjectFolder(
  db: Db,
  projectId: string,
  folderId: string,
): Promise<{ id: string; parent_folder_id: string | null } | null> {
  const [data] = await db
    .select({
      id: projectSubfolders.id,
      parent_folder_id: projectSubfolders.parent_folder_id,
    })
    .from(projectSubfolders)
    .where(
      and(
        eq(projectSubfolders.id, folderId),
        eq(projectSubfolders.project_id, projectId),
      ),
    )
    .limit(1);
  return data ?? null;
}

export async function handleDocumentUpload(
  req: import("express").Request,
  res: import("express").Response,
  userId: string,
  projectId: string | null,
  db: Db,
) {
  const file = req.file;
  if (!file) return void res.status(400).json({ detail: "file is required" });

  const filename = file.originalname;
  const suffix = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "";
  if (!ALLOWED_TYPES.has(suffix))
    return void res
      .status(400)
      .json({
        detail: `Unsupported file type: ${suffix}. Allowed: pdf, docx, doc`,
      });

  const content = file.buffer;
  let doc:
    | { id: string; [k: string]: unknown }
    | undefined;
  try {
    [doc] = await db
      .insert(documents)
      .values({
        project_id: projectId,
        user_id: userId,
        filename,
        file_type: suffix,
        size_bytes: content.byteLength,
        status: "processing",
      })
      .returning();
  } catch {
    doc = undefined;
  }

  if (!doc)
    return void res
      .status(500)
      .json({ detail: "Failed to create document record" });

  const docId = doc.id;
  try {
    const key = storageKey(userId, docId, filename);
    const contentType =
      suffix === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await uploadFile(
      key,
      content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength,
      ) as ArrayBuffer,
      contentType,
    );

    const rawBuf = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;
    const tree = await extractStructureTree(rawBuf, suffix, filename);
    const pageCount = suffix === "pdf" ? await countPdfPages(rawBuf) : null;

    // Convert DOCX/DOC → PDF for display. PDFs are their own rendition.
    let pdfStoragePath: string | null = null;
    if (suffix === "docx" || suffix === "doc") {
      try {
        const pdfBuf = await docxToPdf(content);
        const pdfKey = convertedPdfKey(userId, docId);
        await uploadFile(
          pdfKey,
          pdfBuf.buffer.slice(
            pdfBuf.byteOffset,
            pdfBuf.byteOffset + pdfBuf.byteLength,
          ) as ArrayBuffer,
          "application/pdf",
        );
        pdfStoragePath = pdfKey;
      } catch (err) {
        console.error(
          `[upload] DOCX→PDF conversion failed for ${filename}:`,
          err,
        );
      }
    } else if (suffix === "pdf") {
      pdfStoragePath = key;
    }

    // Storage paths live on document_versions — create the V1 row and
    // point documents.current_version_id at it.
    const [versionRow] = await db
      .insert(documentVersions)
      .values({
        document_id: docId,
        storage_path: key,
        pdf_storage_path: pdfStoragePath,
        source: "upload",
        version_number: 1,
        display_name: filename,
      })
      .returning({ id: documentVersions.id });
    if (!versionRow) {
      throw new Error("Failed to record upload version");
    }

    await db
      .update(documents)
      .set({
        current_version_id: versionRow.id,
        size_bytes: content.byteLength,
        page_count: pageCount,
        structure_tree: tree ?? null,
        status: "ready",
        updated_at: new Date(),
      })
      .where(eq(documents.id, docId));

    const [updated] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);
    const responseDoc = updated
      ? {
            ...updated,
            storage_path: key,
            pdf_storage_path: pdfStoragePath,
        }
      : updated;
    return void res.status(201).json(responseDoc);
  } catch (e) {
    await db
      .update(documents)
      .set({ status: "error" })
      .where(eq(documents.id, docId));
    return void res
      .status(500)
      .json({ detail: `Document processing failed: ${String(e)}` });
  }
}

async function countPdfPages(buf: ArrayBuffer): Promise<number | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    const pdf = await (
      pdfjsLib as unknown as {
        getDocument: (opts: unknown) => {
          promise: Promise<{ numPages: number }>;
        };
      }
    ).getDocument({ data: new Uint8Array(buf) }).promise;
    return pdf.numPages;
  } catch {
    return null;
  }
}

async function extractStructureTree(
  content: ArrayBuffer,
  fileType: string,
  filename: string,
): Promise<unknown[] | null> {
  try {
    if (fileType === "pdf") {
      const pdfjsLib = await import(
        "pdfjs-dist/legacy/build/pdf.mjs" as string
      );
      const pdf = await (
        pdfjsLib as unknown as {
          getDocument: (opts: unknown) => {
            promise: Promise<{
              numPages: number;
              getOutline: () => Promise<{ title?: string }[]>;
            }>;
          };
        }
      ).getDocument({ data: new Uint8Array(content) }).promise;
      if (pdf.numPages <= 5) return null;
      const outline = await pdf.getOutline();
      if (outline?.length) {
        return outline.map((item, i) => ({
          id: `h1-${i}`,
          title: item.title ?? `Item ${i + 1}`,
          level: 1,
          page_number: null,
          children: [],
        }));
      }
      return Array.from({ length: pdf.numPages }, (_, i) => ({
        id: `page-${i + 1}`,
        title: `Page ${i + 1}`,
        level: 1,
        page_number: i + 1,
        children: [],
      }));
    } else {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(content),
      });
      const lines = result.value.split("\n").filter((l) => l.trim());
      const nodes = lines
        .slice(0, 30)
        .map((line, i) => ({
          id: `h1-${i}`,
          title: line.slice(0, 100),
          level: 1,
          page_number: null,
          children: [],
        }));
      return nodes.length ? nodes : null;
    }
  } catch {
    return null;
  }
}
