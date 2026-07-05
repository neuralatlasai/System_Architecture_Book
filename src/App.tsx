import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  ListTree,
  Moon,
  PanelLeft,
  Search,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookChapter, BookContent, BookDocument, BookHeading } from "./types";

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

function sourceFileName(document: BookDocument): string {
  const segments = document.relativePath.split("/");
  return segments[segments.length - 1] ?? document.relativePath;
}

function chapterLabel(document: BookDocument): string {
  return document.chapterNumber ? `Chapter ${String(document.chapterNumber).padStart(2, "0")}` : "Overview";
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
    return <ShellStatus title="Loading book" detail="Building the reader index." />;
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
      <section className="status-panel">
        <div className="status-mark">
          <BookOpen size={20} />
        </div>
        <h1>{title}</h1>
        <p>{detail}</p>
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
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedDocument = documentsById.get(selectedDocumentId) ?? book.documents[0];
  const selectedChapter = selectedDocument?.chapterNumber
    ? book.chapters.find((chapter) => chapter.number === selectedDocument.chapterNumber)
    : undefined;
  const selectedIndex = book.documents.findIndex((document) => document.id === selectedDocument?.id);
  const previousDocument = selectedIndex > 0 ? book.documents[selectedIndex - 1] : undefined;
  const nextDocument = selectedIndex >= 0 && selectedIndex < book.documents.length - 1 ? book.documents[selectedIndex + 1] : undefined;

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
      .slice(0, 24);
  }, [book.documents, normalizedQuery]);

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

      <header className="site-header">
        <div className="site-header-inner">
          <button
            aria-label="Open navigation"
            className="icon-button lg:hidden"
            title="Open navigation"
            type="button"
            onClick={() => setIsNavigationOpen((current) => !current)}
          >
            <PanelLeft size={18} />
          </button>

          <button className="brand-lockup" type="button" onClick={() => navigateToDocument("overview")}>
            <span className="brand-mark">
              <BookOpen size={20} />
            </span>
            <span className="brand-copy">
              <span>System Architecture</span>
              <strong>Online Book</strong>
            </span>
          </button>

          <label className="search-shell">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search documents</span>
            <input
              placeholder="Search systems, state, queues, recovery..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

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
      </header>

      <div className="reader-shell">
        <aside className={`library-pane ${isNavigationOpen ? "block" : "hidden"}`}>
          <BookNavigation
            chapters={book.chapters}
            documentsById={documentsById}
            query={query}
            searchHits={searchHits}
            selectedDocumentId={selectedDocument.id}
            selectedChapterNumber={selectedChapter?.number}
            onNavigate={navigateToDocument}
          />
        </aside>

        <main className="reader-main">
          <div className="mb-5 lg:hidden">
            <label className="document-select-label" htmlFor="document-select">
              Document
            </label>
            <select
              id="document-select"
              className="document-select"
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

          <article id="article" className="article-frame">
            <ArticleHeader document={selectedDocument} chapter={selectedChapter} onCopySourcePath={copySourcePath} copied={copied} />

            {selectedDocument.coverImage ? (
              <figure className="article-hero-media">
                <img alt="" decoding="async" loading="eager" src={selectedDocument.coverImage} />
              </figure>
            ) : null}

            <div className="article-prose" dangerouslySetInnerHTML={{ __html: selectedDocument.html }} />

            <DocumentTravel previousDocument={previousDocument} nextDocument={nextDocument} onNavigate={navigateToDocument} />
          </article>
        </main>

        <aside className="section-pane">
          <SectionTravel document={selectedDocument} onNavigate={navigateToDocument} />
        </aside>
      </div>
    </div>
  );
}

