// API client for Smart Notes IA backend
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

export type Note = {
  id: string;
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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function createNote(payload: {
  content?: string;
  image_base64?: string | null;
  image_mime?: string | null;
}): Promise<Note[]> {
  const res = await fetch(`${API}/notes`, {
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
  const res = await fetch(url);
  return handle<Note[]>(res);
}

export async function getNote(id: string): Promise<Note> {
  const res = await fetch(`${API}/notes/${id}`);
  return handle<Note>(res);
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<Note> {
  const res = await fetch(`${API}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<Note>(res);
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${API}/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API}/dashboard`);
  return handle<DashboardData>(res);
}
