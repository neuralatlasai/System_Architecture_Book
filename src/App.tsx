import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  Library,
  Moon,
  PanelLeft,
  Search,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookChapter, BookContent, BookDocument } from "./types";

const bookContentUrl = `${import.meta.env.BASE_URL}book-content.json`;

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly book: BookContent }
  | { readonly status: "error"; readonly message: string };

interface ParsedHash {
  readonly documentId: string;
  readonly section?: string;
}

interface SearchHit {
  readonly document: BookDocument;
  readonly score: number;
}

function parseHash(hashValue: string, documentsById: ReadonlyMap<string, BookDocument>): ParsedHash | undefined {
  const hash = hashValue.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const documentId = params.get("doc");

  if (!documentId || !documentsById.has(documentId)) {
    return undefined;
  }

  return {
    documentId,
    section: params.get("section") ?? undefined,
  };
}

function setDocumentHash(documentId: string, section?: string): void {
  const params = new URLSearchParams({ doc: documentId });

  if (section) {
    params.set("section", section);
  }

  window.location.hash = params.toString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function scoreDocument(document: BookDocument, query: string): number {
  if (query.length === 0) {
    return 0;
  }

  const title = document.title.toLowerCase();
  const chapterTitle = document.chapterTitle?.toLowerCase() ?? "";
  let score = 0;

  if (title.startsWith(query)) {
    score += 12;
  }

  if (title.includes(query)) {
    score += 8;
  }

  if (chapterTitle.includes(query)) {
    score += 4;
  }

  if (document.searchText.includes(query)) {
    score += 2;
  }

  return score;
}

function App(): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadBookContent(): Promise<void> {
      try {
        const response = await fetch(bookContentUrl, { headers: { Accept: "application/json" } });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const book = (await response.json()) as BookContent;

        if (!cancelled) {
          setLoadState({ status: "ready", book });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown loading failure";

        if (!cancelled) {
          setLoadState({ status: "error", message });
        }
      }
    }

    void loadBookContent();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState.status === "loading") {
    return <ShellStatus title="Loading book" detail="Building the online reader index." />;
  }

  if (loadState.status === "error") {
    return <ShellStatus title="Book content unavailable" detail={loadState.message} />;
  }

  return <BookReader book={loadState.book} />;
}

interface ShellStatusProps {
  readonly title: string;
  readonly detail: string;
}

function ShellStatus({ title, detail }: ShellStatusProps): JSX.Element {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface)] px-6 text-[var(--ink)]">
      <section className="w-full max-w-md rounded-[8px] border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--line)] bg-[var(--wash)]">
          <BookOpen size={20} />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
      </section>
    </main>
  );
}

interface BookReaderProps {
  readonly book: BookContent;
}

