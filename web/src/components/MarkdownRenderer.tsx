import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [renderedContent, setRenderedContent] = useState('');

  const renderMath = (text: string) => {
    const inlineMathRegex = /\$([^\$]+)\$/g;
    const blockMathRegex = /\$\$([^\$]+)\$\$/g;
    
    // Helper function to process boxed content
    const processBoxed = (math: string) => {
      // Replace \boxed{...} with proper boxed environment
      return math.replace(/\\boxed\{([^}]+)\}/g, (_, content) => {
        return `\\begin{aligned}\\boxed{${content}}\\end{aligned}`;
      });
    };
    
    // Replace block math first
    let renderedText = text.replace(blockMathRegex, (_, math) => {
      try {
        const processedMath = processBoxed(math);
        return katex.renderToString(processedMath, {
          displayMode: true,
          throwOnError: false,
          trust: true,
          macros: {
            "\\boxed": "\\fbox{#1}"
          }
        });
      } catch (error) {
        console.error('KaTeX block math error:', error);
        return math;
      }
    });
    
    // Then replace inline math
    renderedText = renderedText.replace(inlineMathRegex, (_, math) => {
      try {
        const processedMath = processBoxed(math);
        return katex.renderToString(processedMath, {
          displayMode: false,
          throwOnError: false,
          trust: true,
          macros: {
            "\\boxed": "\\fbox{#1}"
          }
        });
      } catch (error) {
        console.error('KaTeX inline math error:', error);
        return math;
      }
    });
    
    return renderedText;
  };

  useEffect(() => {
    const renderMarkdown = async () => {
      const html = await marked(content, {
        breaks: true,
        gfm: true
      });
      setRenderedContent(renderMath(html));
    };
    
    renderMarkdown();
  }, [content]);

  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
      style={{
        lineHeight: 1.6,
        fontSize: '1em',
        color: 'inherit'
      }}
    />
  );
}; 