import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Email } from "@/lib/store";

interface EmailListItemProps {
  email: Email;
  isSelected: boolean;
  isUnread: boolean;
  selectedEmailId: number | null;
  onToggleSelect: (id: number) => void;
  virtualItem: {
    index: number;
    start: number;
  };
  measureElement: (el: HTMLElement | null) => void;
}

export function EmailListItem({
  email,
  isSelected,
  isUnread,
  selectedEmailId,
  onToggleSelect,
  virtualItem,
  measureElement,
}: EmailListItemProps) {
  return (
    <Link
      to="/email/$emailId"
      params={{ emailId: email.id.toString() }}
      search={(prev) => prev}
      data-index={virtualItem.index}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: Math.round(virtualItem.start),
        left: 0,
        width: '100%',
      }}
      preload={"intent"}
      className={cn(
        "flex items-start gap-4 p-4 text-left border-b transition-colors hover:bg-muted/50 group antialiased",
        selectedEmailId === email.id && "bg-muted",
        isSelected && "bg-primary/5",
        isUnread && !isSelected && "bg-blue-50/30 font-semibold"
      )}
    >
      <div className="pt-1 flex flex-col items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(email.id)}
          className={cn(
            "w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary transition-opacity",
            !isSelected && "opacity-0 group-hover:opacity-100"
          )}
        />
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <span className={cn("font-medium truncate text-sm", isUnread && "text-primary font-bold")}>
            {email.sender_name || email.sender_address}
          </span>
          <div className="flex items-center gap-2">
            {email.has_attachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(email.date), "MMM d")}
            </span>
          </div>
        </div>
        <div className={cn("text-xs truncate", isUnread && "text-foreground")}>
          {email.subject || "(No Subject)"}
        </div>
        {email.snippet && (
          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1 font-normal">
            {email.snippet}
          </div>
        )}
      </div>
    </Link>
  );
}
