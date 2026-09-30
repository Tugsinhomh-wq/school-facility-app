"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Dark is the default; the choice is persisted and applied pre-paint by the layout script. */
export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // storage unavailable (private mode); the toggle still works for this visit
    }
  }

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="สลับโหมดสว่าง/มืด">
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
