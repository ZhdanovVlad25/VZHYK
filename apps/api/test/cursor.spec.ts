import { decodeCursor, encodeCursor } from '../src/shared/pagination/cursor';

describe('cursor', () => {
  it('encode → decode повертає той самий курсор', () => {
    const cursor = { v: '2026-08-10T12:00:00.000Z', id: '11111111-1111-1111-1111-111111111111' };

    const encoded = encodeCursor(cursor);
    const decoded = decodeCursor(encoded);

    expect(decoded).toEqual(cursor);
  });

  it('кидає для сміттєвого (не base64/не JSON) курсора', () => {
    expect(() => decodeCursor('not-a-valid-cursor!!!')).toThrow();
  });

  it('кидає, якщо декодований JSON має неправильну форму', () => {
    const malformed = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url');
    expect(() => decodeCursor(malformed)).toThrow();
  });

  it('курсор непрозорий — не є валідним base64 offset-числом', () => {
    const encoded = encodeCursor({ v: '100', id: 'x' });
    expect(encoded).not.toMatch(/^\d+$/);
  });
});
