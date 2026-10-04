export interface PromptData {
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
}

export interface Prompt extends PromptData {
  id: string;
  copyCount: number;
  lastCopiedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type SortKey = 'popular' | 'recent' | 'new' | 'title';
