import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content?: string;
  className?: string;
}

// Preprocess to convert [ ... ] to $...$ for inline math and $$...$$ for block math
function preprocessMath(content: string = ''): string {
  // Only handle $...$ and $$...$$, and preserve newlines
  return content;
}

// Aggressive preprocessing: convert all [ ... ] (anywhere) to $$ ... $$ for block math
function simplePreprocess(content: string = ''): string {
  if (!content) return '';
  
  // Replace all [ ... ] with $$ ... $$, even inline (not recommended for general markdown)
  let processed = content.replace(/\[\s*([\s\S]*?)\s*\]/g, (_, math) => `$$\n${math}\n$$`);
  // Remove any line that contains only a backslash inside a block math environment
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const cleaned = math.replace(/^\s*\\\s*$/gm, '');
    return `$$${cleaned}$$`;
  });
  // Convert \( ... \) to $...$
  processed = processed.replace(/\\\(([^]*?)\\\)/g, (_, math) => `$${math}$`);
  // Convert \[ ... \] to $$...$$
  processed = processed.replace(/\\\[([^]*?)\\\]/g, (_, math) => `$$${math}$$`);
  // Ensure blank lines before and after every block math
  processed = processed.replace(/([^\n])\$\$/g, '$1\n$$'); // blank line before
  processed = processed.replace(/(\$\$[\s\S]*?\$\$)([^\n])/g, '$1\n$2'); // blank line after
  processed = processed.replace(/^(\$\$)/gm, '\n$1');
  processed = processed.replace(/(\$\$)$/gm, '$1\n');
  return processed;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content = '', className }) => {
  const processed = preprocessMath(content);
  
  if (!content) {
    return null;
  }
  
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
                  margin: '1em 0',
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: '8px'
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
                  padding: '0 0.2em',
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: '4px'
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