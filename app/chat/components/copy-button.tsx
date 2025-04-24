import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "~/chat/lib/utils";
import { useCopy } from "~/chat/lib/hooks/use-copy";
import { Button } from "./ui/button";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copied, copy } = useCopy();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "transition-opacity opacity-0 group-hover/message:opacity-100 gap-1.5",
        className,
      )}
      onClick={() => copy(text)}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <CheckIcon className="h-4 w-4" />
          <span className="text-xs">Copied!</span>
        </>
      ) : (
        <>
          <CopyIcon className="h-4 w-4" />
          <span className="text-xs">Copy</span>
        </>
      )}
    </Button>
  );
}
