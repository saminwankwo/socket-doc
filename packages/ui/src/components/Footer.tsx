import React from 'react';
import { Github } from 'lucide-react';

interface FooterProps {
  theme: 'dark' | 'light';
}

export const Footer: React.FC<FooterProps> = ({ theme }) => {
  const linkClass = `inline-flex items-center gap-1.5 transition-colors ${
    theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-900'
  }`;

  return (
    <footer
      className={`mt-auto border-t px-4 py-4 pb-[env(safe-area-inset-bottom)] transition-colors sm:px-8 ${
        theme === 'dark' ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-xs sm:flex-row sm:justify-between">
        <p>
          SocketDocs v{__SOCKETDOCS_VERSION__} · MIT License
        </p>
        <nav className="flex items-center gap-4">
          <a
            href="https://github.com/saminwankwo/socketdocs"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Github size={14} /> GitHub
          </a>
          <a
            href="https://github.com/saminwankwo/socketdocs/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Report an issue
          </a>
        </nav>
      </div>
      <p className="mt-2 text-center text-[11px] sm:text-right">
        Built by{' '}
        <a
          href="https://github.com/saminwankwo"
          target="_blank"
          rel="noopener noreferrer"
          className={`font-medium transition-colors ${
            theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-900'
          }`}
        >
          Nwankwo Samuel
        </a>
      </p>
    </footer>
  );
};

export default Footer;
