import type { ChildProfile, ParentAccount } from "@/types";

export const CHILD_STORAGE_KEY = "monto_child_profile";
export const PARENT_STORAGE_KEY = "monto_parent_account";

export const DEFAULT_CHILD: ChildProfile = {
  name: "",
  age: "",
  grade: "",
  avatar: "photo",
  photo: "/profile-kid.jpg",
};

export const DEFAULT_PARENT: ParentAccount = {
  name: "",
  email: "",
  avatar: "🧑",
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return fallback;
}

function saveJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadChildProfile = () => loadJSON(CHILD_STORAGE_KEY, DEFAULT_CHILD);
export const saveChildProfile = (v: ChildProfile) => saveJSON(CHILD_STORAGE_KEY, v);

export const loadParentAccount = () => loadJSON(PARENT_STORAGE_KEY, DEFAULT_PARENT);
export const saveParentAccount = (v: ParentAccount) => saveJSON(PARENT_STORAGE_KEY, v);
