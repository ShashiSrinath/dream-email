import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { Email } from "@/lib/store";

export type EmailSearchParams = {
  account_id?: number;
  view?: string;
  filter?: string;
  search?: string;
};

export type EmailEvent = 
  | { type: "email-added", payload: Email }
  | { type: "email-updated", payload: { id: number, address?: string, flags?: string, summary?: string, thread_count?: number } }
  | { type: "emails-updated-bulk", payload: { ids: number[], flags?: string } }
  | { type: "email-removed", payload: { id: number } }
  | { type: "emails-removed-bulk", payload: { ids: number[] } };

const PAGE_SIZE = 50;

export function useEmails(params: EmailSearchParams) {
  const queryClient = useQueryClient();
  const queryKey = ["emails", params];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam: { date: string, id: number } | null }) => {
      if (params.search) {
        return await invoke<Email[]>("search_emails", {
          queryText: params.search,
          accountId: params.account_id || null,
          view: params.view || null,
          limit: PAGE_SIZE,
          before_date: pageParam?.date || null,
          before_id: pageParam?.id || null,
        });
      }

      return await invoke<Email[]>("get_emails", {
        account_id: params.account_id || null,
        view: params.view || "primary",
        filter: params.filter || null,
        limit: PAGE_SIZE,
        before_date: pageParam?.date || null,
        before_id: pageParam?.id || null,
      });
    },
    initialPageParam: null as { date: string, id: number } | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const lastEmail = lastPage[lastPage.length - 1];
      return { date: lastEmail.date, id: lastEmail.id };
    },
  });

  const queryKeyRef = useRef(queryKey);
  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const unlisten = listen<EmailEvent | string>("emails-updated", (event) => {
      // Handle legacy "bulk-add" or generic string events
      if (typeof event.payload === 'string') {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
        }, 100);
        return;
      }

      const { type, payload } = event.payload;

      // For additions, always invalidate to ensure correct order
      if (type === "email-added") {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
        }, 100);
        return;
      }

      // For updates and removals, we can update the cache directly
      queryClient.setQueriesData<any>({ queryKey: ["emails"] }, (oldData: any) => {
        if (!oldData?.pages) return oldData;

        let changed = false;
        const newPages = oldData.pages.map((page: Email[]) => {
          if (type === "email-updated") {
            let pageChanged = false;
            const newPage = page.map((email) => {
              if (email.id === payload.id) {
                pageChanged = true;
                changed = true;
                return {
                  ...email,
                  flags: payload.flags ?? email.flags,
                  summary: payload.summary ?? email.summary,
                  thread_count: payload.thread_count ?? email.thread_count,
                };
              }
              return email;
            });
            return pageChanged ? newPage : page;
          }

          if (type === "emails-updated-bulk") {
            const idSet = new Set(payload.ids);
            let pageChanged = false;
            const newPage = page.map((email) => {
              if (idSet.has(email.id)) {
                pageChanged = true;
                changed = true;
                return {
                  ...email,
                  flags: payload.flags ?? email.flags,
                };
              }
              return email;
            });
            return pageChanged ? newPage : page;
          }

          if (type === "email-removed") {
            const newPage = page.filter((email) => email.id !== payload.id);
            if (newPage.length !== page.length) {
              changed = true;
              return newPage;
            }
            return page;
          }

          if (type === "emails-removed-bulk") {
            const idSet = new Set(payload.ids);
            const newPage = page.filter((email) => !idSet.has(email.id));
            if (newPage.length !== page.length) {
              changed = true;
              return newPage;
            }
            return page;
          }

          return page;
        });

        return changed ? { ...oldData, pages: newPages } : oldData;
      });
    });

    return () => {
      unlisten.then((u) => u());
      if (timeout) clearTimeout(timeout);
    };
  }, [queryClient]);

  return query;
}