function BookReader({ book }: BookReaderProps): JSX.Element {
  const documentsById = useMemo(() => new Map(book.documents.map((document) => [document.id, document])), [book]);
  const firstDocumentId = book.documents[0]?.id ?? "";
  const initialHash = typeof window === "undefined" ? undefined : parseHash(window.location.hash, documentsById);
  const [selectedDocumentId, setSelectedDocumentId] = useState(initialHash?.documentId ?? firstDocumentId);
  const [pendingSectionId, setPendingSectionId] = useState<string | undefined>(initialHash?.section);
  const [query, setQuery] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("book-theme") === "dark");
  const [readingProgress, setReadingProgress] = useState(0);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedDocument = documentsById.get(selectedDocumentId) ?? book.documents[0];
  const selectedChapter = selectedDocument?.chapterNumber
    ? book.chapters.find((chapter) => chapter.number === selectedDocument.chapterNumber)
    : undefined;

  const chapterDocuments = useMemo(() => {
    if (!selectedChapter) {
      return book.documents.filter((document) => document.kind === "book-overview");
    }

    return selectedChapter.documentIds
      .map((documentId) => documentsById.get(documentId))
      .filter((document): document is BookDocument => Boolean(document));
  }, [selectedChapter]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchHits = useMemo<SearchHit[]>(() => {
    if (normalizedQuery.length === 0) {
      return [];
    }

    return book.documents
      .map((document) => ({ document, score: scoreDocument(document, normalizedQuery) }))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.document.relativePath.localeCompare(right.document.relativePath);
      })
      .slice(0, 18);
  }, [normalizedQuery]);

  const navigateToDocument = useCallback((documentId: string, section?: string) => {
    setSelectedDocumentId(documentId);
    setPendingSectionId(section);
    setDocumentHash(documentId, section);
    setIsNavigationOpen(false);
  }, []);

  useEffect(() => {
    const onHashChange = (): void => {
      const parsedHash = parseHash(window.location.hash, documentsById);

      if (parsedHash) {
        setSelectedDocumentId(parsedHash.documentId);
        setPendingSectionId(parsedHash.section);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [documentsById]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("book-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const updateProgress = (): void => {
      const article = document.getElementById("article");

      if (!article) {
        setReadingProgress(0);
        return;
      }

      const articleRect = article.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const total = Math.max(1, articleRect.height - viewportHeight);
      const consumed = Math.min(total, Math.max(0, -articleRect.top));
      setReadingProgress(Math.round((consumed / total) * 100));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [selectedDocumentId]);

  useEffect(() => {
    const sectionId = pendingSectionId;

    window.requestAnimationFrame(() => {
      const target = sectionId ? document.getElementById(sectionId) : undefined;

      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }

      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, [selectedDocumentId, pendingSectionId]);

  const copySourcePath = useCallback(async () => {
    if (!selectedDocument) {
      return;
    }

    await navigator.clipboard.writeText(selectedDocument.relativePath);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [selectedDocument]);

  if (!selectedDocument) {
    return <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <a className="skip-link" href="#article">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface-elevated)]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1840px] items-center gap-3 px-4 py-3 lg:px-6">
          <button
            aria-label="Open navigation"
            className="icon-button lg:hidden"
            title="Open navigation"
            type="button"
            onClick={() => setIsNavigationOpen((current) => !current)}
          >
            <PanelLeft size={18} />
          </button>

          <button
            className="flex min-w-0 items-center gap-3 text-left"
            type="button"
            onClick={() => navigateToDocument("overview")}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[var(--line)] bg-[var(--panel)]">
              <BookOpen size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold uppercase text-[var(--muted)]">Online Book</span>
              <span className="block truncate text-base font-semibold text-[var(--ink)]">{book.title}</span>
            </span>
          </button>

          <label className="ml-auto hidden min-w-[18rem] max-w-[32rem] flex-1 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 md:flex">
            <Search aria-hidden="true" size={18} className="text-[var(--muted)]" />
            <span className="sr-only">Search documents</span>
            <input
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              placeholder="Search chapters, failure modes, SLOs, cache, quorum..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="hidden items-center gap-2 xl:flex">
            <Metric label="Chapters" value={`${book.metrics.chaptersAvailable}/${book.metrics.chaptersTotal}`} />
            <Metric label="Notes" value={formatNumber(book.metrics.documentsTotal)} />
            <Metric label="Words" value={formatNumber(book.metrics.wordsTotal)} />
          </div>

          <button
            aria-label={darkMode ? "Use light theme" : "Use dark theme"}
            className="icon-button"
            title={darkMode ? "Use light theme" : "Use dark theme"}
            type="button"
            onClick={() => setDarkMode((current) => !current)}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="px-4 pb-3 md:hidden">
          <label className="flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <Search aria-hidden="true" size={18} className="text-[var(--muted)]" />
            <span className="sr-only">Search documents</span>
            <input
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              placeholder="Search the book"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1840px] grid-cols-1 gap-0 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside
          className={`border-r border-[var(--line)] bg-[var(--surface)] lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto ${
            isNavigationOpen ? "block" : "hidden"
          }`}
        >
          <BookNavigation
            chapters={book.chapters}
            chapterDocuments={chapterDocuments}
            query={query}
            searchHits={searchHits}
            selectedDocumentId={selectedDocument.id}
            selectedChapterNumber={selectedChapter?.number}
            onNavigate={navigateToDocument}
          />
        </aside>

        <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 lg:hidden">
            <label className="text-xs font-semibold uppercase text-[var(--muted)]" htmlFor="document-select">
              Document
            </label>
            <select
              id="document-select"
              className="mt-2 w-full rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-3 text-sm text-[var(--ink)]"
              value={selectedDocument.id}
              onChange={(event) => navigateToDocument(event.target.value)}
            >
              {book.documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.chapterNumber ? `Ch ${document.chapterNumber}: ` : ""}
                  {document.title}
                </option>
              ))}
            </select>
          </div>

          <article id="article" className="mx-auto max-w-[980px]">
            <ArticleHeader document={selectedDocument} chapter={selectedChapter} onCopySourcePath={copySourcePath} copied={copied} />

            {selectedDocument.coverImage ? (
              <figure className="mb-8 overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--panel)]">
                <img
                  alt=""
                  className="max-h-[420px] w-full object-contain"
                  decoding="async"
                  loading="eager"
                  src={selectedDocument.coverImage}
                />
              </figure>
            ) : null}

            <div className="article-prose" dangerouslySetInnerHTML={{ __html: selectedDocument.html }} />
          </article>
        </main>

        <aside className="hidden border-l border-[var(--line)] bg-[var(--surface)] xl:sticky xl:top-16 xl:block xl:h-[calc(100vh-4rem)] xl:overflow-y-auto">
          <ReaderRail document={selectedDocument} readingProgress={readingProgress} onNavigate={navigateToDocument} />
        </aside>
      </div>
    </div>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
}

