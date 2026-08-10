/** Keyset-пагінація на (sortValue, id) — docs/database.md §3. Opaque base64 курсор, без прив'язки до offset. */
export interface SearchCursor {
  v: string;
  id: string;
}

export function encodeCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): SearchCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<SearchCursor>;
    if (typeof parsed.v !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('malformed cursor shape');
    }
    return { v: parsed.v, id: parsed.id };
  } catch {
    throw new InvalidCursorError();
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super('invalid cursor');
  }
}
