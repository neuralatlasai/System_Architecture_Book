import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

interface ChapterIndexEntry {
  readonly number: number;
  readonly title: string;
  readonly conclusion: string;
  readonly sourceHref?: string;
}

interface SourceDocument {
  readonly id: string;
  readonly sourcePath: string;
  readonly relativePath: string;
  readonly chapterNumber?: number;
  readonly order: number;
  readonly kind: "book-overview" | "chapter-overview" | "chapter-note";
}

interface RenderHeading {
  readonly depth: number;
  readonly id: string;
  readonly title: string;
}

interface RenderEnvironment {
  readonly sourcePath: string;
  readonly headings: RenderHeading[];
  readonly headingCounts: Map<string, number>;
  readonly seenImages: Set<string>;
  readonly coverImage?: string;
}

interface BookDocument {
  readonly id: string;
  readonly title: string;
  readonly chapterNumber?: number;
  readonly chapterTitle?: string;
  readonly order: number;
  readonly kind: SourceDocument["kind"];
  readonly sourcePath: string;
  readonly relativePath: string;
  readonly excerpt: string;
  readonly readingMinutes: number;
  readonly wordCount: number;
  readonly headings: RenderHeading[];
  readonly coverImage?: string;
  readonly html: string;
  readonly searchText: string;
}

interface BookChapter {
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  readonly conclusion: string;
  readonly status: "available" | "planned";
  readonly documentIds: string[];
}

interface BookContent {
  readonly title: string;
  readonly subtitle: string;
  readonly generatedAt: string;
  readonly chapters: BookChapter[];
  readonly documents: BookDocument[];
  readonly metrics: {
    readonly chaptersTotal: number;
    readonly chaptersAvailable: number;
    readonly documentsTotal: number;
    readonly wordsTotal: number;
  };
}

const projectRoot = process.cwd();
const chaptersRoot = path.join(projectRoot, "chapters");
const publicRoot = path.join(projectRoot, "public");
const publicAssetRoot = path.join(projectRoot, "public", "book-assets");
const markdown = new MarkdownIt({
  breaks: false,
  html: false,
  linkify: true,
  typographer: true,
});

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function isInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "section";
}

function normalizeSearchText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_>#|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(input: string): number {
  const normalized = stripMarkdown(input);
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

function estimateReadingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 225));
}

function firstHeading(markdownText: string, fallback: string): string {
  const match = markdownText.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function stripLeadingDocumentChrome(markdownText: string): string {
  const withoutByteOrderMark = markdownText.replace(/^\uFEFF?/, "");
  const withoutTitle = withoutByteOrderMark.replace(/^#\s+.+(?:\r?\n|$)/, "");

  return withoutTitle.replace(/^(?:[ \t]*\r?\n)*!\[[^\]\r\n]*]\([^)]+\)[ \t]*(?:\r?\n|$)/, "").trimStart();
}

function parseMarkdownImageDestination(rawDestination: string): string {
  const trimmedDestination = rawDestination.trim();

  if (trimmedDestination.startsWith("<")) {
    const closingIndex = trimmedDestination.indexOf(">");
    return closingIndex > 1 ? trimmedDestination.slice(1, closingIndex) : trimmedDestination;
  }

  const whitespaceIndex = trimmedDestination.search(/\s/);
  return whitespaceIndex >= 0 ? trimmedDestination.slice(0, whitespaceIndex) : trimmedDestination;
}

function leadingCoverImage(markdownText: string, sourcePath: string): string | undefined {
  const withoutByteOrderMark = markdownText.replace(/^\uFEFF?/, "");
  const withoutTitle = withoutByteOrderMark.replace(/^#\s+.+(?:\r?\n|$)/, "");
  const imageMatch = withoutTitle.match(/^(?:[ \t]*\r?\n)*!\[[^\]\r\n]*]\(([^)]+)\)/);

  if (!imageMatch) {
    return undefined;
  }

  const rawSrc = parseMarkdownImageDestination(imageMatch[1]);

  if (rawSrc.length === 0) {
    return undefined;
  }

  if (isExternalUrl(rawSrc)) {
    return rawSrc;
  }

  const { pathname, suffix } = splitUrl(rawSrc);
  const resolvedPath = path.resolve(path.dirname(sourcePath), decodeURIComponent(pathname));
  const publicPath = copyAsset(resolvedPath);

  return publicPath.length > 0 ? `${publicPath}${suffix}` : undefined;
}

