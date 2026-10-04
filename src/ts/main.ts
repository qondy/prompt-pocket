import { User } from 'firebase/auth';
import { onAuthChange, loginWithGoogle, logout } from './auth';
import { showToast, openOverlay, closeOverlay, textEl, iconEl, button } from './ui';
import { submitFeedback } from './feedback';
import { copyText } from './clipboard';
import {
  subscribePrompts, createPrompt, updatePrompt, setPinned, recordCopy, deletePrompt, createPrompts,
  subscribeFolders, createFolder, renameFolder, deleteFolder,
  parseTags, MAX_BODY, MAX_FOLDERS,
} from './store';
import { extractVars, fillVars, splitVars, loadVarValues, saveVarValues, clearVarValues } from './vars';
import { SAMPLE_PROMPTS } from './samples';
import { Folder, Prompt, PromptData, SortKey, ViewMode } from './types';

// ============================================================
// Icons（開発者定義の固定SVGのみ）
// ============================================================
const svg = (inner: string, size = 18): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON_COPY = svg('<rect x="22" y="22" width="30" height="32" rx="5"/><path d="M42 22 V15 C42 12 40 10 37 10 H17 C14 10 12 12 12 15 V39 C12 42 14 44 17 44 H22"/>');
const ICON_CHECK = svg('<path d="M14 34 L26 46 L50 20"/>');
const ICON_PIN = svg('<path d="M24 10 H40"/><path d="M27 10 V26 L18 36 H46 L37 26 V10"/><path d="M32 36 V54"/>');
const ICON_FOLDER_PATH = '<path d="M8 18 C8 15 10 13 13 13 H25 L30 19 H51 C54 19 56 21 56 24 V46 C56 49 54 51 51 51 H13 C10 51 8 49 8 46 Z"/>';
const ICON_FOLDER = svg(ICON_FOLDER_PATH, 15);
const ICON_FOLDER_PLUS = svg(`${ICON_FOLDER_PATH}<path d="M32 27 V43"/><path d="M24 35 H40"/>`, 15);
const ICON_MORE = svg('<circle cx="16" cy="32" r="2.4" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="2.4" fill="currentColor" stroke="none"/><circle cx="48" cy="32" r="2.4" fill="currentColor" stroke="none"/>', 15);
const ICON_EDIT = svg('<path d="M42 12 L52 22 L24 50 H14 V40 Z"/><path d="M36 18 L46 28"/>');

// ============================================================
// DOM refs
// ============================================================
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const loginScreen = $('login-screen');
const appEl = $('app');
const userInfo = $('user-info');
const userAvatar = $<HTMLImageElement>('user-avatar');
const userName = $('user-name');
const btnGoogleLogin = $<HTMLButtonElement>('btn-google-login');
const btnLogout = $<HTMLButtonElement>('btn-logout');

const inputSearch = $<HTMLInputElement>('input-search');
const btnNew = $<HTMLButtonElement>('btn-new');
const summaryEl = $('summary');
const selectSort = $<HTMLSelectElement>('select-sort');
const tagFilterEl = $('tag-filter');
const folderBar = $('folder-bar');
const viewToggleBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.view-toggle__btn'));
const quickHint = $('quick-hint');
const loadingEl = $('loading');
const promptList = $('prompt-list');
const emptyFirst = $('empty-first');
const btnEmptyNew = $<HTMLButtonElement>('btn-empty-new');
const btnAddSamples = $<HTMLButtonElement>('btn-add-samples');
const emptyMatch = $('empty-match');
const btnClearFilter = $<HTMLButtonElement>('btn-clear-filter');
const emptyMatchText = $('empty-match-text');
const btnFolderNewPrompt = $<HTMLButtonElement>('btn-folder-new-prompt');

const editorOverlay = $('editor-overlay');
const editorForm = $<HTMLFormElement>('editor-form');
const editorTitle = $('editor-title');
const inputTitle = $<HTMLInputElement>('input-title');
const inputBody = $<HTMLTextAreaElement>('input-body');
const btnInsertVar = $<HTMLButtonElement>('btn-insert-var');
const editorVars = $('editor-vars');
const bodyCount = $('body-count');
const inputTags = $<HTMLInputElement>('input-tags');
const tagSuggest = $('tag-suggest');
const inputPinned = $<HTMLInputElement>('input-pinned');
const inputFolder = $<HTMLSelectElement>('input-folder');
const btnEditorClose = $<HTMLButtonElement>('btn-editor-close');
const btnEditorCancel = $<HTMLButtonElement>('btn-editor-cancel');
const btnEditorSave = $<HTMLButtonElement>('btn-editor-save');
const btnEditorDelete = $<HTMLButtonElement>('btn-editor-delete');
const btnEditorDuplicate = $<HTMLButtonElement>('btn-editor-duplicate');

const folderOverlay = $('folder-overlay');
const folderForm = $<HTMLFormElement>('folder-form');
const folderModalTitle = $('folder-modal-title');
const inputFolderName = $<HTMLInputElement>('input-folder-name');
const btnFolderClose = $<HTMLButtonElement>('btn-folder-close');
const btnFolderCancel = $<HTMLButtonElement>('btn-folder-cancel');
const btnFolderSave = $<HTMLButtonElement>('btn-folder-save');
const btnFolderDelete = $<HTMLButtonElement>('btn-folder-delete');

