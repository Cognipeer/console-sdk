/**
 * The file name a `Content-Disposition` header carries, or undefined.
 *
 * Reads the RFC 6266 forms a download route sends: `filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`
 * (wins when both are present), `filename="report.pdf"` (backslash escapes allowed) and a
 * bare `filename=report.pdf`. The result is a base name: a path in the header is cut to its
 * last segment, so a caller that writes the file under this name cannot be pointed
 * outside its own directory by a hostile or buggy header.
 */
export function fileNameFromContentDisposition(header: string | null | undefined): string | undefined {
  if (!header) return undefined;

  const extended = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (extended) {
    const parts = /^([\w-]+)'[^']*'(.*)$/.exec(extended[1]!.trim());
    if (parts) {
      const decoded = decodeExtendedValue(parts[1]!, parts[2]!);
      const name = decoded ? baseName(decoded) : undefined;
      if (name) return name;
    }
  }

  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted) return baseName(quoted[1]!.replace(/\\(.)/g, '$1')) || undefined;

  const bare = /filename\s*=\s*([^;]+)/i.exec(header);
  return bare ? baseName(bare[1]!.trim()) || undefined : undefined;
}

function decodeExtendedValue(charset: string, value: string): string | undefined {
  const label = charset.toLowerCase();
  try {
    if (label === 'utf-8' || label === 'utf8') return decodeURIComponent(value);
    if (label === 'iso-8859-1' || label === 'latin1') {
      return value.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    }
  } catch {
    // A malformed escape: fall back to the plain `filename`.
  }
  return undefined;
}

function baseName(name: string): string {
  const segments = name.split(/[\\/]/);
  return (segments[segments.length - 1] ?? '').trim();
}
