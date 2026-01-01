import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Account = {
  type: "google" | "microsoft" | "imap_smtp";
  data: {
    id?: number;
    email: string;
    name?: string;
    picture?: string;
    imap_host?: string;
    imap_port?: number;
    imap_encryption?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_encryption?: string;
  };
};

export type Folder = {
  id: number;
  account_id: number;
  name: string;
  path: string;
  role?: string;
  unread_count: number;
};

export type Email = {
  id: number;
  account_id: number;
  folder_id: number;
  remote_id: string;
  message_id: string | null;
  thread_id: string | null;
  thread_count: number | null;
  subject: string | null;
  sender_name: string | null;
  sender_address: string;
  recipient_to: string | null;
  date: string;
  flags: string;
  snippet: string | null;
  summary: string | null;
  has_attachments: boolean;
  is_reply: boolean;
  is_forward: boolean;
};

export type Sender = {
  address: string;
  name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  location: string | null;
  github_handle: string | null;
  linkedin_handle: string | null;
  twitter_handle: string | null;
  website_url: string | null;
  is_verified: boolean;
  is_personal_email: boolean | null;
  is_automated_mailer: boolean | null;
  ai_last_enriched_at: string | null;
  last_enriched_at: string | null;
};

export type Domain = {
  domain: string;
  name: string | null;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  location: string | null;
  last_enriched_at: string | null;
};

export type EmailContent = {
  body_text: string | null;
  body_html: string | null;
};

export type Attachment = {
  id: number;
  email_id: number;
  filename: string | null;
  mime_type: string | null;
  size: number;
};

interface UnifiedCounts {
  primary: number;
  sent: number;
  spam: number;
}

interface EmailState {
  // Initialization
  isInitialized: boolean;
  init: () => () => void;
  reset: () => void;

  // Accounts & Folders
  accounts: Account[];
  accountFolders: Record<number, Folder[]>;
  unifiedCounts: UnifiedCounts;
  fetchAccountsAndFolders: () => Promise<void>;
  fetchUnifiedCounts: () => Promise<void>;

  // Emails List
  emails: Email[]; // We keep this for multi-selection reference if needed, but it's mostly unused now
  lastSearchParams: {
    account_id?: number;
    view?: string;
    filter?: string;
    search?: string;
  } | null;
  refreshEmails: () => Promise<void>;

  // Selected Email
  selectedEmailId: number | null;
  setSelectedEmailId: (id: number | null) => void;

  // Multi-selection
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  selectRange: (id: number) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;

  // Actions
  markAsRead: (ids: number[]) => Promise<void>;
  moveToTrash: (ids: number[]) => Promise<void>;
  archiveEmails: (ids: number[]) => Promise<void>;
  moveToInbox: (ids: number[]) => Promise<void>;

  // Composer
  composer: {
    open: boolean;
    draftId?: number;
    defaultTo?: string;
    defaultCc?: string;
    defaultBcc?: string;
    defaultSubject?: string;
    defaultBody?: string;
    defaultAttachments?: Attachment[];
  };
  setComposer: (state: Partial<EmailState["composer"]>) => void;
}

const initialState: Pick<
  EmailState,
  | "isInitialized"
  | "accounts"
  | "accountFolders"
  | "unifiedCounts"
  | "emails"
  | "lastSearchParams"
  | "selectedEmailId"
  | "selectedIds"
  | "composer"
> = {
  isInitialized: false,
  accounts: [],
  accountFolders: {},
  unifiedCounts: { primary: 0, sent: 0, spam: 0 },
  emails: [],
  lastSearchParams: null,
  selectedEmailId: null,
  selectedIds: new Set<number>(),
  composer: {
    open: false,
  },
};