const fillOverlay = $('fill-overlay');
const fillForm = $<HTMLFormElement>('fill-form');
const fillTitle = $('fill-title');
const fillFields = $('fill-fields');
const fillPreview = $('fill-preview');
const btnFillClose = $<HTMLButtonElement>('btn-fill-close');
const btnFillCancel = $<HTMLButtonElement>('btn-fill-cancel');
const btnFillClear = $<HTMLButtonElement>('btn-fill-clear');
const btnFillCopy = $<HTMLButtonElement>('btn-fill-copy');

const discardOverlay = $('discard-dialog-overlay');
const btnDiscardCancel = $<HTMLButtonElement>('btn-discard-cancel');
const btnDiscardOk = $<HTMLButtonElement>('btn-discard-ok');

const confirmOverlay = $('confirm-dialog-overlay');
const confirmDialogTitle = $('confirm-dialog-title');
const confirmDialogText = $('confirm-dialog-text');
const btnConfirmCancel = $<HTMLButtonElement>('btn-confirm-cancel');
const btnConfirmDelete = $<HTMLButtonElement>('btn-confirm-delete');

const feedbackBtn = $<HTMLButtonElement>('feedback-btn');
const feedbackOverlay = $('feedback-modal-overlay');
const inputFeedbackMessage = $<HTMLTextAreaElement>('input-feedback-message');
const btnFeedbackClose = $<HTMLButtonElement>('btn-feedback-close');
const btnFeedbackSend = $<HTMLButtonElement>('btn-feedback-send');

// ============================================================
// State
// ============================================================
const SORT_STORAGE_KEY = 'prompt-pocket:sort';
const SORT_KEYS: SortKey[] = ['popular', 'recent', 'new', 'title'];
const VIEW_STORAGE_KEY = 'prompt-pocket:view';
const FOLDER_STORAGE_KEY = 'prompt-pocket:folder';
/** フォルダ絞り込みの特別な値 */
const FOLDER_ALL = '';
const FOLDER_NONE = '__none__';

interface State {
  uid: string | null;
  prompts: Prompt[];
  folders: Folder[];
  loaded: boolean;
  foldersLoaded: boolean;
  /** 表示中のフォルダ（FOLDER_ALL / FOLDER_NONE / フォルダID） */
  folder: string;
  view: ViewMode;
  /** いま一覧に表示されているプロンプト（Enterで先頭をコピーするため） */
  visible: Prompt[];
  /** 直前にコピーしたプロンプト（ボタンに「コピーしました」を出す） */
  copiedId: string | null;
  /** 編集中のフォルダID（新規作成時は null） */
  editingFolderId: string | null;
  query: string;
  tag: string;
  sort: SortKey;
  expanded: Set<string>;
  /** 編集中のプロンプトID（新規作成時は null） */
  editingId: string | null;
  /** 編集モーダルを開いた時点の入力内容（未保存チェック用） */
  editorSnapshot: string;
  fillTarget: Prompt | null;
  fillValues: Record<string, string>;
  confirmAction: (() => Promise<void>) | null;
  unsubscribers: (() => void)[];
}

function loadPref(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても動作には影響しない
  }
}

function loadSort(): SortKey {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : 'popular';
  } catch {
    return 'popular';
  }
}

