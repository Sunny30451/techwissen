import { useState } from 'react';
import Icon from './Icon.jsx';

export default function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || 'text';

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="code-shell">
      <div className="code-toolbar">
        <span>{language}</span>
        <button onClick={copy} type="button">
          <Icon name="copy" size={15} /> {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <pre><code className={className}>{text}</code></pre>
    </div>
  );
}
