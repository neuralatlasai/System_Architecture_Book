import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const chaptersDirectory = path.resolve(process.cwd(), "chapters");
const concurrency = 4;

interface ConversionResult {
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly sourceBytes: number;
  readonly outputBytes: number;
}

function collectFiles(root: string, extension: string): string[] {
  const matches: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) {
        matches.push(absolutePath);
      }
    }
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

function assertInsideChapters(filePath: string): void {
  const relativePath = path.relative(chaptersDirectory, path.resolve(filePath));
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to modify a path outside chapters: ${filePath}`);
  }
}

async function convertImage(sourcePath: string): Promise<ConversionResult> {
  assertInsideChapters(sourcePath);
  const outputPath = sourcePath.replace(/\.png$/i, ".webp");
  const temporaryPath = `${outputPath}.tmp`;
  assertInsideChapters(outputPath);
  assertInsideChapters(temporaryPath);

  const sourceMetadata = await sharp(sourcePath).metadata();
  const { data, info } = await sharp(sourcePath)
    .webp({ effort: 6, quality: 88, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  if (
    sourceMetadata.width !== info.width ||
    sourceMetadata.height !== info.height ||
    info.format !== "webp"
  ) {
    throw new Error(`Image verification failed: ${sourcePath}`);
  }

  fs.writeFileSync(temporaryPath, data);
  fs.rmSync(outputPath, { force: true });
  fs.renameSync(temporaryPath, outputPath);

  return {
    sourcePath,
    outputPath,
    sourceBytes: fs.statSync(sourcePath).size,
    outputBytes: fs.statSync(outputPath).size,
  };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function rewriteMarkdownReferences(): number {
  let replacementCount = 0;

  for (const markdownPath of collectFiles(chaptersDirectory, ".md")) {
    const source = fs.readFileSync(markdownPath, "utf8");
    const updated = source.replace(/(\]\(images\/[^)\r\n]+)\.png(\))/g, (_match, prefix: string, suffix: string) => {
      replacementCount += 1;
      return `${prefix}.webp${suffix}`;
    });

    if (updated !== source) fs.writeFileSync(markdownPath, updated, "utf8");
  }

  return replacementCount;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const sourceImages = collectFiles(chaptersDirectory, ".png");
  if (sourceImages.length === 0) {
    console.log("No PNG chapter images require optimization.");
    return;
  }

  const conversions = await mapWithConcurrency(sourceImages, concurrency, convertImage);
  const replacementCount = rewriteMarkdownReferences();

  if (replacementCount !== conversions.length) {
    throw new Error(
      `Reference count mismatch: converted ${conversions.length} images but updated ${replacementCount} Markdown references.`,
    );
  }

  for (const conversion of conversions) {
    assertInsideChapters(conversion.sourcePath);
    fs.rmSync(conversion.sourcePath);
  }

  const sourceBytes = conversions.reduce((total, result) => total + result.sourceBytes, 0);
  const outputBytes = conversions.reduce((total, result) => total + result.outputBytes, 0);
  const reduction = ((1 - outputBytes / sourceBytes) * 100).toFixed(1);

  console.log(
    `Optimized ${conversions.length} chapter images: ${formatMegabytes(sourceBytes)} -> ${formatMegabytes(outputBytes)} (${reduction}% smaller).`,
  );
}

await main();