const state: State = {
  uid: null,
  prompts: [],
  folders: [],
  loaded: false,
  foldersLoaded: false,
  folder: loadPref(FOLDER_STORAGE_KEY),
  view: loadPref(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'card',
  visible: [],
  editingFolderId: null,
  copiedId: null,
  query: '',
  tag: '',
  sort: loadSort(),
  expanded: new Set(),
  editingId: null,
  editorSnapshot: '',
  fillTarget: null,
  fillValues: {},
  confirmAction: null,
  unsubscribers: [],
};
selectSort.value = state.sort;

function openConfirm(title: string, action: () => Promise<void>, text = '削除すると元に戻せません。'): void {
  confirmDialogTitle.textContent = title;
  confirmDialogText.textContent = text;
  state.confirmAction = action;
  openOverlay(confirmOverlay);
}

function findPrompt(id: string): Prompt | undefined {
  return state.prompts.find((p) => p.id === id);
}

function findFolder(id: string): Folder | undefined {
  return state.folders.find((f) => f.id === id);
}

/** 削除済みフォルダを指しているプロンプトは未分類として扱う */
function folderOf(p: Prompt): string {
  return p.folderId && findFolder(p.folderId) ? p.folderId : '';
}

// ============================================================
// List / filter
// ============================================================
function allTags(scoped = false): string[] {
  const count = new Map<string, number>();
  (scoped ? state.prompts.filter(inFolder) : state.prompts).forEach((p) => p.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([t]) => t);
}

function inFolder(p: Prompt): boolean {
  if (state.folder === FOLDER_ALL) return true;
  if (state.folder === FOLDER_NONE) return folderOf(p) === '';
  return folderOf(p) === state.folder;
}

function matches(p: Prompt): boolean {
  if (!inFolder(p)) return false;
  if (state.tag && !p.tags.includes(state.tag)) return false;
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${p.title}\n${p.body}\n${p.tags.join(' ')}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function compare(a: Prompt, b: Prompt): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  switch (state.sort) {
    case 'popular':
      return b.copyCount - a.copyCount || (b.lastCopiedAt ?? 0) - (a.lastCopiedAt ?? 0) || b.createdAt - a.createdAt;
    case 'recent':
      return (b.lastCopiedAt ?? 0) - (a.lastCopiedAt ?? 0) || b.createdAt - a.createdAt;
    case 'new':
      return b.createdAt - a.createdAt;
    case 'title':
      return a.title.localeCompare(b.title, 'ja');
  }
  return 0;
}

function renderFolderBar(): void {
  const counts = new Map<string, number>();
  state.prompts.forEach((p) => counts.set(folderOf(p), (counts.get(folderOf(p)) ?? 0) + 1));

  const chip = (value: string, label: string, count: number, withIcon: boolean): HTMLButtonElement => {
    const b = button('', 'folder-chip', () => selectFolder(value));
    if (withIcon) b.appendChild(iconEl(ICON_FOLDER, 'folder-chip__icon'));
    b.appendChild(textEl('span', 'folder-chip__name', label));
    b.appendChild(textEl('span', 'folder-chip__count', String(count)));
    const active = state.folder === value;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
    return b;
  };

  const items: HTMLElement[] = [chip(FOLDER_ALL, 'すべて', state.prompts.length, false)];
  state.folders.forEach((f) => {
    items.push(chip(f.id, f.name, counts.get(f.id) ?? 0, true));
    if (state.folder === f.id) {
      const more = button('', 'folder-chip folder-chip--icon', () => openFolderEditor(f));
      more.appendChild(iconEl(ICON_MORE, 'folder-chip__icon'));
      more.setAttribute('aria-label', `「${f.name}」の名前変更・削除`);
      more.title = 'フォルダの名前変更・削除';
      items.push(more);
    }
  });
  const unfiled = counts.get('') ?? 0;
  if (state.folders.length && (unfiled || state.folder === FOLDER_NONE)) {
    items.push(chip(FOLDER_NONE, '未分類', unfiled, false));
  }
  const add = button('', 'folder-chip folder-chip--add', () => openFolderEditor(null));
  add.appendChild(iconEl(ICON_FOLDER_PLUS, 'folder-chip__icon'));
  add.appendChild(textEl('span', 'folder-chip__name', 'フォルダ'));
  add.setAttribute('aria-label', 'フォルダを追加');
  items.push(add);
  folderBar.replaceChildren(...items);
}

function selectFolder(value: string): void {
  state.folder = value;
  savePref(FOLDER_STORAGE_KEY, value);
  renderList();
}

function renderTagFilter(): void {
  const tags = allTags(true);
  if (state.tag && !tags.includes(state.tag)) state.tag = '';
  tagFilterEl.replaceChildren();
  tagFilterEl.classList.toggle('hidden', tags.length === 0);
  ['', ...tags].forEach((t) => {
    const b = button(t ? `#${t}` : 'すべて', 'chip', () => {
      state.tag = state.tag === t ? '' : t;
      renderList();
    });
    b.classList.toggle('is-active', state.tag === t);
    b.setAttribute('aria-pressed', String(state.tag === t));
    tagFilterEl.appendChild(b);
  });
}

function renderBody(body: string): HTMLElement {
  const pre = document.createElement('p');
  pre.className = 'prompt-card__body';
  splitVars(body).forEach((part) => {
    if (part.isVar) pre.appendChild(textEl('span', 'var-token', part.text));
    else pre.appendChild(document.createTextNode(part.text));
  });
  return pre;
}

function renderCard(p: Prompt): HTMLElement {
  const li = document.createElement('li');
  li.className = 'prompt-card card-surface';
  if (p.pinned) li.classList.add('is-pinned');

  const head = document.createElement('div');
  head.className = 'prompt-card__head';
  head.appendChild(textEl('h2', 'prompt-card__title', p.title));

  const pinBtn = button('', 'icon-btn prompt-card__pin', () => void togglePin(p));
  pinBtn.appendChild(iconEl(ICON_PIN, 'icon-btn__icon'));
  pinBtn.setAttribute('aria-label', p.pinned ? 'ピン留めを外す' : 'ピン留めする');
  pinBtn.setAttribute('aria-pressed', String(p.pinned));
  pinBtn.title = p.pinned ? 'ピン留めを外す' : 'ピン留めする';
  if (p.pinned) pinBtn.classList.add('is-active');

  const editBtn = button('', 'icon-btn', () => openEditor(p));
  editBtn.appendChild(iconEl(ICON_EDIT, 'icon-btn__icon'));
  editBtn.setAttribute('aria-label', '編集');
  editBtn.title = '編集';

  const tools = document.createElement('div');
  tools.className = 'prompt-card__tools';
  tools.append(pinBtn, editBtn);
  head.appendChild(tools);
  li.appendChild(head);

  const body = renderBody(p.body);
  const isLong = p.body.length > 140 || p.body.split('\n').length > 4;
  const expanded = state.expanded.has(p.id);
  if (isLong && !expanded) body.classList.add('is-clamped');
  li.appendChild(body);
  if (isLong) {
    const more = button(expanded ? '閉じる' : '全文を見る', 'link-btn prompt-card__more', () => {
      if (state.expanded.has(p.id)) state.expanded.delete(p.id);
      else state.expanded.add(p.id);
      renderList();
    });
    more.setAttribute('aria-expanded', String(expanded));
    li.appendChild(more);
  }

  const vars = extractVars(p.body);
  const meta = document.createElement('div');
  meta.className = 'prompt-card__meta';
  p.tags.forEach((t) => {
    const tagBtn = button(`#${t}`, 'tag', () => {
      state.tag = t;
      renderList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    meta.appendChild(tagBtn);
  });
  const folder = state.folder === FOLDER_ALL ? findFolder(folderOf(p)) : undefined;
  if (folder) {
    const fb = button('', 'folder-label', () => selectFolder(folder.id));
    fb.appendChild(iconEl(ICON_FOLDER, 'folder-label__icon'));
    fb.appendChild(textEl('span', '', folder.name));
    meta.prepend(fb);
  }
  if (vars.length) meta.appendChild(textEl('span', 'var-badge', `変数 ${vars.length}`));
  li.appendChild(meta);

  const foot = document.createElement('div');
  foot.className = 'prompt-card__foot';
  foot.appendChild(textEl('span', 'prompt-card__count', p.copyCount ? `${p.copyCount}回コピー` : 'まだ未使用'));
  const copyBtn = button('', 'btn btn--primary prompt-card__copy', () => void startCopy(p, copyBtn));
  fillCopyButton(copyBtn, p, vars.length ? '入力してコピー' : 'コピー');
  foot.appendChild(copyBtn);
  li.appendChild(foot);
  enableTapToCopy(li, p, copyBtn);
  return li;
}

/** カード／行のどこをタップしてもコピーできるようにする（ボタン類・文字選択中は除く） */
function enableTapToCopy(el: HTMLElement, p: Prompt, copyBtn: HTMLButtonElement): void {
  el.classList.add('is-tappable');
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, select, textarea')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    void startCopy(p, copyBtn);
  });
}

/** リスト表示の1行（タイトル＋コピーボタンだけのコンパクトな形） */
function renderRow(p: Prompt): HTMLElement {
  const li = document.createElement('li');
  li.className = 'prompt-row';
  if (p.pinned) li.classList.add('is-pinned');

  const main = document.createElement('div');
  main.className = 'prompt-row__main';
  const title = textEl('span', 'prompt-row__title', p.title);
  if (p.pinned) title.prepend(iconEl(ICON_PIN, 'prompt-row__pin'));
  main.appendChild(title);

  const vars = extractVars(p.body);
  const sub: string[] = [];
  const folder = state.folder === FOLDER_ALL ? findFolder(folderOf(p)) : undefined;
  if (folder) sub.push(folder.name);
  if (vars.length) sub.push(`変数 ${vars.length}`);
  p.tags.slice(0, 3).forEach((t) => sub.push(`#${t}`));
  main.appendChild(textEl('span', 'prompt-row__sub', sub.length ? sub.join(' ・ ') : p.body.replace(/\s+/g, ' ').slice(0, 60)));
  li.appendChild(main);

  const editBtn = button('', 'icon-btn prompt-row__edit', () => openEditor(p));
  editBtn.appendChild(iconEl(ICON_EDIT, 'icon-btn__icon'));
  editBtn.setAttribute('aria-label', `「${p.title}」を編集`);
  editBtn.title = '編集';
  li.appendChild(editBtn);

  const copyBtn = button('', 'btn btn--primary prompt-row__copy', () => void startCopy(p, copyBtn));
  fillCopyButton(copyBtn, p, vars.length ? '入力' : 'コピー', 'prompt-row__copy-label');
  copyBtn.setAttribute('aria-label', vars.length ? `「${p.title}」を入力してコピー` : `「${p.title}」をコピー`);
  li.appendChild(copyBtn);

  enableTapToCopy(li, p, copyBtn);
  return li;
}

function renderViewToggle(): void {
  viewToggleBtns.forEach((b) => {
    const active = b.dataset.view === state.view;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  promptList.classList.toggle('prompt-list--rows', state.view === 'list');
}

function renderList(): void {
  loadingEl.classList.toggle('hidden', state.loaded);
  if (!state.loaded) {
    promptList.replaceChildren();
    emptyFirst.classList.add('hidden');
    emptyMatch.classList.add('hidden');
    return;
  }
  renderFolderBar();
  renderTagFilter();
  renderViewToggle();

  const total = state.prompts.length;
  const copies = state.prompts.reduce((s, p) => s + p.copyCount, 0);
  summaryEl.textContent = total ? `${total}件 ・ 累計${copies}回コピー` : '';

  const list = state.prompts.filter(matches).sort(compare);
  state.visible = list;
  promptList.replaceChildren(...list.map(state.view === 'list' ? renderRow : renderCard));
  emptyFirst.classList.toggle('hidden', total > 0);
  emptyMatch.classList.toggle('hidden', total === 0 || list.length > 0);
  quickHint.classList.toggle('hidden', list.length === 0);

  // フォルダが空なのか、検索・タグで0件なのかで案内を変える
  const folderEmpty = state.folder !== FOLDER_ALL && !state.prompts.some(inFolder);
  const currentFolder = findFolder(state.folder);
  emptyMatchText.textContent = folderEmpty
    ? `${currentFolder ? `「${currentFolder.name}」` : 'このフォルダ'}はまだ空です。`
    : '条件に合うプロンプトがありません。';
  btnFolderNewPrompt.classList.toggle('hidden', !(folderEmpty && currentFolder));
  btnClearFilter.textContent = folderEmpty ? 'すべてのプロンプトを見る' : '絞り込みを解除する';
}

// ============================================================
// Copy
// ============================================================
const COPIED_MS = 1600;
let copiedTimer = 0;

/** コピー直後の「コピーしました」表示。一覧が描き直されても消えないよう state で持つ */
function markCopied(id: string): void {
  state.copiedId = id;
  window.clearTimeout(copiedTimer);
  renderList();
  copiedTimer = window.setTimeout(() => {
    state.copiedId = null;
    renderList();
  }, COPIED_MS);
}

/** コピーボタンの中身（アイコン＋ラベル）を状態に合わせて組み立てる */
function fillCopyButton(btn: HTMLButtonElement, p: Prompt, label: string, labelClass = ''): void {
  const copied = state.copiedId === p.id;
  btn.classList.toggle('is-copied', copied);
  btn.replaceChildren(
    iconEl(copied ? ICON_CHECK : ICON_COPY, 'btn__icon'),
    textEl('span', labelClass, copied ? 'コピーしました' : label),
  );
}

async function doCopy(p: Prompt, text: string): Promise<boolean> {
  const ok = await copyText(text);
  if (!ok) {
    showToast('コピーできませんでした。ブラウザの設定をご確認ください');
    return false;
  }
  markCopied(p.id);
  showToast(`「${p.title.length > 20 ? `${p.title.slice(0, 20)}…` : p.title}」をコピーしました`);
  if (state.uid) {
    recordCopy(state.uid, p.id).catch((err) => console.error(err));
  }
  return true;
}

async function startCopy(p: Prompt, btn: HTMLButtonElement): Promise<void> {
  const vars = extractVars(p.body);
  if (!vars.length) {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await doCopy(p, p.body);
    } finally {
      btn.disabled = false;
    }
    return;
  }
  openFill(p, vars);
}

function updateFillPreview(): void {
  if (!state.fillTarget) return;
  fillPreview.replaceChildren();
  const filled = fillVars(state.fillTarget.body, state.fillValues);
  splitVars(filled).forEach((part) => {
    if (part.isVar) fillPreview.appendChild(textEl('span', 'var-token', part.text));
    else fillPreview.appendChild(document.createTextNode(part.text));
  });
}

function openFill(p: Prompt, vars: string[]): void {
  state.fillTarget = p;
  const saved = loadVarValues(p.id);
  state.fillValues = {};
  vars.forEach((v) => { state.fillValues[v] = saved[v] ?? ''; });

  fillTitle.textContent = p.title;
  fillFields.replaceChildren();
  vars.forEach((name, i) => {
    const field = document.createElement('div');
    field.className = 'field field--compact';
    const id = `fill-var-${i}`;
    const label = textEl('label', 'field__label', name);
    label.setAttribute('for', id);
    const ta = document.createElement('textarea');
    ta.id = id;
    ta.rows = 2;
    ta.maxLength = 4000;
    ta.value = state.fillValues[name];
    ta.placeholder = `${name}を入力`;
    ta.addEventListener('input', () => {
      state.fillValues[name] = ta.value;
      updateFillPreview();
    });
    // Ctrl/Cmd + Enter でそのままコピー
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        fillForm.requestSubmit();
      }
    });
    field.append(label, ta);
    fillFields.appendChild(field);
  });
  updateFillPreview();
  openOverlay(fillOverlay);
  const first = fillFields.querySelector('textarea');
  if (first) first.focus();
}