export const useEmailStore = create<EmailState>((set, get) => ({
  ...initialState,

  fetchAccountsAndFolders: async () => {
    try {
      const accounts = (await invoke<Account[]>("get_accounts")) || [];
      
      // Only update accounts if they've changed
      const currentAccounts = get().accounts;
      const accountsChanged = accounts.length !== currentAccounts.length || 
        accounts.some((a, i) => a.data.id !== currentAccounts[i]?.data.id || a.data.email !== currentAccounts[i]?.data.email);
      
      if (accountsChanged) {
        set({ accounts });
      }

      const foldersMap: Record<number, Folder[]> = {};
      const currentFoldersMap = get().accountFolders;
      let foldersChanged = false;

      // Parallelize folder fetching for all accounts
      await Promise.all(
        accounts.map(async (account) => {
          if (account.data.id) {
            const folders = await invoke<Folder[]>("get_folders", {
              account_id: account.data.id,
            });
            foldersMap[account.data.id] = folders;
            
            const currentFolders = currentFoldersMap[account.data.id] || [];
            if (folders.length !== currentFolders.length || 
                folders.some((f, i) => f.id !== currentFolders[i]?.id || f.unread_count !== currentFolders[i]?.unread_count)) {
              foldersChanged = true;
            }
          }
        }),
      );

      if (foldersChanged || Object.keys(foldersMap).length !== Object.keys(currentFoldersMap).length) {
        set({ accountFolders: foldersMap });
      }
      
      get().fetchUnifiedCounts();
    } catch (error) {
      console.error("Failed to fetch accounts/folders:", error);
    }
  },

  fetchUnifiedCounts: async () => {
    try {
      const counts = await invoke<any>("get_unified_counts");
      if (!counts) return;
      
      const current = get().unifiedCounts;
      if (current.primary !== (counts.primary || 0) || 
          current.sent !== (counts.sent || 0) || 
          current.spam !== (counts.spam || 0)) {
        set({
          unifiedCounts: {
            primary: counts.primary || 0,
            sent: counts.sent || 0,
            spam: counts.spam || 0,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch unified counts:", error);
    }
  },

  refreshEmails: async () => {
    // This is now handled by TanStack Query invalidation usually,
    // but we can keep it for manual triggers if needed.
    // For now we'll just keep the signature.
  },

  setSelectedEmailId: (id) => {
    const currentId = get().selectedEmailId;
    if (currentId === id) return;

    set({ selectedEmailId: id });

    if (id) {
      const email = get().emails.find((e) => e.id === id);
      if (email && !email.flags.includes("seen")) {
        get().markAsRead([id]);
      }
    }
  },

  toggleSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  selectRange: (id) => {
    const { emails, selectedIds, selectedEmailId } = get();
    if (emails.length === 0) return;

    const currentIndex = emails.findIndex((e) => e.id === id);
    if (currentIndex === -1) return;

    // Use the last selected item or the focused item as the anchor
    let anchorId = selectedEmailId;
    if (selectedIds.size > 0 && !selectedIds.has(anchorId || -1)) {
      // If focused item isn't selected, find the "last" selected item's index
      // For simplicity, we'll just take the one with the highest/lowest index that is already selected
      // But a better way is to track the last clicked item.
      // For now, let's just find any selected item's index.
      const selectedIndices = emails
        .map((e, i) => (selectedIds.has(e.id) ? i : -1))
        .filter((i) => i !== -1);

      if (selectedIndices.length > 0) {
        // Find the index closest to currentIndex
        const closestIndex = selectedIndices.reduce((prev, curr) =>
          Math.abs(curr - currentIndex) < Math.abs(prev - currentIndex)
            ? curr
            : prev,
        );
        anchorId = emails[closestIndex].id;
      }
    }

    if (anchorId === null) {
      get().toggleSelect(id);
      return;
    }

    const anchorIndex = emails.findIndex((e) => e.id === anchorId);
    if (anchorIndex === -1) {
      get().toggleSelect(id);
      return;
    }

    const start = Math.min(anchorIndex, currentIndex);
    const end = Math.max(anchorIndex, currentIndex);

    set((state) => {
      const next = new Set(state.selectedIds);
      const isSelecting = !next.has(id);

      for (let i = start; i <= end; i++) {
        if (isSelecting) {
          next.add(emails[i].id);
        } else {
          next.delete(emails[i].id);
        }
      }
      return { selectedIds: next };
    });
  },

  toggleSelectAll: () => {
    const { emails, selectedIds } = get();
    if (selectedIds.size === emails.length && emails.length > 0) {
      set({ selectedIds: new Set() });
    } else {
      set({ selectedIds: new Set(emails.map((e) => e.id)) });
    }
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  setComposer: (state) =>
    set((s) => ({ composer: { ...s.composer, ...state } })),

  markAsRead: async (ids) => {
    // 1. Optimistic Update
    set((state) => ({
      emails: state.emails.map((email) => {
        if (ids.includes(email.id) && !email.flags.includes("seen")) {
          // Parse and update flags
          try {
            const flags = JSON.parse(email.flags) as string[];
            if (!flags.includes("seen")) {
              flags.push("seen");
            }
            return { ...email, flags: JSON.stringify(flags) };
          } catch {
            return { ...email, flags: '["seen"]' };
          }
        }
        return email;
      }),
    }));

    try {
      await invoke("mark_as_read", { emailIds: ids });
      // We don't need to refresh the whole list immediately here
      // since the event listener will handle consistency eventually
      // but the UI is already updated.
    } catch (error) {
      console.error("Failed to mark as read:", error);
      // Revert on error if needed, but for flags, a background sync usually fixes it
    }
  },

  moveToTrash: async (ids) => {
    // 1. Optimistic Update: remove from current list
    const currentEmails = get().emails;
    const currentSelectedIds = get().selectedIds;
    const currentSelectedEmailId = get().selectedEmailId;

    set((state) => ({
      emails: state.emails.filter((email) => !ids.includes(email.id)),
      selectedIds: new Set(
        Array.from(state.selectedIds).filter((id) => !ids.includes(id)),
      ),
      selectedEmailId:
        state.selectedEmailId && ids.includes(state.selectedEmailId)
          ? null
          : state.selectedEmailId,
    }));

    try {
      await invoke("move_to_trash", { emailIds: ids });
      get().fetchUnifiedCounts();
      get().fetchAccountsAndFolders();
    } catch (error) {
      console.error("Failed to move to trash:", error);
      // Revert if it failed
      set({
        emails: currentEmails,
        selectedIds: currentSelectedIds,
        selectedEmailId: currentSelectedEmailId,
      });
    }
  },

  archiveEmails: async (ids) => {
    // 1. Optimistic Update: remove from current list
    const currentEmails = get().emails;
    const currentSelectedIds = get().selectedIds;
    const currentSelectedEmailId = get().selectedEmailId;

    set((state) => ({
      emails: state.emails.filter((email) => !ids.includes(email.id)),
      selectedIds: new Set(
        Array.from(state.selectedIds).filter((id) => !ids.includes(id)),
      ),
      selectedEmailId:
        state.selectedEmailId && ids.includes(state.selectedEmailId)
          ? null
          : state.selectedEmailId,
    }));

    try {
      await invoke("archive_emails", { emailIds: ids });
      get().fetchUnifiedCounts();
      get().fetchAccountsAndFolders();
    } catch (error) {
      console.error("Failed to archive emails:", error);
      // Revert if it failed
      set({
        emails: currentEmails,
        selectedIds: currentSelectedIds,
        selectedEmailId: currentSelectedEmailId,
      });
    }
  },

  moveToInbox: async (ids) => {
    // 1. Optimistic Update: remove from current list (assuming we are in a view where it should disappear, like Spam)
    const currentEmails = get().emails;
    const currentSelectedIds = get().selectedIds;
    const currentSelectedEmailId = get().selectedEmailId;

    set((state) => ({
      emails: state.emails.filter((email) => !ids.includes(email.id)),
      selectedIds: new Set(
        Array.from(state.selectedIds).filter((id) => !ids.includes(id)),
      ),
      selectedEmailId:
        state.selectedEmailId && ids.includes(state.selectedEmailId)
          ? null
          : state.selectedEmailId,
    }));

    try {
      await invoke("move_to_inbox", { emailIds: ids });
      get().fetchUnifiedCounts();
      get().fetchAccountsAndFolders();
    } catch (error) {
      console.error("Failed to move to inbox:", error);
      // Revert if it failed
      set({
        emails: currentEmails,
        selectedIds: currentSelectedIds,
        selectedEmailId: currentSelectedEmailId,
      });
    }
  },

  init: () => {
    get()
      .fetchAccountsAndFolders()
      .then(() => {
        set({ isInitialized: true });
      });

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const unlistenPromise = listen("emails-updated", () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        get().fetchAccountsAndFolders();
      }, 500);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      if (timeout) clearTimeout(timeout);
    };
  },

  reset: () => set(initialState),
}));
