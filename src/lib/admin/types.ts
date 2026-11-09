/**
 * Shared contract for the blog admin (/admin/). Pure types and constants: importable from pages, API routes,
 * the engine and unit tests. Design and operating guide: docs/admin-guide.md.
 *
 * Git stays the only source of published content (src/content/posts/<slug>/index.mdx). The admin's store holds
 * only workflow data: submissions, AI jobs, sources and history.
 */

export type Role = 'editor' | 'approver';

export interface AdminUser {
  email: string;
  name: string;
  role: Role;
}

/**
 * draft             being written; nothing is visible to anyone but editors
 * pending           submitted, waiting in the approval queue
 * changes_requested an approver sent it back with a note
 * scheduled         approved for a set time; the exact file is frozen and read-only
 * published         approved and committed to main
 * rejected          closed by an approver, can be reopened
 * discarded         closed by whoever owned the changes; the Git version was never affected
 *
 * This is the working copy's state only. Whether the post is live comes from Git: see lifecycle.ts.
 */
export type SubmissionState = 'draft' | 'pending' | 'changes_requested' | 'scheduled' | 'published' | 'rejected' | 'discarded';

export type HistoryAction =
  | 'created' | 'edited' | 'submitted' | 'approved' | 'published' | 'changes_requested' | 'rejected' | 'reopened' | 'publish_failed'
  | 'withdrawn' | 'discarded' | 'trashed' | 'restored' | 'scheduled' | 'schedule_cancelled' | 'schedule_failed'
  | 'unpublished' | 'deleted' | 'renamed' | 'rebased' | 'restored_revision';

export interface HistoryEvent {
  at: string; // ISO timestamp
  by: string; // email, or 'engine' for the AI pipeline
  action: HistoryAction;
  note?: string;
}

