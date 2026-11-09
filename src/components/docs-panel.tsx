import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  FileCode2,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import {
  MAX_DOC_FILES,
  type Analysis,
  type DocsMode,
  type DocsState,
  type FileDoc,
  type GraphComponent,
} from "@/lib/api";
import { isDocsActive, useDocs, useRepoFiles, useUpdateDocs } from "@/lib/projects";

type SourceUrl = (path: string, kind: "blob" | "tree", commit?: string) => string;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const dirName = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);

// `backticked` names set in code type.
const inline = (text: string) =>
  text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

// The Documentation section: docs for the project's key files, and the picker that chooses
// which files those are.
export function DocsPanel({
  analysis,
  byId,
  selectedPath,
  onSelectPath,
  sourceUrl,
  onInspect,
  analyzing,
  onAnalyze,
}: {
  analysis: Analysis;
  byId: Map<string, GraphComponent>;
  selectedPath: string | undefined;
  onSelectPath: (path: string) => void;
  sourceUrl: SourceUrl;
  onInspect: (componentId: string) => void;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  const { data: docs, status, error, refetch } = useDocs(analysis);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  if (status === "pending") {
    return (
      <div className="docs-message">
        <Loader2 size={17} className="animate-spin" />
        <p>Loading documentation...</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="docs-message">
        <TriangleAlert size={17} className="text-amber" />
        <p>{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const active = isDocsActive(docs);
  // Analyses from before docs existed saved no file list, so nothing can be picked yet.
  const needsAnalysis = docs.status === "NOT_STARTED" && !docs.selection.length;
  const byPath = new Map(docs.docs.map((d) => [d.path, d]));
  const current =
    (selectedPath ? byPath.get(selectedPath) : undefined) ??
    docs.docs.find((d) => docs.selection.includes(d.path)) ??
    docs.docs[0];
  const shown = docs.docs.filter((d) => d.path.toLowerCase().includes(query.toLowerCase()));

  if (needsAnalysis) {
    return (
      <div className="docs-message">
        <BookOpen size={17} className="text-primary" />
        <h2>Document this project's key files</h2>
        <p>
          Re-analyze to have Struct pick the files worth reading first and write docs for them. You
          can change the selection afterwards.
        </p>
        <Button size="sm" disabled={analyzing} onClick={onAnalyze}>
          <Sparkles />
          Re-analyze
        </Button>
      </div>
    );
  }

  return (
    <div className="docs">
      <div className="docs-bar">
        <div className="docs-bar-text">
          <span className={`pill ${docs.mode === "auto" ? "" : "pill-muted"}`}>
            {docs.mode === "auto" ? "Auto-selected" : "Your pick"}
          </span>
          <span>
            {plural(docs.selection.length, "file")}
            {docs.mode === "auto" && " · refreshed on every analysis"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          disabled={active}
          onClick={() => setPicking(true)}
        >
          <ListChecks size={12} />
          Choose files
        </Button>
      </div>
      <DocsStatusBar docs={docs} projectId={analysis.projectId} />
      {docs.docs.length === 0 ? (
        <div className="docs-message">
          {active ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              <p>Writing the first docs. They appear here as soon as the run finishes.</p>
            </>
          ) : (
            <>
              <BookOpen size={17} className="text-primary" />
              <p>No files are documented yet.</p>
              <Button size="sm" onClick={() => setPicking(true)}>
                <ListChecks />
                Choose files
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="docs-body">
          <nav className="docs-list" aria-label="Documented files">
            <label className="docs-search">
              <Search size={12} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter files..."
                aria-label="Filter documented files"
              />
            </label>
            <ul>
              {shown.map((d) => (
                <li key={d.path}>
                  <Button
                    variant="ghost"
                    className={`docs-file ${d.path === current?.path ? "selected" : ""}`}
                    title={d.path}
                    aria-current={d.path === current?.path ? "page" : undefined}
                    onClick={() => onSelectPath(d.path)}
                  >
                    <FileCode2 size={13} />
                    <span className="min-w-0">
                      <span className="docs-file-name">{fileName(d.path)}</span>
                      <span className="docs-file-dir">{dirName(d.path) || "/"}</span>
                    </span>
                  </Button>
                </li>
              ))}
              {!shown.length && <li className="docs-none">No documented file matches.</li>}
            </ul>
          </nav>
          {current && (
            <DocReader
              key={current.path}
              doc={current}
              component={current.componentId ? byId.get(current.componentId) : undefined}
              documented={byPath}
              sourceUrl={sourceUrl}
              onInspect={onInspect}
              onSelectPath={onSelectPath}
            />
          )}
        </div>
      )}
      {picking && <FilePicker analysis={analysis} docs={docs} onClose={() => setPicking(false)} />}
    </div>
  );
}

// Progress of a docs run, or how the last one ended when that needs saying.
function DocsStatusBar({ docs, projectId }: { docs: DocsState; projectId: string }) {
  const update = useUpdateDocs(projectId);
  if (isDocsActive(docs)) {
    const total = docs.total ?? 0;
    const done = Math.min(docs.done ?? 0, total);
    return (
      <div className="docs-status" role="status">
        <Loader2 size={13} className="animate-spin text-primary" />
        <span>
          {docs.status === "QUEUED" || !total
            ? "Getting ready to write docs..."
            : `Writing docs · ${done} of ${total} files`}
        </span>
        {total > 0 && (
          <div
            className="docs-progress"
            role="progressbar"
            aria-label="Docs progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span style={{ width: `${(done / total) * 100}%` }} />
          </div>
        )}
      </div>
    );
  }
  if (docs.status === "FAILED") {
    return (
      <div className="docs-status failed" role="alert">
        <TriangleAlert size={13} />
        <span>{docs.error ?? "The docs couldn't be written."}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] ml-auto"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              docs.mode === "manual" ? { mode: "manual", paths: docs.selection } : { mode: "auto" },
            )
          }
        >
          Try again
        </Button>
      </div>
    );
  }
  if (docs.failed.length) {
    return (
      <div className="docs-status warning" role="status">
        <TriangleAlert size={13} />
        <span title={docs.failed.join("\n")}>
          Couldn't document {plural(docs.failed.length, "file")}:{" "}
          {docs.failed.slice(0, 2).map(fileName).join(", ")}
          {docs.failed.length > 2 && "..."}
        </span>
      </div>
    );
  }
  return null;
}

function DocReader({
  doc,
  component,
  documented,
  sourceUrl,
  onInspect,
  onSelectPath,
}: {
  doc: FileDoc;
  component: GraphComponent | undefined;
  documented: Map<string, FileDoc>;
  sourceUrl: SourceUrl;
  onInspect: (componentId: string) => void;
  onSelectPath: (path: string) => void;
}) {
  const fileUrl = sourceUrl(doc.path, "blob", doc.commit);
  // A related file opens its doc when it has one, or GitHub when it doesn't.
  const related = (paths: string[]) =>
    paths.map((path) =>
      documented.has(path) ? (
        <li key={path}>
          <Button variant="link" className="docs-related" onClick={() => onSelectPath(path)}>
            <BookOpen size={11} />
            {path}
          </Button>
        </li>
      ) : (
        <li key={path}>
          <a
            className="docs-related"
            href={sourceUrl(path, "blob", doc.commit)}
            target="_blank"
            rel="noreferrer"
          >
            <FileCode2 size={11} />
            {path}
          </a>
        </li>
      ),
    );

  return (
    <article className="docs-reader" aria-label={`Documentation for ${doc.path}`}>
      <header>
        <div className="docs-path">
          <FileCode2 size={13} className="text-primary" />
          <span>{doc.path}</span>
        </div>
        <div className="docs-actions">
          {component && (
            <Button
              variant="link"
              className="p-0 h-5 text-[10px] text-primary"
              title={`Show ${component.name} on the map`}
              onClick={() => onInspect(component.id)}
            >
              <span className={`legend-dot ${component.type}`} />
              {component.name}
              <ArrowRight size={11} />
            </Button>
          )}
          <a className="docs-source" href={fileUrl} target="_blank" rel="noreferrer">
            View source
            <ExternalLink size={11} />
          </a>
        </div>
      </header>
      <p className="docs-summary">{inline(doc.summary)}</p>
      <p className="docs-purpose">{inline(doc.purpose)}</p>

      {doc.endpoints.length > 0 && (
        <section>
          <h3>Endpoints it serves</h3>
          <div className="docs-endpoints">
            {doc.endpoints.map((e) => (
              <code key={e}>{e}</code>
            ))}
          </div>
        </section>
      )}

      {doc.keyParts.length > 0 && (
        <section>
          <h3>Key parts</h3>
          <ul className="docs-parts">
            {doc.keyParts.map((part) => (
              <li key={`${part.name}-${part.line ?? ""}`}>
                <div className="docs-part-head">
                  <code>{part.name}</code>
                  <span className="docs-kind">{part.kind}</span>
                  {part.line && (
                    <a
                      className="docs-line"
                      href={`${fileUrl}#L${part.line}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open line ${part.line} on GitHub`}
                    >
                      L{part.line}
                    </a>
                  )}
                </div>
                <p>{inline(part.description)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.notes.length > 0 && (
        <section>
          <h3>Before you change it</h3>
          <ul className="docs-notes">
            {doc.notes.map((note) => (
              <li key={note}>{inline(note)}</li>
            ))}
          </ul>
        </section>
      )}

      {(doc.usedBy.length > 0 || doc.dependsOn.length > 0) && (
        <div className="docs-relations">
          {doc.usedBy.length > 0 && (
            <section>
              <h3>Used by</h3>
              <ul>{related(doc.usedBy)}</ul>
            </section>
          )}
          {doc.dependsOn.length > 0 && (
            <section>
              <h3>Depends on</h3>
              <ul>{related(doc.dependsOn)}</ul>
            </section>
          )}
        </div>
      )}

      <footer className="docs-foot">
        Written for commit <span className="font-mono">{doc.commit.slice(0, 7)}</span>
        {doc.truncated && " · The file is long, so only its beginning was read."}
      </footer>
    </article>
  );
}

// How many search matches the picker lists at once; typing more narrows them.
const MAX_MATCHES = 100;

// Chooses between the suggested files and the user's own pick.
function FilePicker({
  analysis,
  docs,
  onClose,
}: {
  analysis: Analysis;
  docs: DocsState;
  onClose: () => void;
}) {
  const { data: files, status, error } = useRepoFiles(analysis, true);
  const update = useUpdateDocs(analysis.projectId);
  const [mode, setMode] = useState<DocsMode>(docs.mode);
  // Manual starts from what is documented now, so tweaking the suggestions is one click.
  const [picked, setPicked] = useState<string[]>(docs.selection);
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => files?.suggestions ?? [], [files]);
  const reasons = useMemo(() => new Map(suggestions.map((s) => [s.path, s.reason])), [suggestions]);
  const pickedSet = new Set(picked);
  const full = picked.length >= MAX_DOC_FILES;

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !files) return [];
    return files.paths.filter((p) => {
      const path = p.toLowerCase();
      return terms.every((t) => path.includes(t));
    });
  }, [files, query]);

  const toggle = (path: string) =>
    setPicked((list) =>
      list.includes(path)
        ? list.filter((p) => p !== path)
        : [...list, path].slice(0, MAX_DOC_FILES),
    );

  const save = () =>
    update.mutate(mode === "manual" ? { mode, paths: picked } : { mode }, {
      onSuccess: onClose,
    });

  const row = (path: string) => {
    const checked = pickedSet.has(path);
    return (
      <li key={path}>
        <label className={`picker-row ${!checked && full ? "disabled" : ""}`}>
          <input
            type="checkbox"
            checked={checked}
            disabled={!checked && full}
            onChange={() => toggle(path)}
          />
          <span className="min-w-0">
            <span className="picker-path">{path}</span>
            {reasons.has(path) && <span className="picker-reason">{reasons.get(path)}</span>}
          </span>
        </label>
      </li>
    );
  };

  // With no search: the current pick first, then the suggestions not yet in it.
  const browse = [...picked, ...suggestions.map((s) => s.path).filter((p) => !pickedSet.has(p))];

  return (
    <Modal title="Choose files to document" onClose={onClose}>
      <div className="picker-modes" role="radiogroup" aria-label="How files are picked">
        {(
          [
            [
              "auto",
              "Suggested files",
              "Struct picks the files worth reading first and refreshes the pick on every analysis.",
            ],
            [
              "manual",
              "Pick files",
              `Choose up to ${MAX_DOC_FILES} files yourself. They stay the same on every analysis.`,
            ],
          ] as const
        ).map(([value, label, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={`picker-mode ${mode === value ? "selected" : ""}`}
            onClick={() => setMode(value)}
          >
            <span className="picker-mode-label">
              {mode === value && <Check size={12} />}
              {label}
            </span>
            <span className="picker-mode-text">{text}</span>
          </button>
        ))}
      </div>

      {status === "pending" ? (
        <p className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading the repository's files...
        </p>
      ) : status === "error" ? (
        <p className="text-amber">{error.message}</p>
      ) : mode === "auto" ? (
        <ul className="picker-list">
          {suggestions.map((s) => (
            <li key={s.path}>
              <div className="picker-row static">
                <FileCode2 size={12} className="text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="picker-path">{s.path}</span>
                  <span className="picker-reason">{s.reason}</span>
                </span>
              </div>
            </li>
          ))}
          {!suggestions.length && <li className="docs-none">No files stood out to suggest.</li>}
        </ul>
      ) : (
        <>
          <div className="picker-search">
            <label className="docs-search">
              <Search size={12} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${files.paths.length.toLocaleString()} files...`}
                aria-label="Search files"
              />
            </label>
            <span className={`picker-count ${full ? "text-amber" : ""}`}>
              {picked.length} / {MAX_DOC_FILES}
            </span>
            {picked.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => setPicked([])}
              >
                Clear
              </Button>
            )}
          </div>
          <ul className="picker-list">
            {query.trim() ? (
              <>
                {matches.slice(0, MAX_MATCHES).map(row)}
                {matches.length > MAX_MATCHES && (
                  <li className="docs-none">
                    Showing {MAX_MATCHES} of {matches.length.toLocaleString()} matches. Keep typing
                    to narrow them.
                  </li>
                )}
                {!matches.length && <li className="docs-none">No file matches "{query}".</li>}
              </>
            ) : (
              <>
                {browse.map(row)}
                {!browse.length && <li className="docs-none">Search to find files to document.</li>}
              </>
            )}
          </ul>
        </>
      )}

      {update.error && (
        <p className="analysis-error" role="alert">
          {update.error.message}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            update.isPending || status !== "success" || (mode === "manual" && !picked.length)
          }
          onClick={save}
        >
          {update.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {mode === "manual" ? `Document ${plural(picked.length, "file")}` : "Use suggested files"}
        </Button>
      </div>
    </Modal>
  );
}
