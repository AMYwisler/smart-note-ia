import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "smart-notes-auth-token";

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export type User = {
  id: string;
  email: string;
  created_at: string;
};

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

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

export async function apiRegister(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handle<{ token: string; user: User }>(res);
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handle<{ token: string; user: User }>(res);
}

export async function apiMe(token: string): Promise<User> {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handle<User>(res);
}

export async function apiForgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handle<{ ok: boolean; message: string }>(res);
}

export async function apiResetPassword(token: string, password: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return handle<{ ok: boolean; message: string }>(res);
}

export async function apiDeleteAccount(token: string): Promise<void> {
  const res = await fetch(`${API}/auth/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
