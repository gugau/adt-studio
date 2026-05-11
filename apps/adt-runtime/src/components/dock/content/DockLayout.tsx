import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation"
import { Search as SearchIcon } from "lucide-react"

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> { }

function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn("w-[var(--dock-width,32rem)] max-w-3xl p-4 h-[max(600px,50vh)] flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
}

interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement> { }

function Title({ children, className, ...props }: TitleProps) {
  return (
    <h4 className={cn("text-lg font-medium leading-tight break-words", className)} {...props} >
      {children}
    </h4>
  );
}


type SearchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
};

function Search({ className, ...props }: SearchProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder={t("search-placeholder") || "Search"}
        aria-label={t("search-placeholder") || "Search"}
        className="w-full h-9 pl-8 pr-2 text-sm rounded-lg bg-muted/50 border border-input outline-none focus:ring-2 focus:ring-ring"
        {...props}
      />
    </div>
  );
}

function Header({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex justify-between items-center", className)} {...props}>
      {children}
    </div>
  );
}

export const DockContent = Object.assign(Container, { Title, Search, Header });
