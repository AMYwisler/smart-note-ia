// API client for Smart Notes IA backend
import { getToken, clearToken } from "@/src/lib/auth";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

export type Note = {
  id: string;
  user_id?: string;
  content: string;
  ocr_text?: string | null;
  image_base64?: string | null;
  image_mime?: string | null;
  title: string;
  summary: string;
  categories: string[];
  urgent: boolean;
  status: "todo" | "in_progress" | "done";
  reminder_date?: string | null;
  amount?: number | null;
  comments?: string;
  created_at: string;
  updated_at: string;
};

export type DashboardData = {
  urgent_today: Note[];
  upcoming_reminders: Note[];
  overdue: Note[];
  by_category: { category: string; count: number }[];
  stats: { total: number; todo: number; in_progress: number; done: number };
};

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    // Token invalid/expired: wipe and bubble up so AuthProvider can redirect.
    await clearToken();
  }
  return res;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((e: any) => e?.msg || JSON.stringify(e)).join(" ")
          : JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function createNote(payload: {
  content?: string;
  image_base64?: string | null;
  image_mime?: string | null;
}): Promise<Note[]> {
  const res = await authedFetch(`${API}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle<Note[]>(res);
}

export async function listNotes(params: {
  category?: string;
  status?: string;
  urgent?: boolean;
  q?: string;
  sort?: "recent" | "oldest" | "urgent" | "reminder" | "category";
} = {}): Promise<Note[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.status) qs.set("status", params.status);
  if (typeof params.urgent === "boolean") qs.set("urgent", String(params.urgent));
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  const url = `${API}/notes${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await authedFetch(url);
  return handle<Note[]>(res);
}

export async function getNote(id: string): Promise<Note> {
  const res = await authedFetch(`${API}/notes/${id}`);
  return handle<Note>(res);
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<Note> {
  const res = await authedFetch(`${API}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<Note>(res);
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authedFetch(`${API}/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await authedFetch(`${API}/dashboard`);
  return handle<DashboardData>(res);
}
