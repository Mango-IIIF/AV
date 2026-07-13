export const componentTheme = `
  :host {
    --mango-av-accent: #5b3fd6;
    --mango-av-accent-contrast: #fff;
    --mango-av-background: #fff;
    --mango-av-surface: #f5f5f8;
    --mango-av-text: #18181b;
    --mango-av-muted: #62626a;
    --mango-av-border: #d7d7de;
    --mango-av-radius: .65rem;
    --mango-av-font: ui-sans-serif, system-ui, sans-serif;
    color: var(--mango-av-text);
    display: block;
    font-family: var(--mango-av-font);
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, select { font: inherit; }
  button, select { cursor: pointer; }
  .empty { color: var(--mango-av-muted); font-style: italic; }
  .time { color: var(--mango-av-muted); font-size: .78rem; }
`;
