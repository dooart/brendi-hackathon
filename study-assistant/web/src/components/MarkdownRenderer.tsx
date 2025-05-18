import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Preprocess to convert [ ... ] to $...$ for inline math and $$...$$ for block math
function preprocessMath(content: string): string {
  // Convert [ ... ] to $...$ (only if it looks like LaTeX)
  // This is a simple heuristic: if inside brackets and contains \\ or ^ or _ or frac
  return content.replace(/\[([^\]]*\\[a-zA-Z]+[^\]]*)\]/g, (match, p1) => `$${p1}$`);
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const processed = preprocessMath(content);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, {
          strict: false,
          trust: true,
          throwOnError: false,
          errorColor: '#ff5c5c',
          displayMode: true,
          output: 'html',
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ]
        }]]}
        components={{
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <code {...props} className={className}>
                {String(children).replace(/\n$/, "")}
              </code>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
          div({ className, children, ...props }) {
            if (className?.includes('math-display')) {
              return (
                <div {...props} className={className} style={{ 
                  overflowX: 'auto',
                  padding: '1em 0',
                  margin: '1em 0'
                }}>
                  {children}
                </div>
              );
            }
            return <div {...props} className={className}>{children}</div>;
          },
          span({ className, children, ...props }) {
            if (className?.includes('math-inline')) {
              return (
                <span {...props} className={className} style={{ 
                  padding: '0 0.2em'
                }}>
                  {children}
                </span>
              );
            }
            return <span {...props} className={className}>{children}</span>;
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}; 