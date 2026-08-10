import { ALLOWED_IMAGE_MIME_TYPES, extensionForMimeType, matchesImageSignature } from '../src/modules/media/image-signature';

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_BYTES = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP', 'ascii')]);
const TEXT_BYTES = Buffer.from('<script>alert(1)</script>', 'ascii');

describe('image-signature', () => {
  it('визнає валідний JPEG за magic bytes', () => {
    expect(matchesImageSignature('image/jpeg', JPEG_BYTES)).toBe(true);
  });

  it('визнає валідний PNG за magic bytes', () => {
    expect(matchesImageSignature('image/png', PNG_BYTES)).toBe(true);
  });

  it('визнає валідний WebP за magic bytes', () => {
    expect(matchesImageSignature('image/webp', WEBP_BYTES)).toBe(true);
  });

  it('відхиляє файл, коли заявлений тип не відповідає реальним байтам', () => {
    expect(matchesImageSignature('image/png', JPEG_BYTES)).toBe(false);
    expect(matchesImageSignature('image/jpeg', TEXT_BYTES)).toBe(false);
  });

  it('відхиляє довільний виконуваний/текстовий вміст під виглядом дозволеного MIME', () => {
    for (const mime of ALLOWED_IMAGE_MIME_TYPES) {
      expect(matchesImageSignature(mime, TEXT_BYTES)).toBe(false);
    }
  });

  it('повертає false для невідомого mimetype', () => {
    expect(matchesImageSignature('application/pdf', PNG_BYTES)).toBe(false);
  });

  it('extensionForMimeType мапить відомі типи і дефолтить на bin', () => {
    expect(extensionForMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForMimeType('image/png')).toBe('png');
    expect(extensionForMimeType('image/webp')).toBe('webp');
    expect(extensionForMimeType('application/octet-stream')).toBe('bin');
  });
});