function closeFill(): void {
  closeOverlay(fillOverlay);
  state.fillTarget = null;
}

fillForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p = state.fillTarget;
  if (!p || btnFillCopy.disabled) return;
  btnFillCopy.disabled = true;
  try {
    saveVarValues(p.id, state.fillValues);
    const ok = await doCopy(p, fillVars(p.body, state.fillValues));
    if (ok) closeFill();
  } finally {
    btnFillCopy.disabled = false;
  }
});

btnFillClear.addEventListener('click', () => {
  if (!state.fillTarget) return;
  clearVarValues(state.fillTarget.id);
  Object.keys(state.fillValues).forEach((k) => { state.fillValues[k] = ''; });
  fillFields.querySelectorAll('textarea').forEach((ta) => { ta.value = ''; });
  updateFillPreview();
  const first = fillFields.querySelector('textarea');
  if (first) first.focus();
});

btnFillClose.addEventListener('click', closeFill);
btnFillCancel.addEventListener('click', closeFill);

// ============================================================
// Pin
// ============================================================
async function togglePin(p: Prompt): Promise<void> {
  if (!state.uid) return;
  try {
    await setPinned(state.uid, p.id, !p.pinned);
    showToast(p.pinned ? 'ピン留めを外しました' : 'ピン留めしました');
  } catch (err) {
    console.error(err);
    showToast('更新に失敗しました');
  }
}

