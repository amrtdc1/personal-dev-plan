import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

export function PaginationControls({
  page,
  pageCount,
  onPrevious,
  onNext,
  className,
}: PaginationControlsProps) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`.trim()}>
      <p className="text-[11px] text-slate-500">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <IconButton onClick={onPrevious} disabled={page === 1} title="Previous page" size="sm">
          <ChevronLeft className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton onClick={onNext} disabled={page >= pageCount} title="Next page" size="sm">
          <ChevronRight className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}