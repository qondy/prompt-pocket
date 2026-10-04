import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, increment, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Prompt, PromptData } from './types';

export const MAX_TITLE = 80;
export const MAX_BODY = 8000;
export const MAX_TAGS = 10;
export const MAX_TAG_LEN = 20;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const msOrNull = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);

/** 「文章, コード #画像」のような入力をタグ配列に正規化する */
export function parseTags(input: string | unknown[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,、，\s#＃]+/);
  const out: string[] = [];
  raw.forEach((t) => {
    if (typeof t !== 'string') return;
    const tag = t.trim().replace(/^[#＃]+/, '').slice(0, MAX_TAG_LEN);
    if (tag && !out.includes(tag) && out.length < MAX_TAGS) out.push(tag);
  });
  return out;
}

function sanitize(data: PromptData): PromptData {
  return {
    title: data.title.trim().slice(0, MAX_TITLE),
    body: data.body.slice(0, MAX_BODY),
    tags: parseTags(data.tags),
    pinned: data.pinned === true,
  };
}

const promptsCol = (uid: string) => collection(db, 'users', uid, 'prompts');

export function subscribePrompts(
  uid: string,
  onData: (list: Prompt[]) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(promptsCol(uid), (snap) => {
    const list: Prompt[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const createdAt = msOrNull(data.createdAt);
      if (!createdAt || typeof data.title !== 'string' || typeof data.body !== 'string') return;
      list.push({
        id: d.id,
        title: str(data.title, MAX_TITLE),
        body: str(data.body, MAX_BODY),
        tags: parseTags(Array.isArray(data.tags) ? data.tags : []),
        pinned: data.pinned === true,
        copyCount: typeof data.copyCount === 'number' && data.copyCount > 0 ? Math.floor(data.copyCount) : 0,
        lastCopiedAt: msOrNull(data.lastCopiedAt),
        createdAt,
        updatedAt: msOrNull(data.updatedAt) ?? createdAt,
      });
    });
    onData(list);
  }, onError);
}

export async function createPrompt(uid: string, data: PromptData): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(promptsCol(uid), {
    ...sanitize(data), copyCount: 0, lastCopiedAt: null, createdAt: now, updatedAt: now,
  });
  return ref.id;
}

export function updatePrompt(uid: string, id: string, data: PromptData): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'prompts', id), { ...sanitize(data), updatedAt: Date.now() });
}

export function setPinned(uid: string, id: string, pinned: boolean): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'prompts', id), { pinned });
}

export function recordCopy(uid: string, id: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'prompts', id), { copyCount: increment(1), lastCopiedAt: Date.now() });
}

export function deletePrompt(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'prompts', id));
}

export async function createPrompts(uid: string, items: PromptData[]): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  items.forEach((item, i) => {
    // 並び順を登録順にそろえるため、作成時刻を1msずつずらす
    const t = now - i;
    batch.set(doc(promptsCol(uid)), {
      ...sanitize(item), copyCount: 0, lastCopiedAt: null, createdAt: t, updatedAt: t,
    });
  });
  await batch.commit();
}