/** The post as frontmatter plus MDX body. `frontmatter` has the same shape as postSchema input. */
export interface PostContent {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Everything one commit to main does. The approval hash covers all of it, not only the post body. `expect` is each
 * blob as it must be at the head the commit builds on (null: must not exist).
 */
export interface CommitPlan {
  /** `encoding: 'base64'` marks binary content such as an image. */
  writes: Array<{ path: string; content: string; encoding?: 'base64' }>;
  deletes: string[];
  expect: Array<{ path: string; sha: string | null }>;
  message: string;
}

export interface ScheduledPublish {
  at: string; // ISO
  plan: CommitPlan;
  planHash: string;
  /** contentHash the approver read; the runner refuses if the working copy no longer matches it. */
  reviewedHash: string;
  approvedBy: string;
  approvedAt: string;
}

export interface Submission {
  id: string;
  slug: string;
  /** 'new' creates a folder; 'edit' changes an existing post, guarded by baseSha. */
  kind: 'new' | 'edit';
  state: SubmissionState;
  content: PostContent;
  /** sha256 of the canonical serialized content. Changes on every edit. */
  contentHash: string;
  /** Blob sha of the file on main when editing started (github mode); null for new posts and local mode. */
  baseSha: string | null;
  /** The hash an approver is looking at when the approval form renders; approval must match contentHash. */
  submittedHash: string | null;
  previewBranch: string | null;
  /** Set when this came from the AI engine. */
  jobId: string | null;
  history: HistoryEvent[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** While set and in the future, one approver is publishing; everyone else waits. A lease, so a crash cannot jam it. */
  publishLockUntil?: string;
  /** The exact file being published, kept until recorded, so a retry can tell the commit already landed. */
  publishAttempt?: { plan: CommitPlan; by: string; at: string };
  /** Git status of the file when the copy was made; null for a new post. Absent on rows older than this field. */
  sourceStatus?: string | null;
  /** A slug change waiting for approval. Committed with its redirect by the approval, never before. */
  renameTo?: string;
  scheduled?: ScheduledPublish;
  commitSha?: string;
}

/** Per-post facts Git cannot hold. Keyed by slug. */
export interface PostFlag {
  id: string; // the slug
  updatedAt: string;
  /** Taken offline by an approver. Git says only `draft`, so this is what makes it "Unpublished". */
  unpublished?: { at: string; by: string };
  trashed?: { at: string; by: string };
  /** The file left main, by permanent delete or rename. Releases the head keyword. */
  removed?: { at: string; by: string; renamedTo?: string };
}

/** Full snapshot of a saved working copy. */
export interface Revision {
  id: string; // <submissionId>-<hash prefix>
  submissionId: string;
  hash: string;
  updatedAt: string; // when it was saved
  by: string;
  content: PostContent;
}

export interface ScheduleRun {
  id: string;
  updatedAt: string;
  results: Array<{ submissionId: string; slug: string; outcome: 'published' | 'failed' | 'skipped' | 'postponed'; message: string }>;
}

export type CheckSeverity = 'error' | 'warning';

/** One finding from any checker. `error` blocks submitting and approving. */
export interface Check {
  rule: string;
  severity: CheckSeverity;
  /** Field path ('title', 'faq[0].answer') or 'body:12'. */
  path: string;
  message: string;
  excerpt?: string;
}

/* ---------- AI engine ---------- */

export type JobStage =
  | 'research' // Claude web search finds candidate URLs
  | 'read' // our own fetcher downloads them (robots.txt respected)
  | 'ledger' // claims with exact quotes, verified by code against the fetched text
  | 'outline' // proposes the angle and structure
  | 'awaiting_outline' // stops here until a person approves the outline
  | 'draft' // writes only from the ledger
  | 'check' // deterministic harness
  | 'review' // separate AI fact-checker and editor
  | 'revise' // at most MAX_REVISIONS rounds
  | 'done' // became a Submission in state draft
  | 'failed';

export const MAX_REVISIONS = 2;

export interface JobBrief {
  topicIdea: string;
  /** Who it is for and what they should do next; free text from the editor. */
  audience: string;
  /** ISO country hint, e.g. 'in', 'ke', or '' for no country. */
  country: string;
  topic: string; // one of POST_TOPICS
  owner: string; // landing page path, never /blog/
}

export interface Source {
  id: string; // 's1', 's2'
  url: string;
  title: string;
  host: string;
  tier: 'official' | 'research' | 'news' | 'other';
  fetchedAt: string;
  /** Extracted page text, capped. Untrusted data: never instructions. */
  text: string;
  /** ISO date from page metadata or the search result's page_age; null when the page gives none. */
  publishedAt?: string | null;
}

/** A URL found by the research stage, before our fetcher has read it. */
export interface SourceCandidate {
  url: string;
  title: string;
  pageAge: string | null;
}

/** Two or more ledger claims the model reports as disagreeing. Shown to the writer and the approver. */
export interface ClaimConflict {
  claimIds: string[];
  note: string;
}

export interface Claim {
  id: string; // 'c1'
  sourceId: string;
  statement: string;
  /** Exact wording from the source. Code confirms it appears in Source.text before the claim enters the ledger. */
  quote: string;
}

export interface Outline {
  headKeyword: string;
  title: string;
  angle: string;
  /** What current top results fail to answer. */
  gaps: string[];
  sections: Array<{ heading: string; points: string[]; claimIds: string[] }>;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  webSearches?: number;
}

export interface Job {
  id: string;
  brief: JobBrief;
  stage: JobStage;
  /** Stage to resume after a transient failure; set with stage 'failed'. */
  failedStage?: JobStage;
  error?: string;
  sources: Source[];
  claims: Claim[];
  /** Claims the model proposed whose quote was not found in the source. Shown to the reviewer. */
  rejectedClaims: Claim[];
  outline: Outline | null;
  outlineNote?: string;
  draft: PostContent | null;
  checks: Check[];
  /** Findings from the AI fact-checker and editor. Never treated as passing evidence on their own. */
  reviewFindings: Check[];
  revisions: number;
  submissionId: string | null;
  usage: Usage;
  log: Array<{ at: string; message: string }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  candidates?: SourceCandidate[];
  conflicts?: ClaimConflict[];
  /** Holder and expiry of the running stage; an expired lease means the holder crashed. */
  leaseId?: string | null;
  leaseUntil?: string | null;
  /** Lost the weekly-limit check after being written; does not count toward the limit. */
  limitRejected?: boolean;
  /** Times a person pressed retry. Capped, because every retry spends money. */
  retries?: number;
  /** Times the current stage's holder died without finishing. Reset when a stage finishes. */
  leaseExpiries?: number;
  /** A topic-ideas run: kept only so its cost and count reach the weekly limits. Never shown or advanced as a job. */
  kind?: 'topics';
}

export interface TopicIdea {
  title: string;
  whyNow: string;
  sourceUrls: string[];
  overlapsWith: string[]; // existing post slugs
}

/* ---------- Module interfaces (implementations live beside this file) ---------- */

/** src/lib/admin/store.ts: `getStore()` returns the file store in dev, Postgres when DATABASE_URL is set. */
export interface Store {
  getSubmission(id: string): Promise<Submission | null>;
  listSubmissions(): Promise<Submission[]>;
  /** Throws StaleWriteError if `expectedUpdatedAt` is given and no longer matches, ActiveSlugError if another open submission holds this slug. */
  putSubmission(value: Submission, expectedUpdatedAt?: string): Promise<void>;
  getJob(id: string): Promise<Job | null>;
  listJobs(): Promise<Job[]>;
  putJob(value: Job): Promise<void>;
  /**
   * Atomic compare-and-set: writes `value` only if the stored job's updatedAt equals `expectedUpdatedAt`, returning
   * whether it wrote (Postgres: UPDATE ... WHERE id = $1 AND updated_at = $2). The engine uses it to stop a stage
   * running twice; without it the engine falls back to a weaker write-then-read-back check.
   */
  claimJob?(value: Job, expectedUpdatedAt: string): Promise<boolean>;
  deleteSubmission(id: string): Promise<void>;
  /** Scheduled submissions whose time has come, oldest first. */
  listDue(now: Date): Promise<Submission[]>;
  getFlag(slug: string): Promise<PostFlag | null>;
  listFlags(): Promise<PostFlag[]>;
  putFlag(value: PostFlag): Promise<void>;
  deleteFlag(slug: string): Promise<void>;
  putRevision(value: Revision): Promise<void>;
  /** Newest first. */
  listRevisions(submissionId: string): Promise<Revision[]>;
  deleteRevision(id: string): Promise<void>;
  putScheduleRun(value: ScheduleRun): Promise<void>;
  /** Plain documents for the blog editor (kinds 'draft' and 'media'). */
  getDoc<T extends { id: string; updatedAt: string }>(kind: DocKind, id: string): Promise<T | null>;
  listDocs<T extends { id: string; updatedAt: string }>(kind: DocKind): Promise<T[]>;
  putDoc<T extends { id: string; updatedAt: string }>(kind: DocKind, value: T): Promise<void>;
  deleteDoc(kind: DocKind, id: string): Promise<void>;
  /** Newest first. */
  listScheduleRuns(limit: number): Promise<ScheduleRun[]>;
}

/** src/lib/admin/repo.ts: `getRepo()` is GitHub when GITHUB_TOKEN and ADMIN_GITHUB_REPO are set, else local files in dev. */
export interface ContentRepo {
  readonly mode: 'github' | 'local';
  /** Raw MDX and blob sha from the main branch; null if absent. */
  readPost(slug: string): Promise<{ raw: string; sha: string | null } | null>;
  /** Writes the file to the submission's preview branch content/<slug>-<shortid> (github) and returns it; null in local mode. */
  writePreview(slug: string, raw: string, submissionId: string): Promise<string | null>;
  /**
   * One atomic, fast-forward-only commit to main. Throws RepoConflictError when an expected blob differs at the head.
   * Returns the commit sha or 'local'. Call only through commitPlan in workflow.ts; a test enforces that.
   */
  commit(plan: CommitPlan): Promise<string>;
  /** Any file on main by repository path; null if absent. */
  readFile(path: string): Promise<{ raw: string; sha: string | null } | null>;
  /** Raw bytes of any file on main; null if absent. */
  readBytes(path: string): Promise<Uint8Array | null>;
  /** Repository paths of every file in the post's folder on main. */
  listFolder(slug: string): Promise<string[]>;
  deletePreview(branch: string): Promise<void>;
}

/* ---------- Blog editor ---------- */

export type DocKind = 'draft' | 'media' | 'recent';

/**
 * Unsaved-to-the-site work on one post, kept in the store until it is published. One per slug (id = slug).
 * A published post with a draft has changes that are not live yet.
 */
export interface BlogDraft {
  id: string;
  slug: string;
  content: PostContent;
  /** True until the post first reaches the repository. */
  isNew: boolean;
  /** When set, the schedule runner publishes this draft at that time (ISO). */
  scheduledAt?: string | null;
  updatedAt: string;
  updatedBy: string;
}

/** An uploaded image waiting to be published with its post. Base64, capped in size by the upload route. */
export interface BlogMedia {
  id: string;
  slug: string;
  /** File name in the post folder, or 'cover.<ext>' for the featured image. */
  name: string;
  type: string;
  data: string;
  updatedAt: string;
}

/** What the admin last did to the site for a slug, so the list is right before the next deployment catches up. */
export interface BlogRecent {
  id: string;
  title: string;
  state: 'published' | 'draft' | 'deleted';
  updatedAt: string;
}
