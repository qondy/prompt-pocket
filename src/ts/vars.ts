// プロンプト本文中の {{変数名}} を扱う
const VAR_SOURCE = '\\{\\{\\s*([^{}\\n]{1,30}?)\\s*\\}\\}';
const varRe = (): RegExp => new RegExp(VAR_SOURCE, 'g');

function eachMatch(body: string, fn: (m: RegExpExecArray) => void): void {
  const re = varRe();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) fn(m);
}

/** 本文に含まれる変数名を、出現順・重複なしで返す */
export function extractVars(body: string): string[] {
  const names: string[] = [];
  eachMatch(body, (m) => {
    if (!names.includes(m[1])) names.push(m[1]);
  });
  return names;
}

/** 変数を値で置き換える。空欄の変数は {{変数名}} のまま残す */
export function fillVars(body: string, values: Record<string, string>): string {
  return body.replace(varRe(), (whole, name: string) => (values[name] ? values[name] : whole));
}

/** 本文を「通常テキスト」と「変数」の断片に分ける（ハイライト表示用） */
export function splitVars(body: string): { text: string; isVar: boolean }[] {
  const parts: { text: string; isVar: boolean }[] = [];
  let last = 0;
  eachMatch(body, (m) => {
    if (m.index > last) parts.push({ text: body.slice(last, m.index), isVar: false });
    parts.push({ text: m[0], isVar: true });
    last = m.index + m[0].length;
  });
  if (last < body.length) parts.push({ text: body.slice(last), isVar: false });
  return parts;
}

const storageKey = (promptId: string): string => `prompt-pocket:vars:${promptId}`;

/** 前回入力した変数の値（この端末のブラウザにだけ保存） */
export function loadVarValues(promptId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(promptId));
    const obj: unknown = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== 'object') return {};
    const out: Record<string, string> = {};
    Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === 'string') out[k] = v.slice(0, 4000);
    });
    return out;
  } catch {
    return {};
  }
}

export function saveVarValues(promptId: string, values: Record<string, string>): void {
  try {
    localStorage.setItem(storageKey(promptId), JSON.stringify(values));
  } catch {
    // 保存できなくても動作には影響しない
  }
}

export function clearVarValues(promptId: string): void {
  try {
    localStorage.removeItem(storageKey(promptId));
  } catch {
    // noop
  }
}
