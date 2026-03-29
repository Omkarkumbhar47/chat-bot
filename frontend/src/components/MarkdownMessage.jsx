import React, { useEffect, useId, useMemo, useState } from "react";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

let mermaidInitialized = false;

function MermaidBlock({ chart, theme }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const rawId = useId();
  const chartId = useMemo(
    () => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawId],
  );

  useEffect(() => {
    async function renderChart() {
      try {
        // Mermaid should only be initialized once in the browser runtime.
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: theme === "dark" ? "dark" : "default",
            securityLevel: "loose",
          });
          mermaidInitialized = true;
        }

        const { svg: renderedSvg } = await mermaid.render(chartId, chart);
        setSvg(renderedSvg);
        setError("");
      } catch {
        setError("Unable to render diagram.");
      }
    }

    renderChart();
  }, [chart, chartId, theme]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-4 text-xs">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return <div className="text-sm text-[hsl(var(--muted-foreground))]">Rendering diagram...</div>;
  }

  return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function MarkdownMessage({ content, theme = "dark" }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");

            // Render Mermaid fences as diagrams and keep other fences as normal code blocks.
            if (!inline && match?.[1] === "mermaid") {
              return <MermaidBlock chart={code} theme={theme} />;
            }

            if (!inline) {
              return (
                <pre className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-4">
                  <code className={className} {...props}>
                    {code}
                  </code>
                </pre>
              );
            }

            return (
              <code
                className="rounded bg-[hsl(var(--background))]/70 px-1.5 py-0.5 text-[0.9em]"
                {...props}
              >
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
