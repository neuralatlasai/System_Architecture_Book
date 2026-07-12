export interface BookHeading {
  readonly depth: number;
  readonly id: string;
  readonly title: string;
}

export interface BookDocument {
  readonly id: string;
  readonly title: string;
  readonly chapterNumber?: number;
  readonly chapterTitle?: string;
  readonly order: number;
  readonly kind: "book-overview" | "chapter-overview" | "chapter-note";
  readonly sourcePath: string;
  readonly relativePath: string;
  readonly excerpt: string;
  readonly readingMinutes: number;
  readonly wordCount: number;
  readonly headings: BookHeading[];
  readonly coverImage?: string;
  readonly coverImageWidth?: number;
  readonly coverImageHeight?: number;
  readonly coverImageFull?: string;
  readonly coverImageFullWidth?: number;
  readonly coverImageFullHeight?: number;
  readonly searchText: string;
}

export interface BookDocumentContent {
  readonly id: string;
  readonly html: string;
}

export interface BookChapter {
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  readonly conclusion: string;
  readonly status: "available" | "planned";
  readonly documentIds: string[];
}

export interface BookContent {
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