// ============================================================
// Editor
// ============================================================
function renderFolderOptions(selected: string): void {
  const opts = [{ value: '', label: '未分類' }, ...state.folders.map((f) => ({ value: f.id, label: f.name }))];
  inputFolder.replaceChildren(...opts.map((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    return opt;
  }));
  inputFolder.value = findFolder(selected) ? selected : '';
}

function editorValue(): PromptData {
  return {
    folderId: inputFolder.value,
    title: inputTitle.value.trim(),
    body: inputBody.value,
    tags: parseTags(inputTags.value),
    pinned: inputPinned.checked,
  };
}

const snapshotOf = (): string => JSON.stringify([inputTitle.value, inputBody.value, inputTags.value, inputPinned.checked, inputFolder.value]);

function isEditorDirty(): boolean {
  return editorOverlay.classList.contains('is-open') && snapshotOf() !== state.editorSnapshot;
}

function updateEditorHints(): void {
  const vars = extractVars(inputBody.value);
  editorVars.classList.toggle('hidden', vars.length === 0);
  editorVars.textContent = vars.length ? `見つかった変数：${vars.join('、')}` : '';
  bodyCount.textContent = `${inputBody.value.length} / ${MAX_BODY}`;

  const current = parseTags(inputTags.value);
  const suggestions = allTags().filter((t) => !current.includes(t)).slice(0, 12);
  tagSuggest.replaceChildren(...suggestions.map((t) => button(`+ ${t}`, 'chip chip--sm', () => {
    const next = parseTags([...current, t]);
    inputTags.value = next.join(' ');
    updateEditorHints();
  })));
}

