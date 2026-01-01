export function trimStringSafe(
  str: string,
  maxLength: number,
  suffix: string = "..."
) {
  if (!str) return "";
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + suffix;
}
