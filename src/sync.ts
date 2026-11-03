// Optional cloud copy of workout progress for signed-in users.
// Local storage stays the source the app reads from; this module mirrors selected
// keys to the kb_progress row (one row per user, protected by RLS).
// It never deletes local data: on first sync or when both sides changed it merges.
import { supabase } from "./supabase";

const KEYS = [
  "kettlebell-weight-log-v1",
  "kettlebell-trained-days-v1",
  "kettlebell-session-times-v1",
  "kettlebell-settings-v1",
  "kettlebell-swaps-v1",
];
const META_KEY = "kettlebell-sync-meta-v1";

interface Meta {
  uid: string;
  lastSync: string;
  dirty: boolean;
}

type Blob = Record<string, unknown>;

const rawSet = Storage.prototype.setItem;
let currentUid = "";
let timer: number | undefined;
let applying = false;

function readMeta(): Meta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (m && typeof m.uid === "string") return { uid: m.uid, lastSync: String(m.lastSync || ""), dirty: !!m.dirty };
  } catch {
    // ignore
  }
  return null;
}

function writeMeta(m: Meta) {
  try {
    rawSet.call(localStorage, META_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

function readLocal(): Blob {
  const out: Blob = {};
  KEYS.forEach((k) => {
    try {
      const raw = localStorage.getItem(k);
      if (raw) out[k] = JSON.parse(raw);
    } catch {
      // skip unreadable key
    }
  });
  return out;
}

function hasData(b: Blob): boolean {
  return Object.keys(b).some((k) => {
    const v = b[k];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === "object") return Object.keys(v as object).length > 0;
    return v !== undefined && v !== null;
  });
}

function mergeValue(key: string, local: unknown, remote: unknown): unknown {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const seen = new Set<string>();
    const out: unknown[] = [];
    [...local, ...remote].forEach((x) => {
      const id = JSON.stringify(x);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(x);
      }
    });
    if (key === "kettlebell-trained-days-v1") (out as string[]).sort();
    return out;
  }
  if (local && remote && typeof local === "object" && typeof remote === "object") {
    const l = local as Record<string, unknown>;
    const r = remote as Record<string, unknown>;
    const out: Record<string, unknown> = { ...r, ...l };
    if (key === "kettlebell-session-times-v1") {
      Object.keys(r).forEach((k) => {
        const a = Number(l[k] || 0);
        const b = Number(r[k] || 0);
        out[k] = Math.max(a, b);
      });
    }
    return out;
  }
  return local;
}

function merge(local: Blob, remote: Blob): Blob {
  const out: Blob = {};
  KEYS.forEach((k) => {
    const v = mergeValue(k, local[k], remote[k]);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

// Writes values to local storage; returns true when anything changed.
function applyLocal(b: Blob): boolean {
  let changed = false;
  applying = true;
  try {
    KEYS.forEach((k) => {
      if (b[k] === undefined) return;
      const text = JSON.stringify(b[k]);
      if (localStorage.getItem(k) !== text) {
        rawSet.call(localStorage, k, text);
        changed = true;
      }
    });
  } finally {
    applying = false;
  }
  return changed;
}

async function push(uid: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("kb_progress")
    .upsert({ user_id: uid, data: readLocal(), updated_at: now })
    .select("updated_at")
    .single();
  if (error || !data) return false;
  writeMeta({ uid, lastSync: String(data.updated_at), dirty: false });
  return true;
}

function schedulePush() {
  if (!currentUid) return;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    if (currentUid) void push(currentUid);
  }, 2000);
}

// Watch the app's own saves so changes are mirrored without touching App.tsx.
Storage.prototype.setItem = function (key: string, value: string) {
  rawSet.call(this, key, value);
  if (this === window.localStorage && !applying && KEYS.indexOf(key) >= 0) {
    const m = readMeta();
    if (m) writeMeta({ ...m, dirty: true });
    schedulePush();
  }
};

window.addEventListener("online", () => {
  const m = readMeta();
  if (currentUid && m && m.uid === currentUid && m.dirty) schedulePush();
});

// Called when a session appears. Returns true if local data changed and the app should reload.
export async function startSync(uid: string): Promise<boolean> {
  currentUid = uid;
  const { data, error } = await supabase.from("kb_progress").select("data, updated_at").eq("user_id", uid).maybeSingle();
  if (error) return false; // offline or blocked: keep working locally
  const local = readLocal();
  const meta = readMeta();
  if (!data) {
    await push(uid);
    return false;
  }
  const remote = (data.data || {}) as Blob;
  const remoteAt = String(data.updated_at);
  const sameUser = !!meta && meta.uid === uid;
  if (sameUser && !meta!.dirty) {
    if (meta!.lastSync === remoteAt) return false;
    // Nothing new here since the last sync: take the newer cloud copy.
    const changed = applyLocal(remote);
    writeMeta({ uid, lastSync: remoteAt, dirty: false });
    return changed;
  }
  // First sync on this browser, or both sides changed: merge, never drop local entries.
  const merged = hasData(local) ? merge(local, remote) : remote;
  const changed = applyLocal(merged);
  writeMeta({ uid, lastSync: remoteAt, dirty: true });
  await push(uid);
  return changed;
}

export function stopSync() {
  currentUid = "";
  if (timer) window.clearTimeout(timer);
  timer = undefined;
}