function openEditor(p: Prompt | null, preset?: PromptData): void {
  state.editingId = p ? p.id : null;
  const data = p ?? preset;
  editorTitle.textContent = p ? 'プロンプトを編集' : '新しいプロンプト';
  inputTitle.value = data?.title ?? '';
  inputBody.value = data?.body ?? '';
  inputTags.value = data ? data.tags.join(' ') : (state.tag || '');
  inputPinned.checked = data?.pinned ?? false;
  // 新規作成時は、いま開いているフォルダを初期値にする
  renderFolderOptions(data ? data.folderId : (findFolder(state.folder) ? state.folder : ''));
  btnEditorDelete.classList.toggle('hidden', !p);
  btnEditorDuplicate.classList.toggle('hidden', !p);
  // 複製（preset）はまだ保存していない状態として扱う
  state.editorSnapshot = preset ? '' : snapshotOf();
  updateEditorHints();
  openOverlay(editorOverlay);
  (data?.title ? inputBody : inputTitle).focus();
}

function forceCloseEditor(): void {
  closeOverlay(editorOverlay);
  state.editingId = null;
  state.editorSnapshot = '';
}

function requestCloseEditor(): void {
  if (isEditorDirty()) openOverlay(discardOverlay);
  else forceCloseEditor();
}

editorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.uid || btnEditorSave.disabled) return;
  const data = editorValue();
  if (!data.title) {
    showToast('タイトルを入力してください');
    inputTitle.focus();
    return;
  }
  if (!data.body.trim()) {
    showToast('プロンプト本文を入力してください');
    inputBody.focus();
    return;
  }
  btnEditorSave.disabled = true;
  try {
    if (state.editingId) {
      await updatePrompt(state.uid, state.editingId, data);
      showToast('保存しました');
    } else {
      await createPrompt(state.uid, data);
      showToast('ポケットに入れました');
    }
    forceCloseEditor();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました。通信状況をご確認ください');
  } finally {
    btnEditorSave.disabled = false;
  }
});

inputBody.addEventListener('input', updateEditorHints);
inputTags.addEventListener('input', updateEditorHints);

btnInsertVar.addEventListener('click', () => {
  const start = inputBody.selectionStart ?? inputBody.value.length;
  const end = inputBody.selectionEnd ?? start;
  const selected = inputBody.value.slice(start, end).trim();
  const name = selected && selected.length <= 30 && !/[{}\n]/.test(selected) ? selected : '変数名';
  const token = `{{${name}}}`;
  inputBody.setRangeText(token, start, end, 'end');
  inputBody.focus();
  // 「変数名」を挿入したときは名前部分を選択して、すぐ書き換えられるようにする
  if (name === '変数名') inputBody.setSelectionRange(start + 2, start + 2 + name.length);
  updateEditorHints();
});

btnEditorClose.addEventListener('click', requestCloseEditor);
btnEditorCancel.addEventListener('click', requestCloseEditor);