function firstMeaningfulParagraph(markdownText: string): string {
  const abstractMatch = markdownText.match(/^##\s+Abstract\s*\n+([\s\S]*?)(?:\n##\s+|\n#\s+|$)/im);
  const source = abstractMatch ? abstractMatch[1] : markdownText;
  const paragraph = source
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !part.startsWith("#") && !part.startsWith("|") && !part.startsWith("!"));

  return paragraph ? stripMarkdown(paragraph).slice(0, 360) : "";
}

function compareMarkdownFiles(left: string, right: string): number {
  if (left === "README.md") {
    return right === "README.md" ? 0 : -1;
  }

  if (right === "README.md") {
    return 1;
  }

  const leftOrder = Number.parseInt(left.match(/^(\d+)/)?.[1] ?? "999", 10);
  const rightOrder = Number.parseInt(right.match(/^(\d+)/)?.[1] ?? "999", 10);

  return leftOrder === rightOrder ? left.localeCompare(right) : leftOrder - rightOrder;
}

function compareMarkdownPaths(left: string, right: string): number {
  const leftSegments = toPosixPath(left).split("/");
  const rightSegments = toPosixPath(right).split("/");
  const maxLength = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];

    if (leftSegment === undefined) {
      return -1;
    }

    if (rightSegment === undefined) {
      return 1;
    }

    if (leftSegment === rightSegment) {
      continue;
    }

    const bothFiles = leftSegment.endsWith(".md") && rightSegment.endsWith(".md");
    const result = bothFiles ? compareMarkdownFiles(leftSegment, rightSegment) : leftSegment.localeCompare(rightSegment);

    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

function collectMarkdownFiles(rootDir: string): string[] {
  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push(absolutePath);
      }
    }
  }

  return result;
}

function parseChapterIndex(readmeText: string): ChapterIndexEntry[] {
  const entries: ChapterIndexEntry[] = [];
  const rowPattern = /^\|\s*(\d+)\s*\|\s*(?:\[([^\]]+)]\(([^)]+)\)|([^|]+?))\s*\|\s*(.*?)\s*\|$/gm;

  for (const match of readmeText.matchAll(rowPattern)) {
    const number = Number.parseInt(match[1], 10);
    const linkedTitle = match[2]?.trim();
    const sourceHref = match[3]?.trim();
    const plainTitle = match[4]?.trim();
    const conclusion = match[5]?.trim() ?? "";

    if (Number.isFinite(number) && (linkedTitle || plainTitle)) {
      entries.push({
        number,
        title: linkedTitle ?? plainTitle ?? `Chapter ${number}`,
        conclusion,
        sourceHref,
      });
    }
  }

  return entries;
}

