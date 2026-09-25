"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.dataset.theme !== "light")
  }, [])

  const toggle = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    document.documentElement.dataset.theme = nextDark ? "dark" : "light"
    localStorage.setItem("apah-theme", nextDark ? "dark" : "light")
  }

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn(
        "flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300",
        isDark ? "bg-zinc-950 border border-zinc-800" : "bg-white border border-zinc-200",
        className
      )}
      onClick={toggle}
    >
      <span className="flex justify-between items-center w-full">
        <span
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300",
            isDark ? "translate-x-0 bg-zinc-800" : "translate-x-8 bg-gray-200"
          )}
        >
          {isDark ? <Moon className="w-4 h-4 text-white" strokeWidth={1.5} /> : <Sun className="w-4 h-4 text-gray-700" strokeWidth={1.5} />}
        </span>
        <span
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300",
            isDark ? "bg-transparent" : "-translate-x-8"
          )}
        >
          {isDark ? <Sun className="w-4 h-4 text-gray-500" strokeWidth={1.5} /> : <Moon className="w-4 h-4 text-black" strokeWidth={1.5} />}
        </span>
      </span>
    </button>
  )
}