btnEditorDelete.addEventListener('click', () => {
  const id = state.editingId;
  const p = id ? findPrompt(id) : undefined;
  if (!state.uid || !p) return;
  const uid = state.uid;
  openConfirm(`「${p.title}」を削除しますか？`, async () => {
    await deletePrompt(uid, p.id);
    clearVarValues(p.id);
    forceCloseEditor();
    showToast('削除しました');
  });
});

btnEditorDuplicate.addEventListener('click', () => {
  if (isEditorDirty()) {
    showToast('先に保存するか、キャンセルしてから複製してください');
    return;
  }
  const data = editorValue();
  forceCloseEditor();
  openEditor(null, { ...data, title: `${data.title}（コピー）`.slice(0, 80), pinned: false });
});

btnDiscardCancel.addEventListener('click', () => closeOverlay(discardOverlay));
btnDiscardOk.addEventListener('click', () => {
  closeOverlay(discardOverlay);
  forceCloseEditor();
});

// ============================================================
// Folders
// ============================================================
function openFolderEditor(f: Folder | null): void {
  state.editingFolderId = f ? f.id : null;
  folderModalTitle.textContent = f ? 'フォルダを編集' : '新しいフォルダ';
  inputFolderName.value = f ? f.name : '';
  btnFolderDelete.classList.toggle('hidden', !f);
  openOverlay(folderOverlay);
  inputFolderName.focus();
}

function closeFolderEditor(): void {
  closeOverlay(folderOverlay);
  state.editingFolderId = null;
}

folderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.uid || btnFolderSave.disabled) return;
  const name = inputFolderName.value.trim();
  if (!name) {
    showToast('フォルダ名を入力してください');
    inputFolderName.focus();
    return;
  }
  const editingId = state.editingFolderId;
  if (state.folders.some((f) => f.name === name && f.id !== editingId)) {
    showToast('同じ名前のフォルダがすでにあります');
    inputFolderName.focus();
    return;
  }
  if (!editingId && state.folders.length >= MAX_FOLDERS) {
    showToast(`フォルダは${MAX_FOLDERS}個までです`);
    return;
  }
  btnFolderSave.disabled = true;
  try {
    if (editingId) {
      await renameFolder(state.uid, editingId, name);
      showToast('フォルダ名を変更しました');
    } else {
      const id = await createFolder(state.uid, name);
      // 作ったフォルダをそのまま開く
      state.folder = id;
      savePref(FOLDER_STORAGE_KEY, id);
      showToast(`フォルダ「${name}」を作りました`);
    }
    closeFolderEditor();
    renderList();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました。通信状況をご確認ください');
  } finally {
    btnFolderSave.disabled = false;
  }
});

btnFolderDelete.addEventListener('click', () => {
  const f = state.editingFolderId ? findFolder(state.editingFolderId) : undefined;
  if (!state.uid || !f) return;
  const uid = state.uid;
  const ids = state.prompts.filter((p) => folderOf(p) === f.id).map((p) => p.id);
  openConfirm(
    `フォルダ「${f.name}」を削除しますか？`,
    async () => {
      await deleteFolder(uid, f.id, ids);
      closeFolderEditor();
      selectFolder(FOLDER_ALL);
      showToast('フォルダを削除しました');
    },
    ids.length
      ? `中のプロンプト${ids.length}件は消えずに「未分類」へ移ります。`
      : 'このフォルダは空です。',
  );
});

btnFolderClose.addEventListener('click', closeFolderEditor);
btnFolderCancel.addEventListener('click', closeFolderEditor);

// ============================================================
// Toolbar
// ============================================================
let searchTimer = 0;
inputSearch.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = inputSearch.value.trim();
    renderList();
  }, 120);
});

viewToggleBtns.forEach((b) => {
  b.addEventListener('click', () => {
    state.view = b.dataset.view === 'list' ? 'list' : 'card';
    savePref(VIEW_STORAGE_KEY, state.view);
    renderList();
  });
});

// 検索欄で Enter → 先頭の1件をコピー（変数があれば入力画面を開く）
inputSearch.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  window.clearTimeout(searchTimer);
  state.query = inputSearch.value.trim();
  renderList();
  const first = state.visible[0];
  if (!first) {
    showToast('コピーできるプロンプトがありません');
    return;
  }
  const btn = promptList.querySelector<HTMLButtonElement>('.prompt-card__copy, .prompt-row__copy');
  if (btn) void startCopy(first, btn);
});

selectSort.addEventListener('change', () => {
  state.sort = SORT_KEYS.includes(selectSort.value as SortKey) ? (selectSort.value as SortKey) : 'popular';
  try {
    localStorage.setItem(SORT_STORAGE_KEY, state.sort);
  } catch {
    // noop
  }
  renderList();
});

btnNew.addEventListener('click', () => openEditor(null));
btnEmptyNew.addEventListener('click', () => openEditor(null));

btnFolderNewPrompt.addEventListener('click', () => openEditor(null));

btnClearFilter.addEventListener('click', () => {
  state.query = '';
  state.tag = '';
  state.folder = FOLDER_ALL;
  savePref(FOLDER_STORAGE_KEY, FOLDER_ALL);
  inputSearch.value = '';
  renderList();
});

