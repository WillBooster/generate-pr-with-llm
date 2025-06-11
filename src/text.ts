/**
 * Truncate long text
 */
export function truncateText(output: string, maxLength: number): string {
  if (output.length <= maxLength) {
    return output;
  }

  const truncated = output.slice(0, maxLength);
  const omitted = output.length - maxLength;
  return `${truncated}\n\n... (${omitted} characters truncated) ...`;
}
