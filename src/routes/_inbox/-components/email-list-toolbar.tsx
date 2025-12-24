import { Badge } from "@/components/ui/badge";

interface EmailListToolbarProps {
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  title: string;
  emailCount: number;
}

export function EmailListToolbar({
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  title,
  emailCount,
}: EmailListToolbarProps) {
  return (
    <div className="p-4 border-b bg-background flex justify-between items-center h-16 shrink-0">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isSomeSelected;
          }}
          onChange={onToggleSelectAll}
        />
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      <Badge variant="secondary">{emailCount}</Badge>
    </div>
  );
}
