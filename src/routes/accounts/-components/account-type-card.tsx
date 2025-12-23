import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountTypeCard({
  title,
  description,
  icon: Icon,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      className={cn(
        "w-full cursor-pointer hover:bg-accent transition-all duration-200 border-muted-foreground/10 hover:border-primary/50",
        disabled && "opacity-50 pointer-events-none",
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
        <div className="flex items-center space-x-6">
          <div className="p-3 bg-background rounded-xl shadow-sm border border-muted-foreground/5">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardHeader>
    </Card>
  );
}
