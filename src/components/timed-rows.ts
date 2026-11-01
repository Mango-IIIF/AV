/**
 * Tints the row being heard: the last one started, until the next begins or it
 * ends. Rows carry their span as `data-start` and `data-end`.
 */
export const markActiveRow = (root: ParentNode, time: number): HTMLElement | undefined => {
  let active: HTMLElement | undefined;
  root.querySelectorAll<HTMLElement>('[data-start]').forEach((row) => {
    const start = Number(row.dataset.start);
    const end = row.dataset.end ? Number(row.dataset.end) : Number.NaN;
    const isActive = row.dataset.start !== '' && Number.isFinite(start) && time >= start && (!Number.isFinite(end) || time < end);
    const button = row.querySelector(':scope > button');
    button?.classList.toggle('active', isActive);
    if (isActive) button?.setAttribute('aria-current', 'true');
    else button?.removeAttribute('aria-current');
    if (isActive) active = row;
  });
  return active;
};

/** Brings a row to the top of its list. The list is the rows' offset parent, so offsetTop is already within it. */
export const scrollRowToTop = (row: HTMLElement): void => {
  const list = row.closest<HTMLElement>('.list');
  list?.scrollTo?.({ top: row.offsetTop, behavior: 'smooth' });
};