function Metric({ label, value }: MetricProps): JSX.Element {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase text-[var(--muted)]">{label}</span>
      <span className="block text-sm font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

interface BookNavigationProps {
  readonly chapters: BookChapter[];
  readonly chapterDocuments: BookDocument[];
  readonly query: string;
  readonly searchHits: SearchHit[];
  readonly selectedDocumentId: string;
  readonly selectedChapterNumber?: number;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function BookNavigation({
  chapters,
  chapterDocuments,
  query,
  searchHits,
  selectedDocumentId,
  selectedChapterNumber,
  onNavigate,
}: BookNavigationProps): JSX.Element {
  const hasQuery = query.trim().length > 0;

  return (
    <nav aria-label="Book navigation" className="space-y-6 p-4">
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted)]">
          <Library size={15} />
          Library
        </div>

        <button
          className={`chapter-button ${selectedDocumentId === "overview" ? "chapter-button-active" : ""}`}
          type="button"
          onClick={() => onNavigate("overview")}
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">Book Overview</span>
            <span className="block truncate text-xs text-[var(--muted)]">Root index and reading protocol</span>
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>

        <div className="mt-3 space-y-2">
          {chapters.map((chapter) => {
            const firstDocumentId = chapter.documentIds[0];
            const isActive = selectedChapterNumber === chapter.number;
            const disabled = chapter.status === "planned" || !firstDocumentId;

            return (
              <button
                key={chapter.number}
                className={`chapter-button ${isActive ? "chapter-button-active" : ""}`}
                disabled={disabled}
                type="button"
                onClick={() => firstDocumentId && onNavigate(firstDocumentId)}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--wash)] text-xs font-semibold">
                  {String(chapter.number).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{chapter.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {chapter.status === "available" ? `${chapter.documentIds.length} documents` : "Planned"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 text-xs font-semibold uppercase text-[var(--muted)]">
          {hasQuery ? "Search Results" : "Current Chapter"}
        </div>

        <div className="space-y-2">
          {(hasQuery ? searchHits.map((hit) => hit.document) : chapterDocuments).map((document) => (
            <button
              key={document.id}
              className={`document-button ${selectedDocumentId === document.id ? "document-button-active" : ""}`}
              type="button"
              onClick={() => onNavigate(document.id)}
            >
              <span className="line-clamp-2 text-sm font-semibold">{document.title}</span>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                {document.chapterNumber ? `Chapter ${document.chapterNumber}` : "Book"} · {document.readingMinutes} min
              </span>
            </button>
          ))}

          {hasQuery && searchHits.length === 0 ? <p className="rounded-[8px] border border-[var(--line)] p-3 text-sm text-[var(--muted)]">No matches.</p> : null}
        </div>
      </section>
    </nav>
  );
}

interface ArticleHeaderProps {
  readonly document: BookDocument;
  readonly chapter?: BookChapter;
  readonly copied: boolean;
  readonly onCopySourcePath: () => void;
}

function ArticleHeader({ document, chapter, copied, onCopySourcePath }: ArticleHeaderProps): JSX.Element {
  return (
    <header className="mb-8 border-b border-[var(--line)] pb-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {document.chapterNumber ? (
          <span className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Chapter {String(document.chapterNumber).padStart(2, "0")}
          </span>
        ) : (
          <span className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Overview
          </span>
        )}
        <span className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase text-[var(--muted)]">
          {document.readingMinutes} min
        </span>
        <span className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase text-[var(--muted)]">
          {formatNumber(document.wordCount)} words
        </span>
        <button
          aria-label="Copy source path"
          className="icon-button ml-auto"
          title="Copy source path"
          type="button"
          onClick={onCopySourcePath}
        >
          {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
        </button>
      </div>

      <h1 className="max-w-[900px] text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">{document.title}</h1>

      {chapter?.conclusion ? <p className="mt-4 max-w-[850px] text-base leading-7 text-[var(--muted)]">{chapter.conclusion}</p> : null}

      <p className="mt-4 break-all text-sm text-[var(--muted)]">{document.relativePath}</p>
    </header>
  );
}

interface ReaderRailProps {
  readonly document: BookDocument;
  readonly readingProgress: number;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function ReaderRail({ document, readingProgress, onNavigate }: ReaderRailProps): JSX.Element {
  const visibleHeadings = document.headings.filter((heading) => heading.depth >= 2 && heading.depth <= 3).slice(0, 18);

  return (
    <div className="space-y-6 p-4">
      <section className="rounded-[8px] border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-[var(--muted)]">
          <span>Reading</span>
          <span>{readingProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--wash)]">
          <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${readingProgress}%` }} />
        </div>
      </section>

      <section>
        <div className="mb-3 text-xs font-semibold uppercase text-[var(--muted)]">Sections</div>
        <div className="space-y-1">
          {visibleHeadings.map((heading) => (
            <button
              key={heading.id}
              className={`section-link ${heading.depth === 3 ? "pl-5" : ""}`}
              type="button"
              onClick={() => onNavigate(document.id, heading.id)}
            >
              {heading.title}
            </button>
          ))}

          {visibleHeadings.length === 0 ? <p className="text-sm text-[var(--muted)]">No section headings.</p> : null}
        </div>
      </section>
    </div>
  );
}

export default App;
