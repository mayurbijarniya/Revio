"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface ThemeSwitcherProps {
    className?: string
    defaultValue?: string
    value?: string
    onChange?: (theme: string) => void
}

export function ThemeSwitcher({ className, value, onChange }: ThemeSwitcherProps) {
    const { theme: nextTheme, setTheme: setNextTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Handle both internal (next-themes) and external control
    const currentTheme = value || nextTheme
    const handleThemeChange = (newTheme: string) => {
        if (onChange) {
            onChange(newTheme)
        } else {
            setNextTheme(newTheme)
        }
    }

    const cycleTheme = () => {
        // Simple 2-state toggle: If dark -> light, otherwise -> dark
        // This covers 'system' state too (if system is light, it swaps to dark; if dark, swaps to light? No.)
        // Better: forced toggle between explicit light/dark
        if (currentTheme === "dark") {
            handleThemeChange("light")
        } else {
            handleThemeChange("dark")
        }
    }

    if (!mounted) {
        return (
            <div className={cn("w-9 h-9", className)} />
        )
    }

    return (
        <button
            onClick={cycleTheme}
            className={cn(
                "relative inline-flex items-center justify-center w-10 h-10 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none",
                className
            )}
            title={`Current theme: ${currentTheme}`}
        >
            <span className="sr-only">Toggle theme</span>

            {/* Sun (Light) */}
            <Sun
                className={cn(
                    "h-5 w-5 transition-all duration-500 absolute text-orange-500",
                    currentTheme === "light" || (currentTheme === "system" && !window.matchMedia('(prefers-color-scheme: dark)').matches)
                        ? "scale-100 rotate-0 opacity-100"
                        : "scale-0 -rotate-90 opacity-0"
                )}
            />

            {/* Moon (Dark) */}
            <Moon
                className={cn(
                    "h-5 w-5 transition-all duration-500 absolute text-indigo-400",
                    currentTheme === "dark" || (currentTheme === "system" && window.matchMedia('(prefers-color-scheme: dark)').matches)
                        ? "scale-100 rotate-0 opacity-100"
                        : "scale-0 rotate-90 opacity-0"
                )}
            />

            {/* Removed Monitor Icon from rotation since we are doing 2-state toggle visual */}
        </button>
    )
}
