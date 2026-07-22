import path from "path";

/**
 * Get the base directory for storing context files
 * In production (Vercel), use /tmp which is writable
 * In development, use local context folder
 */
export function getContextBaseDir(): string {
  return process.env.NODE_ENV === 'production' 
    ? '/tmp/context' 
    : path.join(process.cwd(), "context");
}

/**
 * Get companion-specific context directory
 * @param companionName - The name of the companion
 * @returns Full path to companion's context directory
 */
export function getCompanionContextDir(companionName: string): string {
  const baseDir = getContextBaseDir();
  const sanitizedName = companionName.replaceAll(" ", "-").toLowerCase();
  return path.join(baseDir, sanitizedName);
}

/**
 * Generate a sanitized filename from title and extension
 * @param title - The file title
 * @param extension - File extension (e.g., 'pdf', 'txt')
 * @returns Sanitized filename
 */
export function generateSafeFileName(title: string, extension: string): string {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
  return `${sanitizedTitle}.${extension.toLowerCase()}`;
}
