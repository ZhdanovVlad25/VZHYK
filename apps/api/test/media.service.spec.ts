import { MediaService } from '../src/modules/media/media.service';
import { Media } from '../src/modules/media/media.entity';
import { Listing } from '../src/modules/listings/listing.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    remove: jest.fn(async (entity) => entity),
  };
}

async function expectHttpError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`expected promise to reject with code ${code}`);
  } catch (err) {
    expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
  }
}

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function jpegFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: JPEG_BYTES,
    mimetype: 'image/jpeg',
    size: JPEG_BYTES.length,
    originalname: 'photo.jpg',
    ...overrides,
  } as Express.Multer.File;
}

describe('MediaService', () => {
  let media: MockRepo;
  let listings: { findOwnedListing: jest.Mock };
  let storage: { upload: jest.Mock; delete: jest.Mock; getSignedUrl: jest.Mock };
  let service: MediaService;

  beforeEach(() => {
    media = mockRepo();
    listings = { findOwnedListing: jest.fn().mockResolvedValue({ id: 'l-1', userId: 'owner' } as Listing) };
    storage = {
      upload: jest.fn().mockResolvedValue({ key: 'listings/l-1/x.jpg', url: 'https://signed.example/x.jpg' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/refresh.jpg'),
    };
    service = new MediaService(media as never, listings as never, storage as never);
  });

  describe('upload', () => {
    it('перевіряє право власності на оголошення перед завантаженням', async () => {
      listings.findOwnedListing.mockRejectedValue(new Error('LISTING_NOT_OWNER'));

      await expect(service.upload('someone-else', 'l-1', jpegFile())).rejects.toThrow('LISTING_NOT_OWNER');
    });

    it('кидає LISTING_MEDIA_FILE_REQUIRED, якщо файл не передано', async () => {
      await expectHttpError(service.upload('owner', 'l-1', undefined), 'LISTING_MEDIA_FILE_REQUIRED');
    });

    it('кидає LISTING_MEDIA_INVALID_TYPE для недозволеного MIME', async () => {
      await expectHttpError(
        service.upload('owner', 'l-1', jpegFile({ mimetype: 'application/pdf' })),
        'LISTING_MEDIA_INVALID_TYPE',
      );
    });

    it('кидає LISTING_MEDIA_INVALID_TYPE, якщо байти не відповідають заявленому MIME', async () => {
      await expectHttpError(
        service.upload('owner', 'l-1', jpegFile({ mimetype: 'image/png', buffer: JPEG_BYTES })),
        'LISTING_MEDIA_INVALID_TYPE',
      );
    });

    it('перше фото стає isMain=true з sortOrder=0', async () => {
      media.count.mockResolvedValue(0);

      const result = await service.upload('owner', 'l-1', jpegFile());

      expect(result.isMain).toBe(true);
      expect(result.sortOrder).toBe(0);
      expect(result.url).toBe('https://signed.example/x.jpg');
    });

    it('наступне фото не стає isMain і отримує наступний sortOrder', async () => {
      media.count.mockResolvedValue(2);

      const result = await service.upload('owner', 'l-1', jpegFile({ mimetype: 'image/png', buffer: PNG_BYTES }));

      expect(result.isMain).toBe(false);
      expect(result.sortOrder).toBe(2);
    });
  });

  describe('update', () => {
    it('кидає MEDIA_NOT_FOUND, якщо файл не належить цьому оголошенню', async () => {
      media.findOne.mockResolvedValue(null);

      await expectHttpError(service.update('owner', 'l-1', 'm-1', { isMain: true }), 'MEDIA_NOT_FOUND');
    });

    it('встановлення isMain=true знімає isMain з решти файлів оголошення', async () => {
      media.findOne.mockResolvedValue({ id: 'm-1', listingId: 'l-1', isMain: false, storageKey: 'k' } as Media);

      await service.update('owner', 'l-1', 'm-1', { isMain: true });

      expect(media.update).toHaveBeenCalledWith({ listingId: 'l-1' }, { isMain: false });
      expect(media.save).toHaveBeenCalledWith(expect.objectContaining({ isMain: true }));
    });
  });

  describe('remove', () => {
    it('видаляє файл зі storage і рядок з БД', async () => {
      const item = { id: 'm-1', listingId: 'l-1', storageKey: 'listings/l-1/x.jpg' } as Media;
      media.findOne.mockResolvedValue(item);

      await service.remove('owner', 'l-1', 'm-1');

      expect(storage.delete).toHaveBeenCalledWith('listings/l-1/x.jpg');
      expect(media.remove).toHaveBeenCalledWith(item);
    });
  });
});