interface BookNavigationProps {
  readonly chapters: readonly BookChapter[];
  readonly documentsById: ReadonlyMap<string, BookDocument>;
  readonly query: string;
  readonly searchHits: readonly SearchHit[];
  readonly selectedDocumentId: string;
  readonly selectedChapterNumber?: number;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function BookNavigation({
  chapters,
  documentsById,
  query,
  searchHits,
  selectedDocumentId,
  selectedChapterNumber,
  onNavigate,
}: BookNavigationProps): JSX.Element {
  const hasQuery = query.trim().length > 0;

  return (
    <nav aria-label="Book navigation" className="library-nav">
      <section>
        <div className="nav-kicker">
          <ListTree size={15} />
          Library
        </div>

        <button
          className={`chapter-button ${selectedDocumentId === "overview" ? "chapter-button-active" : ""}`}
          type="button"
          onClick={() => onNavigate("overview")}
        >
          <span className="chapter-number">00</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">Book Overview</span>
            <span className="block truncate text-xs text-[var(--muted)]">README.md</span>
          </span>
        </button>
      </section>

      {hasQuery ? (
        <section>
          <div className="nav-kicker">Results</div>
          <div className="document-list">
            {searchHits.map(({ document }) => (
              <DocumentButton
                key={document.id}
                document={document}
                selected={selectedDocumentId === document.id}
                onNavigate={onNavigate}
              />
            ))}
            {searchHits.length === 0 ? <p className="empty-state">No matches.</p> : null}
          </div>
        </section>
      ) : (
        <section className="chapter-tree">
          {chapters.map((chapter) => {
            const firstDocumentId = chapter.documentIds[0];
            const isActive = selectedChapterNumber === chapter.number;
            const chapterDocuments = chapter.documentIds
              .map((documentId) => documentsById.get(documentId))
              .filter((document): document is BookDocument => Boolean(document));

            return (
              <div key={chapter.number} className="chapter-group">
                <button
                  className={`chapter-button ${isActive ? "chapter-button-active" : ""}`}
                  disabled={!firstDocumentId}
                  type="button"
                  onClick={() => firstDocumentId && onNavigate(firstDocumentId)}
                >
                  <span className="chapter-number">{String(chapter.number).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{chapter.title}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {chapter.status === "available" ? "Available" : "Planned"}
                    </span>
                  </span>
                </button>

                {isActive && chapterDocuments.length > 0 ? (
                  <div className="document-list">
                    {chapterDocuments.map((document) => (
                      <DocumentButton
                        key={document.id}
                        document={document}
                        selected={selectedDocumentId === document.id}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </nav>
  );
}

interface DocumentButtonProps {
  readonly document: BookDocument;
  readonly selected: boolean;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function DocumentButton({ document, selected, onNavigate }: DocumentButtonProps): JSX.Element {
  return (
    <button
      className={`document-button ${selected ? "document-button-active" : ""}`}
      type="button"
      onClick={() => onNavigate(document.id)}
    >
      <FileText aria-hidden="true" size={14} />
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-medium">{document.title}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{sourceFileName(document)}</span>
      </span>
    </button>
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
    <header className="article-header">
      <div className="article-eyebrow-row">
        <span className="article-eyebrow">{chapterLabel(document)}</span>
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

      <h1>{document.title}</h1>

      {chapter?.conclusion ? <p>{chapter.conclusion}</p> : null}
    </header>
  );
}

interface SectionTravelProps {
  readonly document: BookDocument;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function SectionTravel({ document, onNavigate }: SectionTravelProps): JSX.Element {
  const visibleHeadings = document.headings.filter((heading) => heading.depth >= 2 && heading.depth <= 3).slice(0, 22);

  return (
    <nav aria-label="Article sections" className="section-travel">
      <div className="nav-kicker">Sections</div>
      <div className="section-ball-list">
        {visibleHeadings.map((heading) => (
          <SectionBall key={heading.id} documentId={document.id} heading={heading} onNavigate={onNavigate} />
        ))}
        {visibleHeadings.length === 0 ? <p className="empty-state">No sections.</p> : null}
      </div>
    </nav>
  );
}

interface SectionBallProps {
  readonly documentId: string;
  readonly heading: BookHeading;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function SectionBall({ documentId, heading, onNavigate }: SectionBallProps): JSX.Element {
  return (
    <button
      className={`section-ball ${heading.depth === 3 ? "section-ball-nested" : ""}`}
      type="button"
      onClick={() => onNavigate(documentId, heading.id)}
    >
      <span aria-hidden="true" />
      <strong>{heading.title}</strong>
    </button>
  );
}

interface DocumentTravelProps {
  readonly previousDocument?: BookDocument;
  readonly nextDocument?: BookDocument;
  readonly onNavigate: (documentId: string, section?: string) => void;
}

function DocumentTravel({ previousDocument, nextDocument, onNavigate }: DocumentTravelProps): JSX.Element {
  return (
    <nav aria-label="Document travel" className="document-travel">
      {previousDocument ? (
        <button className="travel-link" type="button" onClick={() => onNavigate(previousDocument.id)}>
          <ChevronLeft aria-hidden="true" size={18} />
          <span>
            <small>Previous</small>
            <strong>{previousDocument.title}</strong>
          </span>
        </button>
      ) : (
        <span />
      )}

      {nextDocument ? (
        <button className="travel-link travel-link-next" type="button" onClick={() => onNavigate(nextDocument.id)}>
          <span>
            <small>Next</small>
            <strong>{nextDocument.title}</strong>
          </span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default App;
