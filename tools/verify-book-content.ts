import fs from "node:fs";
import path from "node:path";
import type { BookContent, BookDocument, BookDocumentContent } from "../src/types";

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "public");
const contentPath = path.join(publicRoot, "book-content.json");
const documentContentRoot = path.join(publicRoot, "book-documents");
const imageSourcePattern = /<img[^>]+src="([^"]+)"/g;
const markdownLinkPattern = /(?<!!)\[[^\]]*]\(([^)]+)\)/g;

function isExternalUrl(input: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(input);
}

function isInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function localAssetPath(assetUrl: string): string | undefined {
  if (isExternalUrl(assetUrl)) {
    return undefined;
  }

  const pathname = assetUrl.split(/[?#]/, 1)[0];
  const decodedPath = decodeURIComponent(pathname);
  const resolvedPath = path.resolve(publicRoot, decodedPath);

  return isInside(publicRoot, resolvedPath) ? resolvedPath : undefined;
}

function imageSources(html: string): string[] {
  return [...html.matchAll(imageSourcePattern)].map((match) => match[1]);
}

function readDocumentContent(document: BookDocument, errors: string[]): BookDocumentContent | undefined {
  const contentFilePath = path.resolve(documentContentRoot, `${document.id}.json`);
  if (!isInside(documentContentRoot, contentFilePath) || !fs.existsSync(contentFilePath)) {
    errors.push(`${document.id}: generated document body is missing`);
    return undefined;
  }

  const content = JSON.parse(fs.readFileSync(contentFilePath, "utf8")) as BookDocumentContent;
  if (content.id !== document.id) {
    errors.push(`${document.id}: generated document body has mismatched id '${content.id}'`);
  }

  return content;
}

function markdownDestination(rawDestination: string): string {
  const trimmedDestination = rawDestination.trim();

  if (trimmedDestination.startsWith("<")) {
    const closingIndex = trimmedDestination.indexOf(">");
    return closingIndex > 1 ? trimmedDestination.slice(1, closingIndex) : trimmedDestination;
  }

  const whitespaceIndex = trimmedDestination.search(/\s/);
  return whitespaceIndex >= 0 ? trimmedDestination.slice(0, whitespaceIndex) : trimmedDestination;
}

function verifyMarkdownLinks(document: BookDocument, errors: string[]): void {
  if (!fs.existsSync(document.sourcePath)) {
    errors.push(`${document.id}: source Markdown is missing at '${document.relativePath}'`);
    return;
  }

  const markdownText = fs.readFileSync(document.sourcePath, "utf8");
  for (const match of markdownText.matchAll(markdownLinkPattern)) {
    const destination = markdownDestination(match[1]);
    if (destination.startsWith("#") || isExternalUrl(destination)) {
      continue;
    }

    const pathname = destination.split(/[?#]/, 1)[0];
    if (!/\.md$/i.test(pathname)) {
      continue;
    }

    const resolvedPath = path.resolve(path.dirname(document.sourcePath), decodeURIComponent(pathname));
    if (!isInside(projectRoot, resolvedPath) || !fs.existsSync(resolvedPath)) {
      errors.push(`${document.id}: Markdown link does not resolve: '${destination}'`);
    }
  }
}

function verifyDocument(document: BookDocument, errors: string[]): void {
  verifyMarkdownLinks(document, errors);
  const documentContent = readDocumentContent(document, errors);

  const seenHeadingIds = new Set<string>();
  for (const heading of document.headings) {
    if (seenHeadingIds.has(heading.id)) {
      errors.push(`${document.id}: duplicate heading id '${heading.id}'`);
    }
    seenHeadingIds.add(heading.id);
  }

  const seenImageSources = new Set<string>();
  for (const source of imageSources(documentContent?.html ?? "")) {
    if (source === document.coverImage) {
      errors.push(`${document.id}: cover image is repeated in body HTML`);
    }

    if (seenImageSources.has(source)) {
      errors.push(`${document.id}: body image '${source}' is repeated`);
    }
    seenImageSources.add(source);

    const assetPath = localAssetPath(source);
    if (assetPath && !fs.existsSync(assetPath)) {
      errors.push(`${document.id}: body image asset is missing at '${source}'`);
    }
  }

  if (document.coverImage) {
    const coverPath = localAssetPath(document.coverImage);
    if (coverPath && !fs.existsSync(coverPath)) {
      errors.push(`${document.id}: cover image asset is missing at '${document.coverImage}'`);
    }
  }

  if (document.coverImageFull) {
    const fullCoverPath = localAssetPath(document.coverImageFull);
    if (fullCoverPath && !fs.existsSync(fullCoverPath)) {
      errors.push(`${document.id}: full-resolution cover image asset is missing at '${document.coverImageFull}'`);
    }
  }
}

function verifyContent(content: BookContent): string[] {
  const errors: string[] = [];
  const documentIds = new Set<string>();

  for (const document of content.documents) {
    if (documentIds.has(document.id)) {
      errors.push(`duplicate document id '${document.id}'`);
    }
    documentIds.add(document.id);
    verifyDocument(document, errors);
  }

  for (const chapter of content.chapters) {
    if (chapter.status !== "available" || chapter.documentIds.length === 0) {
      errors.push(`chapter ${chapter.number} has no publishable documents`);
    }

    for (const documentId of chapter.documentIds) {
      if (!documentIds.has(documentId)) {
        errors.push(`chapter ${chapter.number} references missing document '${documentId}'`);
      }
    }

    const overviewId = `ch${String(chapter.number).padStart(2, "0")}-overview`;
    if (!chapter.documentIds.includes(overviewId)) {
      errors.push(`chapter ${chapter.number} is missing its overview document`);
    }
  }

  const chapterNumbers = content.chapters.map((chapter) => chapter.number).sort((left, right) => left - right);
  chapterNumbers.forEach((chapterNumber, index) => {
    const expectedNumber = index + 1;
    if (chapterNumber !== expectedNumber) {
      errors.push(`chapter sequence is not contiguous at ${chapterNumber}; expected ${expectedNumber}`);
    }
  });

  if (content.metrics.documentsTotal !== content.documents.length) {
    errors.push("document metric does not match generated document count");
  }

  if (content.metrics.chaptersAvailable !== content.chapters.length) {
    errors.push("not every indexed chapter is available");
  }

  return errors;
}

function main(): void {
  if (!fs.existsSync(contentPath)) {
    throw new Error("book-content.json is missing; run the generator first");
  }

  const content = JSON.parse(fs.readFileSync(contentPath, "utf8")) as BookContent;
  const errors = verifyContent(content);

  if (errors.length > 0) {
    throw new Error(`Book content verification failed:\n- ${errors.join("\n- ")}`);
  }

  console.log(
    `Verified ${content.metrics.documentsTotal} documents across ${content.metrics.chaptersAvailable}/${content.metrics.chaptersTotal} chapters with unique, resolvable images.`,
  );
}

main();
