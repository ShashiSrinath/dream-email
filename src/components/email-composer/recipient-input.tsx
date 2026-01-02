import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { invoke } from "@tauri-apps/api/core";
import { Sender } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, User, Mail } from "lucide-react";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function RecipientInput({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  autoFocus
}: RecipientInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [results, setResults] = React.useState<Sender[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const debouncedQuery = useDebounce(inputValue, 300);

  // Sync internal state with external value
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  React.useEffect(() => {
    const search = async () => {
      // Find the last email address being typed (after comma)
      const parts = debouncedQuery.split(",").map((p: string) => p.trim());
      const lastPart = parts[parts.length - 1];

      if (!lastPart || lastPart.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await invoke<Sender[]>("search_contacts", {
          query: lastPart,
          limit: 10
        });
        setResults(searchResults);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
        search();
    }
  }, [debouncedQuery, open]);

  const handleSelect = (sender: Sender) => {
    const parts = inputValue.split(",").map(p => p.trim());
    parts[parts.length - 1] = sender.address;
    const newValue = parts.join(", ") + ", ";
    setInputValue(newValue);
    onChange(newValue);
    setOpen(false);
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <CommandPrimitive shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="flex items-center">
          <CommandPrimitive.Input
            value={inputValue}
            onValueChange={(val) => {
                setInputValue(val);
                onChange(val);
                if (!open && val.length > 0) setOpen(true);
            }}
            onBlur={() => {
                // Delay closing to allow clicking on items
                setTimeout(() => setOpen(false), 200);
                onBlur?.();
            }}
            onFocus={() => {
                if (inputValue.length > 0) setOpen(true);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="flex-1 border-none shadow-none focus:ring-0 px-3 pr-20 -ml-3 h-10 text-[14px] font-medium placeholder:text-muted-foreground/30 transition-all bg-transparent outline-none"
          />
        </div>
        {open && (results.length > 0 || isLoading) && (
          <div className="absolute top-full left-0 w-full z-50 mt-1">
            <div className="bg-popover text-popover-foreground rounded-2xl border border-border/40 shadow-2xl p-1.5 min-w-[320px] animate-in fade-in slide-in-from-top-2 duration-200">
              <CommandPrimitive.List className="max-h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                </CommandPrimitive.Empty>
                {isLoading && results.length === 0 && (
                   <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                )}
                <CommandPrimitive.Group>
                  {results.map((sender) => (
                    <CommandPrimitive.Item
                      key={sender.address}
                      value={sender.address}
                      onSelect={() => handleSelect(sender)}
                      className="rounded-xl py-3 px-3 aria-selected:bg-primary/5 aria-selected:text-primary transition-colors cursor-pointer flex items-center gap-3"
                    >
                      <Avatar className="w-10 h-10 border border-border/10 shrink-0">
                        <AvatarImage src={sender.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                          {sender.name ? sender.name[0].toUpperCase() : sender.address[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[14px] tracking-tight truncate">
                            {sender.name || sender.address.split('@')[0]}
                          </span>
                          {sender.is_verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" />
                          )}
                          {sender.is_contact && (
                            <User className="w-3.5 h-3.5 text-primary/60" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground/70 truncate">{sender.address}</span>
                      </div>
                      <div className="shrink-0 opacity-0 group-aria-selected:opacity-100 transition-opacity">
                         <Mail className="w-4 h-4 text-primary/40" />
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              </CommandPrimitive.List>
            </div>
          </div>
        )}
      </CommandPrimitive>
    </div>
  );
}
