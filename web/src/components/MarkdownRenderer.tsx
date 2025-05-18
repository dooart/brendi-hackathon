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
  // Convert \$\$ ... \$\$ to $$ ... $$ for block math
  let processed = content.replace(/\\\$\\\$([\s\S]*?)\\\$\\\$/g, (match, math) => `$$${math}$$`);
  // Convert [ ... ] to $...$ (only if it looks like LaTeX)
  processed = processed.replace(/\[([^\]]*\\[a-zA-Z]+[^\]]*)\]/g, (match, p1) => `$${p1}$`);
  // Convert (\math... ) to $...$ for inline math
  processed = processed.replace(/\((\\[a-zA-Z]+[^\)]*)\)/g, (match, p1) => `$${p1}$`);
  // Convert [\math... ] to $$...$$ for block math
  processed = processed.replace(/\[(\\[a-zA-Z]+[^\]]*)\]/g, (match, p1) => `$$${p1}$$`);
  // Convert any $...$ block containing a newline into $$...$$
  processed = processed.replace(/\$([^$\n]*\n[^$]*)\$/g, (match, p1) => `$$${p1}$$`);
  // Escape underscores in math mode (inside $...$ and $$...$$)
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    return `$$${math.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, '$1_{ $2 }')}$$`;
  });
  processed = processed.replace(/\$([^$\n]+)\$/g, (match, math) => {
    return `$${math.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, '$1_{ $2 }')}$`;
  });

  // --- NEW: Ensure only math is inside $$...$$ blocks ---
  // This will split any block like: $$math$$ text -> $$math$$\ntext
  processed = processed.replace(/\$\$([\s\S]*?)\$\$(?!\$)/g, (match, math) => {
    // Split at the first occurrence of a linebreak followed by non-math text
    const split = math.split(/(?<=\S)\n(?=[^\\$\\\\])/);
    if (split.length > 1) {
      return `$$${split[0]}$$\n${split.slice(1).join('\n')}`;
    }
    // Also split if there is a 'where' or other text after the math
    const whereIdx = math.indexOf('where ');
    if (whereIdx !== -1) {
      return `$$${math.slice(0, whereIdx).trim()}$$\n${math.slice(whereIdx)}`;
    }
    return `$$${math}$$`;
  });

  // --- NEW: Replace | in subscripts/superscripts with \mid for KaTeX ---
  // _{...|...} => _{...\mid...}, ^{...|...} => ^{...\mid...}
  processed = processed.replace(/_\{([^}]*)\|([^}]*)\}/g, '_{$1\\mid $2}');
  processed = processed.replace(/\^\{([^}]*)\|([^}]*)\}/g, '^{$1\\mid $2}');

  // --- NEW: Remove all $$ inside math blocks (except delimiters) ---
  // This will remove any accidental double-wrapping or $$ inside math
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    // Remove any $$ inside the math block
    const cleaned = math.replace(/\$\$/g, '');
    return `$$${cleaned}$$`;
  });

  // --- NEW: Remove stray \\ lines between blocks ---
  processed = processed.replace(/\\\s*\n/g, '\n');
  processed = processed.replace(/\\\s*$/gm, '');

  // --- NEW: Remove empty lines between math blocks ---
  processed = processed.replace(/\n{2,}/g, '\n\n');

  // Convert $...$ on its own line (block) to $$...$$, even at end of file or with spaces
  processed = processed.replace(/(^|[\n\r])\$\s*[\n\r]+([\s\S]*?)[\n\r]+\$([\n\r]|$)/g, '$1$$\n$2\n$$$3');
  // Fallback: block math at end of file without trailing newline
  processed = processed.replace(/(^|[\n\r])\$\s*[\n\r]+([\s\S]*?)\s*\$(\s*)$/g, '$1$$\n$2\n$$$3');

  return processed;
}

// Aggressive preprocessing: convert all [ ... ] (anywhere) to $$ ... $$ for block math
function simplePreprocess(content: string): string {
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  // Bypass simplePreprocess for debugging math rendering
  // const processed = simplePreprocess(content);
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
        {content}
      </ReactMarkdown>
    </div>
  );
}; 