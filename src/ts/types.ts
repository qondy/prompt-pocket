export interface PromptData {
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  /** 所属フォルダのID（'' は未分類） */
  folderId: string;
}

export interface Prompt extends PromptData {
  id: string;
  copyCount: number;
  lastCopiedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type SortKey = 'popular' | 'recent' | 'new' | 'title';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type ViewMode = 'card' | 'list';
