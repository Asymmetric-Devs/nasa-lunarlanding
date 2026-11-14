/** Read a CSS custom property (for canvas drawing). */
export const cssv = (name: string, fallback = '#888') => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
