import React, { useState } from "react";

interface Props {
  content: string;
  role: "user" | "assistant" | "tool" | "system";
}

// Simple markdown renderer (no external deps)
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(<CodeBlock key={i} lang={lang} code={codeLines.join("\n")} />);
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      nodes.push(<Tag key={i} className={`font-semibold text-white mt-3 mb-1 ${level === 1 ? "text-xl" : level === 2 ? "text-lg" : "text-base"}`}>{text}</Tag>);
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // List item
    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={i} className="list-disc pl-5 mb-2 space-y-0.5">
          {items.map((item, j) => <li key={j} className="text-gray-200">{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Paragraph
    nodes.push(<p key={i} className="text-gray-200 mb-2 leading-relaxed">{inlineMarkdown(line)}</p>);
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold, italic, inline code
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-gray-800 px-1.5 py-0.5 rounded text-violet-300 text-sm font-mono">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang || "code"}</span>
        <button onClick={copy} className="hover:text-gray-200 transition-colors">
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function MessageRenderer({ content, role }: Props) {
  if (role === "user") {
    return <p className="text-gray-100 whitespace-pre-wrap">{content}</p>;
  }

  if (role === "tool") {
    return (
      <div className="font-mono text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
        {content}
      </div>
    );
  }

  return <div className="prose">{renderMarkdown(content)}</div>;
}
