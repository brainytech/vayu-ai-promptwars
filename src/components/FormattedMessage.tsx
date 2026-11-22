import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Matches **bold**, `code`, and *italic*
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const matchStr = match[0];
    if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
      tokens.push(
        <strong key={`b-${match.index}`} className="font-semibold text-inherit">
          {matchStr.slice(2, -2)}
        </strong>
      );
    } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${match.index}`}
          className="px-1 py-0.5 rounded bg-slate-200/70 text-slate-800 font-mono text-xs"
        >
          {matchStr.slice(1, -1)}
        </code>
      );
    } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
      tokens.push(
        <em key={`i-${match.index}`} className="italic">
          {matchStr.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

interface FormattedMessageProps {
  content: string;
  isDark?: boolean;
}

export function FormattedMessage({ content, isDark = false }: FormattedMessageProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            className="my-2 space-y-1 pl-4 list-disc marker:text-slate-400"
          >
            {currentList.items.map((it, idx) => (
              <li key={idx} className="leading-relaxed">
                {it}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            className="my-2 space-y-1.5 pl-4 list-decimal marker:font-semibold marker:text-slate-500"
          >
            {currentList.items.map((it, idx) => (
              <li key={idx} className="leading-relaxed">
                {it}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Empty lines
    if (!line) {
      flushList();
      continue;
    }

    // 2. Horizontal divider lines: ---, ***, ___
    if (/^[-*_]{3,}$/.test(line)) {
      flushList();
      elements.push(
        <hr
          key={`hr-${i}`}
          className={`my-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
        />
      );
      continue;
    }

    // 3. Headings: ###, ##, #
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${i}`}
          className={`font-bold text-sm mt-3 mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3
          key={`h3-${i}`}
          className={`font-bold text-base mt-3.5 mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h2
          key={`h2-${i}`}
          className={`font-bold text-lg mt-4 mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {renderInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    // 4. Bullet list items: - item, * item
    if (/^[-*]\s+/.test(line)) {
      const itemText = line.replace(/^[-*]\s+/, '');
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInline(itemText));
      continue;
    }

    // 5. Numbered list items: 1. item, 2. item
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInline(itemText));
      continue;
    }

    // 6. Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed">
        {renderInline(rawLine)}
      </p>
    );
  }

  flushList();

  return <div className="formatted-message space-y-0.5">{elements}</div>;
}
