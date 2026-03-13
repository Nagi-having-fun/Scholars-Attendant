export type PaperCollectorConfig = {
  databaseId: string;
  parentPageId: string;
};

export type PaperMetadata = {
  title: string;
  authors: string;
  institution: string;
  publishedDate: string;
  sourceUrl: string;
  paperUrl: string;
  summary: string;
  contributions: string;
  tags: string[];
  status: "Unread" | "Reading" | "Read";
};
