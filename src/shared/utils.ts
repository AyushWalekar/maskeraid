const DEV = import.meta?.env?.DEV;

export function devLog(...args: unknown[]): void {
  if (DEV) {
    console.log(...args);
  }
}
