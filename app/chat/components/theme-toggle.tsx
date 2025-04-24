"use client";

import * as React from "react";
import { CircleDashed, Flame, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "~/chat/lib/utils";

export function ThemeToggle({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(`rounded-md h-8 w-8`, className)}
          {...props}
        >
          <Flame className="h-4 w-4 rotate-0 scale-100 transition-all light:scale-0 light:-rotate-90 black:scale-0 black:-rotate-90 hover:text-sidebar-accent" />
          <Sun className="absolute h-4 w-4 rotate-90 scale-0 transition-all light:rotate-0 light:scale-100 black:scale-0 black:rotate-0 hover:text-sidebar-accent" />
          <CircleDashed className="absolute h-4 w-4 rotate-90 scale-0 transition-all black:rotate-0 black:scale-100 light:scale-0 light:rotate-0 hover:text-sidebar-accent" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Flame className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("black")}>
          <CircleDashed className="mr-2 h-4 w-4" />
          <span>Black</span>
        </DropdownMenuItem>
        {/* sunset theme */}
        <DropdownMenuItem onSelect={() => setTheme("sunset")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Sunset</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
