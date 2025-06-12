/**
 * Truncate long text.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const omitted = text.length - maxLength;
  return `${truncated}\n\n... (${Math.floor(omitted)} characters truncated) ...`;
}
