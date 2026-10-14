export function getMasonryLayout(ratios: number[], width: number, columns: number) {
  const gap = 6;
  const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
  const bottoms = Array<number>(columns).fill(0);
  const items = ratios.map((ratio) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const top = bottoms[column];
    const height = columnWidth / ratio;
    bottoms[column] = top + height + gap;
    return { left: column * (columnWidth + gap), top, width: columnWidth, height };
  });
  return { items, height: ratios.length ? Math.max(...bottoms) - gap : 0 };
}