function discoverSourceDocuments(): SourceDocument[] {
  const documents: SourceDocument[] = [
    {
      id: "overview",
      sourcePath: path.join(projectRoot, "README.md"),
      relativePath: "README.md",
      order: -1,
      kind: "book-overview",
    },
  ];

  if (!fs.existsSync(chaptersRoot)) {
    return documents;
  }

  const chapterDirs = fs
    .readdirSync(chaptersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(/^(\d{2})-(.+)$/);
      return match
        ? {
            chapterNumber: Number.parseInt(match[1], 10),
            chapterSlug: match[2],
            dirname: entry.name,
          }
        : undefined;
    })
    .filter((entry): entry is { chapterNumber: number; chapterSlug: string; dirname: string } => Boolean(entry))
    .sort((left, right) => left.chapterNumber - right.chapterNumber);

  for (const chapterDir of chapterDirs) {
    const absoluteChapterDir = path.join(chaptersRoot, chapterDir.dirname);
    const markdownFiles = collectMarkdownFiles(absoluteChapterDir)
      .map((filePath) => path.relative(absoluteChapterDir, filePath))
      .sort(compareMarkdownPaths);

    markdownFiles.forEach((relativeFilePath, index) => {
      const absoluteFilePath = path.join(absoluteChapterDir, relativeFilePath);
      const basename = path.basename(relativeFilePath).replace(/\.md$/i, "");
      const isOverview = toPosixPath(relativeFilePath) === "README.md";
      const relativeSlug = toPosixPath(relativeFilePath).replace(/\.md$/i, "");
      documents.push({
        id: isOverview
          ? `ch${String(chapterDir.chapterNumber).padStart(2, "0")}-overview`
          : `ch${String(chapterDir.chapterNumber).padStart(2, "0")}-${slugify(relativeSlug)}`,
        sourcePath: absoluteFilePath,
        relativePath: toPosixPath(path.relative(projectRoot, absoluteFilePath)),
        chapterNumber: chapterDir.chapterNumber,
        order: index,
        kind: isOverview ? "chapter-overview" : "chapter-note",
      });
    });
  }

  return documents;
}

function splitUrl(input: string): { pathname: string; suffix: string } {
  const hashIndex = input.indexOf("#");
  const queryIndex = input.indexOf("?");
  const cutIndexCandidates = [hashIndex, queryIndex].filter((index) => index >= 0);
  const cutIndex = cutIndexCandidates.length > 0 ? Math.min(...cutIndexCandidates) : -1;

  if (cutIndex < 0) {
    return { pathname: input, suffix: "" };
  }

  return {
    pathname: input.slice(0, cutIndex),
    suffix: input.slice(cutIndex),
  };
}

