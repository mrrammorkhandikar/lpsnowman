import { LucideIcon, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  onClick?: () => void;
  testId?: string;
}

export function StatCard({ title, value, icon: Icon, trend, subtitle, onClick, testId }: StatCardProps) {
  return (
    <Card 
      className={onClick ? "cursor-pointer hover-elevate transition-all group" : ""}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1" data-testid={`stat-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </p>
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            {onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
