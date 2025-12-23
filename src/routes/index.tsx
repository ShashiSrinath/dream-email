import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { format } from "date-fns";
import { Mail, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const inboxSearchSchema = z.object({
  accountId: z.number().optional(),
  folderId: z.number().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: inboxSearchSchema,
  component: InboxView,
});

type Email = {
  id: number;
  account_id: number;
  folder_id: number;
  remote_id: string;
  message_id: string | null;
  subject: string | null;
  sender_name: string | null;
  sender_address: string;
  date: string;
  flags: string;
};

function InboxView() {
  const { accountId, folderId } = Route.useSearch();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const data = await invoke<Email[]>("get_emails", { 
        accountId: accountId || null, 
        folderId: folderId || null 
      });
      setEmails(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();

    // Listen for updates from backend
    const unlisten = listen("emails-updated", () => {
      fetchEmails();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [accountId, folderId]);

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Email List */}
      <div className="w-1/3 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b bg-background flex justify-between items-center h-16 shrink-0">
          <h1 className="text-xl font-bold">
            {folderId ? "Folder" : accountId ? "Account" : "Unified Inbox"}
          </h1>
          <Badge variant="secondary">{emails.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {loading && emails.length === 0 && (
               <div className="p-8 text-center text-muted-foreground animate-pulse">
                 Loading emails...
               </div>
            )}
            {!loading && emails.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No emails found</p>
              </div>
            )}
            {emails.map((email) => {
              const isUnread = !email.flags.includes("\Seen");
              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmailId(email.id)}
                  className={cn(
                    "flex flex-col gap-1 p-4 text-left border-b transition-colors hover:bg-muted/50",
                    selectedEmailId === email.id && "bg-muted",
                    isUnread && "bg-blue-50/30 font-semibold"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn("font-medium truncate text-sm", isUnread && "text-primary font-bold")}>
                      {email.sender_name || email.sender_address}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {format(new Date(email.date), "MMM d")}
                    </span>
                  </div>
                  <div className={cn("text-xs truncate", isUnread && "text-foreground")}>
                    {email.subject || "(No Subject)"}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Email Content */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedEmail ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b space-y-4">
              <h2 className="text-2xl font-bold">{selectedEmail.subject || "(No Subject)"}</h2>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold block truncate">
                      {selectedEmail.sender_name}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(selectedEmail.date), "PPP p")}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground block truncate">
                    &lt;{selectedEmail.sender_address}&gt;
                  </span>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-8">
              <div className="max-w-3xl mx-auto">
                <div className="p-12 border-2 border-dashed rounded-2xl text-center text-muted-foreground bg-muted/5">
                  <p className="text-lg font-medium">Email content synchronization is coming soon.</p>
                  <p className="text-sm mt-2">We are currently syncing metadata and headers for lightning-fast performance.</p>
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p>Select an email to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