function encodePublicPath(relativePath: string): string {
  return toPosixPath(relativePath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function copyAsset(assetPath: string): string {
  if (!isInside(projectRoot, assetPath) || !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return "";
  }

  const relativePath = path.relative(projectRoot, assetPath);
  const destinationPath = path.join(publicAssetRoot, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(assetPath, destinationPath);

  return `book-assets/${encodePublicPath(relativePath)}`;
}

function isExternalUrl(input: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(input);
}

function configureMarkdownRenderer(fileToDocumentId: ReadonlyMap<string, string>): void {
  const defaultHeadingOpen =
    markdown.renderer.rules.heading_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const defaultLinkOpen =
    markdown.renderer.rules.link_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const defaultImage =
    markdown.renderer.rules.image ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const defaultTableOpen =
    markdown.renderer.rules.table_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const defaultTableClose =
    markdown.renderer.rules.table_close ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

  markdown.renderer.rules.heading_open = (tokens, index, options, env: RenderEnvironment, self) => {
    const token = tokens[index];
    const inlineToken = tokens[index + 1];
    const title = inlineToken?.content?.trim() ?? "Section";
    const depth = Number.parseInt(token.tag.replace("h", ""), 10);
    const baseId = slugify(title);
    const seenCount = env.headingCounts.get(baseId) ?? 0;
    const id = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;

    env.headingCounts.set(baseId, seenCount + 1);
    env.headings.push({ depth, id, title });
    token.attrSet("id", id);

    return defaultHeadingOpen(tokens, index, options, env, self);
  };

  markdown.renderer.rules.link_open = (tokens, index, options, env: RenderEnvironment, self) => {
    const token = tokens[index];
    const rawHref = token.attrGet("href");

    if (rawHref) {
      const rewrittenHref = rewriteHref(env.sourcePath, rawHref, fileToDocumentId);
      token.attrSet("href", rewrittenHref.href);

      if (rewrittenHref.external) {
        token.attrSet("target", "_blank");
        token.attrSet("rel", "noreferrer noopener");
      }
    }

    return defaultLinkOpen(tokens, index, options, env, self);
  };

  markdown.renderer.rules.image = (tokens, index, options, env: RenderEnvironment, self) => {
    const token = tokens[index];
    const rawSrc = token.attrGet("src");
    let renderedSrc = rawSrc ?? "";

    if (rawSrc && !isExternalUrl(rawSrc)) {
      const { pathname, suffix } = splitUrl(rawSrc);
      const resolvedPath = path.resolve(path.dirname(env.sourcePath), decodeURIComponent(pathname));
      const publicPath = copyAsset(resolvedPath);

      if (publicPath.length > 0) {
        renderedSrc = `${publicPath}${suffix}`;
        token.attrSet("src", renderedSrc);
      }
    }

    if (renderedSrc.length === 0 || renderedSrc === env.coverImage || env.seenImages.has(renderedSrc)) {
      return "";
    }

    env.seenImages.add(renderedSrc);

    token.attrSet("loading", "lazy");
    token.attrSet("decoding", "async");

    return defaultImage(tokens, index, options, env, self);
  };

  markdown.renderer.rules.table_open = (tokens, index, options, env, self) =>
    `<div class="table-scroll">${defaultTableOpen(tokens, index, options, env, self)}`;

  markdown.renderer.rules.table_close = (tokens, index, options, env, self) =>
    `${defaultTableClose(tokens, index, options, env, self)}</div>`;
}

function rewriteHref(
  sourcePath: string,
  rawHref: string,
  fileToDocumentId: ReadonlyMap<string, string>,
): { href: string; external: boolean } {
  if (rawHref.startsWith("#")) {
    return { href: rawHref, external: false };
  }

  if (isExternalUrl(rawHref)) {
    return { href: rawHref, external: true };
  }

  const { pathname, suffix } = splitUrl(rawHref);
  const resolvedPath = path.resolve(path.dirname(sourcePath), decodeURIComponent(pathname));

  if (!isInside(projectRoot, resolvedPath)) {
    return { href: rawHref, external: false };
  }

  if (/\.md$/i.test(pathname)) {
    const documentId = fileToDocumentId.get(resolvedPath);
    if (documentId) {
      const hash = suffix.startsWith("#") ? suffix.slice(1) : "";
      const section = hash.length > 0 ? `&section=${encodeURIComponent(hash)}` : "";
      return { href: `#doc=${encodeURIComponent(documentId)}${section}`, external: false };
    }
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    const publicPath = copyAsset(resolvedPath);
    if (publicPath.length > 0) {
      return { href: `${publicPath}${suffix}`, external: true };
    }
  }

  return { href: rawHref, external: false };
}

function sanitizeRenderedHtml(input: string): string {
  const sanitized = sanitizeHtml(input, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "del",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      code: ["class"],
      div: ["class"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
      img: ["alt", "decoding", "loading", "src", "title"],
      span: ["class"],
      th: ["align"],
      td: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
  });

  return sanitized.replace(/<p>\s*<\/p>/g, "");
}

function buildContent(): BookContent {
  const rootReadmePath = path.join(projectRoot, "README.md");
  const rootReadmeText = fs.readFileSync(rootReadmePath, "utf8");
  const chapterEntries = parseChapterIndex(rootReadmeText);
  const sourceDocuments = discoverSourceDocuments();
  const fileToDocumentId = new Map(sourceDocuments.map((document) => [document.sourcePath, document.id]));
  const sourceDocumentById = new Map(sourceDocuments.map((document) => [document.id, document]));
  const chapterEntryByNumber = new Map(chapterEntries.map((entry) => [entry.number, entry]));

  fs.rmSync(publicAssetRoot, { force: true, recursive: true });
  configureMarkdownRenderer(fileToDocumentId);

  const documents = sourceDocuments.map((sourceDocument) => {
    const markdownText = fs.readFileSync(sourceDocument.sourcePath, "utf8");
    const fallbackTitle = sourceDocument.kind === "book-overview" ? "System Architecture Book" : sourceDocument.relativePath;
    const title = firstHeading(markdownText, fallbackTitle);
    const wordCount = countWords(markdownText);
    const coverImage = leadingCoverImage(markdownText, sourceDocument.sourcePath);
    const renderedMarkdownText = stripLeadingDocumentChrome(markdownText);
    const renderEnvironment: RenderEnvironment = {
      sourcePath: sourceDocument.sourcePath,
      headings: [],
      headingCounts: new Map(),
      seenImages: new Set(),
      coverImage,
    };
    const html = sanitizeRenderedHtml(markdown.render(renderedMarkdownText, renderEnvironment));
    const chapterEntry =
      sourceDocument.chapterNumber === undefined ? undefined : chapterEntryByNumber.get(sourceDocument.chapterNumber);
    const plainText = stripMarkdown(markdownText);

    return {
      id: sourceDocument.id,
      title,
      chapterNumber: sourceDocument.chapterNumber,
      chapterTitle: chapterEntry?.title,
      order: sourceDocument.order,
      kind: sourceDocument.kind,
      sourcePath: sourceDocument.sourcePath,
      relativePath: sourceDocument.relativePath,
      excerpt: firstMeaningfulParagraph(markdownText),
      readingMinutes: estimateReadingMinutes(wordCount),
      wordCount,
      headings: renderEnvironment.headings,
      coverImage,
      html,
      searchText: normalizeSearchText(`${title} ${chapterEntry?.title ?? ""} ${plainText}`),
    } satisfies BookDocument;
  });

  const documentIdsByChapter = new Map<number, string[]>();
  for (const document of documents) {
    if (document.chapterNumber === undefined) {
      continue;
    }

    const existingDocuments = documentIdsByChapter.get(document.chapterNumber) ?? [];
    existingDocuments.push(document.id);
    documentIdsByChapter.set(document.chapterNumber, existingDocuments);
  }

  const knownChapterNumbers = new Set([
    ...chapterEntries.map((entry) => entry.number),
    ...sourceDocuments
      .map((document) => document.chapterNumber)
      .filter((chapterNumber): chapterNumber is number => chapterNumber !== undefined),
  ]);

  const chapters: BookChapter[] = [...knownChapterNumbers]
    .sort((left, right) => left - right)
    .map((chapterNumber) => {
      const chapterEntry = chapterEntryByNumber.get(chapterNumber);
      const ids = documentIdsByChapter.get(chapterNumber) ?? [];
      const firstSourceDocument = ids.length > 0 ? sourceDocumentById.get(ids[0]) : undefined;
      const fallbackTitle =
        firstSourceDocument === undefined
          ? `Chapter ${String(chapterNumber).padStart(2, "0")}`
          : firstHeading(fs.readFileSync(firstSourceDocument.sourcePath, "utf8"), `Chapter ${chapterNumber}`);

      return {
        number: chapterNumber,
        slug: slugify(chapterEntry?.title ?? fallbackTitle),
        title: chapterEntry?.title ?? fallbackTitle.replace(/^Chapter\s+\d+:\s*/i, ""),
        conclusion: chapterEntry?.conclusion ?? "",
        status: ids.length > 0 ? "available" : "planned",
        documentIds: ids,
      };
    });

  return {
    title: "System Architecture Book",
    subtitle: "Production-grade architecture notes for distributed, AI-native, and data-intensive systems.",
    generatedAt: new Date().toISOString(),
    chapters,
    documents,
    metrics: {
      chaptersTotal: chapters.length,
      chaptersAvailable: chapters.filter((chapter) => chapter.status === "available").length,
      documentsTotal: documents.length,
      wordsTotal: documents.reduce((sum, document) => sum + document.wordCount, 0),
    },
  };
}

function main(): void {
  fs.mkdirSync(publicRoot, { recursive: true });
  const content = buildContent();
  const outputPath = path.join(publicRoot, "book-content.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  console.log(
    `Generated ${content.metrics.documentsTotal} documents across ${content.metrics.chaptersAvailable}/${content.metrics.chaptersTotal} chapters.`,
  );
}

main();
