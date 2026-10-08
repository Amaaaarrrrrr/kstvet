/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DataProvider, GetListParams, Identifier } from "react-admin";

import { adminFetch } from "./http";

type ListParams = Pick<GetListParams, "pagination" | "sort" | "filter">;

function listQuery(params: ListParams, extra: Record<string, unknown> = {}): string {
  const { page, perPage } = params.pagination ?? { page: 1, perPage: 25 };
  const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (params.sort?.field) {
    qs.set("sort", params.sort.field);
    qs.set("order", params.sort.order.toLowerCase());
  }
  for (const [k, v] of Object.entries({ ...params.filter, ...extra })) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

async function updateOne(resource: string, id: Identifier, data: any) {
  if (resource === "applications") {
    // Only the decision fields are editable on an application.
    const { status, admin_notes } = data;
    return adminFetch<any>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_notes: admin_notes ?? "" }),
    });
  }
  return adminFetch<any>(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export const dataProvider: DataProvider = {
  getList: (resource, params) => adminFetch<any>(`/${resource}?${listQuery(params)}`),

  getOne: async (resource, params) => ({ data: await adminFetch<any>(`/${resource}/${params.id}`) }),

  getMany: async (resource, params) => ({
    data: await Promise.all(params.ids.map((id) => adminFetch<any>(`/${resource}/${id}`))),
  }),

  getManyReference: (resource, params) =>
    adminFetch<any>(`/${resource}?${listQuery(params, { [params.target]: params.id })}`),

  create: async (resource, params) => ({
    data: await adminFetch<any>(`/${resource}`, { method: "POST", body: JSON.stringify(params.data) }),
  }),

  update: async (resource, params) => ({ data: await updateOne(resource, params.id, params.data) }),

  updateMany: async (resource, params) => {
    for (const id of params.ids) await updateOne(resource, id, params.data);
    return { data: params.ids };
  },

  delete: async (resource, params) => ({
    data: await adminFetch<any>(`/${resource}/${params.id}`, { method: "DELETE" }),
  }),

  deleteMany: async (resource, params) => {
    for (const id of params.ids) await adminFetch(`/${resource}/${id}`, { method: "DELETE" });
    return { data: params.ids };
  },
};