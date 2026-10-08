import type { AuthProvider } from "react-admin";

import { adminFetch } from "./http";

export type AdminRole = "admin" | "officer" | "viewer";
type AdminUser = { id: number; email: string; full_name: string; role: AdminRole };

let cached: AdminUser | null = null;

async function me(): Promise<AdminUser> {
  if (cached) return cached;
  const r = await adminFetch<{ user: AdminUser }>("/auth/me");
  cached = r.user;
  return cached;
}

export const authProvider: AuthProvider = {
  async login({ username, password }) {
    const r = await adminFetch<{ user: AdminUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: username, password }),
    });
    cached = r.user;
  },
  async logout() {
    cached = null;
    await adminFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  },
  async checkAuth() {
    await me();
  },
  async checkError(error) {
    if (error?.status === 401) {
      cached = null;
      throw error;
    }
  },
  async getIdentity() {
    const u = await me();
    return { id: u.id, fullName: u.full_name };
  },
  async getPermissions() {
    const u = await me();
    return u.role;
  },
};