/**
 * Keyset-пагінація на (sortValue, id) — docs/database.md §3. Opaque base64 курсор,
 * без прив'язки до offset. Спільний для Search і Chat (message history).
 */
export interface Cursor {
  v: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
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
