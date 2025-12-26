import { useState, useRef, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailContent } from "@/lib/store";

export function EmailBody({
  content,
  onContentClick,
}: { content: EmailContent | null;
  onContentClick: (e: React.MouseEvent) => void;
}) {
  const shadowRef = useRef<HTMLDivElement>(null);

  const sanitizedHtml = useMemo(() => {
    if (!content?.body_html) return null;
    return DOMPurify.sanitize(content.body_html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style"],
      FORBID_TAGS: ["script", "iframe", "object", "embed"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });
  }, [content?.body_html]);

  useEffect(() => {
    if (shadowRef.current && sanitizedHtml) {
      const container = shadowRef.current;
      let shadow = container.shadowRoot;
      if (!shadow) {
        shadow = container.attachShadow({ mode: "open" });
      }

      shadow.innerHTML = `
                <style>
                    :host {
                        display: block;
                        width: 100%;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        background-color: transparent;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        font-size: 15px;
                    }
                    #content-inner {
                        padding: 1px 0;
                        width: 100%;
                        overflow-x: auto;
                    }
                    img { 
                        max-width: 100%; 
                        height: auto; 
                        display: block; 
                        margin: 10px 0; 
                    }
                    pre { 
                        white-space: pre-wrap; 
                        word-wrap: break-word;
                        background: rgba(0,0,0,0.05); 
                        padding: 10px; 
                        border-radius: 4px; 
                        font-family: monospace;
                    }
                    table {
                        max-width: 100%;
                        height: auto;
                        border-collapse: collapse;
                    }
                    a { color: var(--primary, #2563eb); text-decoration: underline; }
                    blockquote {
                        border-left: 3px solid var(--border, #cbd5e1);
                        margin: 10px 0 10px 10px; 
                        padding-left: 15px;
                        color: var(--muted-foreground, #64748b);
                    }
                    * { 
                        box-sizing: border-box; 
                    }
                </style>
                <div id="content-inner">${sanitizedHtml}</div>
            `;
    }
  }, [sanitizedHtml]);

  // Simple parser for text content to handle quotes
  const renderTextContent = (text: string) => {
    const lines = text.split("\n");
    const groups: { type: "text" | "quote"; lines: string[] }[] = [];

    lines.forEach((line) => {
      const isQuote = line.trim().startsWith(">");
      const lastGroup = groups[groups.length - 1];

      if (
        lastGroup &&
        ((isQuote && lastGroup.type === "quote") ||
          (!isQuote && lastGroup.type === "text"))
      ) {
        lastGroup.lines.push(line);
      } else {
        groups.push({ type: isQuote ? "quote" : "text", lines: [line] });
      }
    });

    return (
      <div className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-[#1a1a1a] flex-1">
        {groups.map((group, i) =>
          group.type === "quote" ? (
            <QuotedContent key={i} text={group.lines.join("\n")} />
          ) : (
            <div key={i}>{group.lines.join("\n")}</div>
          ),
        )}
      </div>
    );
  };

  if (!content) return null;

  return (
    <div
      className="w-full flex-1 flex flex-col min-h-0 overflow-hidden"
      onClick={onContentClick}
    >
      {sanitizedHtml ? (
        <div ref={shadowRef} className="w-full flex-1 min-h-0 overflow-x-auto" />
      ) : (
        renderTextContent(content.body_text || "No content available.")
      )}
    </div>
  );
}

function QuotedContent({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="my-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-accent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <MoreHorizontal className="w-4 h-4 mr-2" />
        {isExpanded ? "Hide quoted text" : "Show quoted text"}
      </Button>
      {isExpanded && (
        <div className="border-l-2 border-border pl-4 mt-2 italic text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  );
}