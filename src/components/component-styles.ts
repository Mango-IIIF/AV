export const componentTheme = `
  :host {
    --mango-av-accent: #5b3fd6;
    --mango-av-accent-contrast: #fff;
    --mango-av-accent-tint: color-mix(in srgb, var(--mango-av-accent) 12%, transparent);
    --mango-av-background: #fff;
    --mango-av-surface: #f4f4f6;
    --mango-av-text: #18181b;
    --mango-av-muted: #62626a;
    --mango-av-border: #d7d7de;
    --mango-av-danger: #b42318;
    --mango-av-radius: 10px;
    --mango-av-font: ui-sans-serif, system-ui, sans-serif;
    color: var(--mango-av-text);
    display: block;
    font-family: var(--mango-av-font);
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, select { font: inherit; }
  button, select { cursor: pointer; }
  .empty { color: var(--mango-av-muted); font-size: 14px; margin: 0; }
`;

/*
 * Transcript, chapters and annotations share one look: a list of rows, each a
 * time column and its text, with the passage being heard tinted. A standalone
 * panel is a card; the complete element sets the card properties to nothing.
 */
export const panelStyles = `
  .panel {
    background: var(--mango-av-panel-background, var(--mango-av-background));
    border: var(--mango-av-panel-border, 1px solid var(--mango-av-border));
    border-radius: var(--mango-av-radius);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--mango-av-panel-padding, 16px);
  }
  h2 { font-size: 1rem; margin: 0; }
  .tools { align-items: end; display: flex; flex-wrap: wrap; gap: 8px; }
  .field { display: flex; flex: 1; flex-direction: column; font-size: 13px; font-weight: 600; gap: 6px; min-width: 10rem; }
  .tools a { color: var(--mango-av-accent); font-size: 14px; line-height: 36px; }
  input, select {
    background: var(--mango-av-surface);
    border: 1px solid var(--mango-av-border);
    border-radius: 6px;
    color: inherit;
    font-weight: 400;
    height: 36px;
    padding: 0 10px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    max-height: var(--mango-av-list-height, 24rem);
    overflow: auto;
    padding: 0;
    position: relative;
  }
  .list .list { border-left: 1px solid var(--mango-av-border); margin-left: 41px; max-height: none; overflow: visible; padding-left: 8px; }
  .row {
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: inherit;
    display: grid;
    font-size: 14px;
    gap: 10px;
    grid-template-columns: 72px 1fr;
    line-height: 1.45;
    padding: 8px;
    text-align: left;
    width: 100%;
  }
  .row:hover:not(:disabled) { background: var(--mango-av-surface); }
  .row.active, .row.active:hover { background: var(--mango-av-accent-tint); }
  .row.active time { color: var(--mango-av-accent); font-weight: 600; }
  .row:disabled { cursor: default; }
  .row time { color: var(--mango-av-muted); font-variant-numeric: tabular-nums; }
  .row .text { display: grid; gap: 4px; }
  .speaker { font-weight: 700; }
  mark { background: color-mix(in srgb, var(--mango-av-accent) 22%, transparent); border-radius: 2px; color: inherit; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { background: var(--mango-av-surface); border-radius: 999px; font-size: 12px; padding: 2px 8px; }
`;
