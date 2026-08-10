/**
 * docs/security.md §5: "Whitelist MIME-типів + перевірка сигнатури файлу (magic bytes),
 * не лише розширення/заголовка" — declared Content-Type від клієнта ніколи не довіряємо
 * без звірки з реальними першими байтами файлу.
 */
const SIGNATURE_CHECKS: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': (buf) =>
    buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buf) =>
    buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP',
};

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(SIGNATURE_CHECKS);

export function matchesImageSignature(mimeType: string, buffer: Buffer): boolean {
  const check = SIGNATURE_CHECKS[mimeType];
  return check ? check(buffer) : false;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}
