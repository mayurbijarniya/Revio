"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { cn } from "@/lib/utils";

interface MermaidDiagramProps {
    chart: string;
    className?: string;
}

// Initialize mermaid with custom theme
mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
    },
    sequence: {
        useMaxWidth: true,
        diagramMarginX: 10,
        diagramMarginY: 10,
    },
});

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(true);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!containerRef.current || !chart) return;

            setIsRendering(true);
            setError(null);

            try {
                // Clear previous content
                containerRef.current.innerHTML = "";

                // Generate unique ID for this diagram
                const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Render the diagram
                const { svg } = await mermaid.render(id, chart);

                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                }
            } catch (err) {
                console.error("Mermaid rendering error:", err);
                setError(err instanceof Error ? err.message : "Failed to render diagram");
            } finally {
                setIsRendering(false);
            }
        };

        renderDiagram();
    }, [chart]);

    if (error) {
        return (
            <div className={cn("bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4", className)}>
                <div className="text-xs text-red-500 mb-2">Failed to render diagram:</div>
                <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre overflow-x-auto">
                    {chart}
                </pre>
            </div>
        );
    }

    return (
        <div className={cn("relative", className)}>
            {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-sm text-gray-500">Rendering diagram...</div>
                </div>
            )}
            <div
                ref={containerRef}
                className={cn(
                    "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto",
                    "[&_svg]:max-w-full [&_svg]:h-auto",
                    isRendering && "opacity-0"
                )}
            />
        </div>
    );
}