btnAddSamples.addEventListener('click', async () => {
  if (!state.uid || btnAddSamples.disabled) return;
  btnAddSamples.disabled = true;
  try {
    await createPrompts(state.uid, SAMPLE_PROMPTS);
    showToast('サンプルを入れました。自由に書き換えてお使いください');
  } catch (err) {
    console.error(err);
    showToast('追加に失敗しました');
  } finally {
    btnAddSamples.disabled = false;
  }
});

// 「/」キーで検索にフォーカス
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (!state.uid || document.querySelector('.dialog-overlay.is-open')) return;
  e.preventDefault();
  inputSearch.focus();
});

// ============================================================
// Auth
// ============================================================
function onLoadError(err: Error): void {
  console.error(err);
  showToast('データの読み込みに失敗しました。再読み込みしてください');
}

function handleUser(user: User | null): void {
  state.unsubscribers.forEach((u) => u());
  state.unsubscribers = [];
  state.prompts = [];
  state.folders = [];
  state.loaded = false;
  state.foldersLoaded = false;
  state.uid = user?.uid ?? null;
  state.expanded.clear();
  [editorOverlay, fillOverlay, folderOverlay, discardOverlay, confirmOverlay].forEach(closeOverlay);

  if (!user) {
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    userInfo.classList.add('hidden');
    return;
  }

  loginScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  userInfo.classList.remove('hidden');
  userName.textContent = user.displayName ?? '';
  if (user.photoURL) {
    userAvatar.src = user.photoURL;
    userAvatar.classList.remove('hidden');
  } else {
    userAvatar.classList.add('hidden');
  }

  renderList();
  state.unsubscribers.push(
    subscribePrompts(user.uid, (list) => {
      state.prompts = list;
      state.loaded = true;
      renderList();
    }, onLoadError),
    subscribeFolders(user.uid, (list) => {
      const prevIds = state.folders.map((f) => f.id);
      const isFirst = !state.foldersLoaded;
      state.folders = list;
      state.foldersLoaded = true;
      // 表示中のフォルダが削除された（または前回開いていたフォルダがもう無い）ときは「すべて」に戻す
      const id = state.folder;
      if (id !== FOLDER_ALL && id !== FOLDER_NONE && !findFolder(id) && (isFirst || prevIds.includes(id))) {
        selectFolder(FOLDER_ALL);
        return;
      }
      renderList();
    }, onLoadError),
  );
}

btnGoogleLogin.addEventListener('click', async () => {
  btnGoogleLogin.disabled = true;
  try {
    await loginWithGoogle();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      console.error(err);
      showToast('ログインに失敗しました');
    }
  } finally {
    btnGoogleLogin.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await logout();
  } catch (err) {
    console.error(err);
    showToast('ログアウトに失敗しました');
  }
});

// ============================================================
// Dialogs / feedback
// ============================================================
btnConfirmCancel.addEventListener('click', () => {
  state.confirmAction = null;
  closeOverlay(confirmOverlay);
});

btnConfirmDelete.addEventListener('click', async () => {
  const action = state.confirmAction;
  if (!action || btnConfirmDelete.disabled) return;
  btnConfirmDelete.disabled = true;
  try {
    state.confirmAction = null;
    closeOverlay(confirmOverlay);
    await action();
  } catch (err) {
    console.error(err);
    showToast('削除に失敗しました');
  } finally {
    btnConfirmDelete.disabled = false;
  }
});

feedbackBtn.addEventListener('click', () => {
  openOverlay(feedbackOverlay);
  inputFeedbackMessage.focus();
});

btnFeedbackClose.addEventListener('click', () => closeOverlay(feedbackOverlay));

btnFeedbackSend.addEventListener('click', async () => {
  const message = inputFeedbackMessage.value.trim();
  if (!message) {
    showToast('内容を入力してください');
    return;
  }
  if (btnFeedbackSend.disabled) return;
  btnFeedbackSend.disabled = true;
  const ok = await submitFeedback(message);
  btnFeedbackSend.disabled = false;
  if (ok) {
    inputFeedbackMessage.value = '';
    closeOverlay(feedbackOverlay);
    showToast('送信しました。ありがとうございます！');
  } else {
    showToast('送信に失敗しました。時間をおいてお試しください');
  }
});

// オーバーレイの背景クリック / Esc で閉じる（重なっている場合は一番上だけ）
const overlayStack = [confirmOverlay, discardOverlay, folderOverlay, fillOverlay, editorOverlay, feedbackOverlay];

function closeTopOverlay(target: HTMLElement): void {
  if (target === editorOverlay) requestCloseEditor();
  else if (target === fillOverlay) closeFill();
  else if (target === folderOverlay) closeFolderEditor();
  else {
    closeOverlay(target);
    if (target === confirmOverlay) state.confirmAction = null;
  }
}

overlayStack.forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTopOverlay(overlay);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = overlayStack.find((o) => o.classList.contains('is-open'));
  if (top) closeTopOverlay(top);
});

window.addEventListener('beforeunload', (e) => {
  if (isEditorDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

onAuthChange(handleUser);
