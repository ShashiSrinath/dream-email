import { Archive, Trash2, MailOpen, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface EmailListActionsProps {
  selectedCount: number;
  onArchive: () => void;
  onDelete: () => void;
  onMarkAsRead: () => void;
  onLabel: () => void;
}

export function EmailListActions({
  selectedCount,
  onArchive,
  onDelete,
  onMarkAsRead,
  onLabel,
}: EmailListActionsProps) {
  return (
    <div className="p-2 border-b bg-background flex items-center justify-between px-4 h-12 shrink-0 animate-in slide-in-from-top duration-200">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onArchive}>
                <Archive className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onMarkAsRead}
              >
                <MailOpen className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as read</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLabel}>
                <Tag className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Label</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
