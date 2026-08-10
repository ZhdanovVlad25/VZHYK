import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Location } from '../../modules/location/location.entity';
import { Category } from '../../modules/categories/category.entity';

/**
 * Мінімальний seed для Phase 1: кілька областей/міст (locations) і top-level
 * категорій (categories) з categories.md, щоб було на чому перевіряти форми/дерево.
 * Повний seed (усі 24 області, повне дерево категорій) — Phase 2.
 */
async function run() {
  await AppDataSource.initialize();

  const locationRepo = AppDataSource.getRepository(Location);
  const categoryRepo = AppDataSource.getRepository(Category);

  const ukraine = await locationRepo.save(
    locationRepo.create({ level: 'country', nameUk: 'Україна', slug: 'ukraine' }),
  );
  const kyivRegion = await locationRepo.save(
    locationRepo.create({
      level: 'region',
      nameUk: 'Київська область',
      slug: 'kyivska-oblast',
      parentId: ukraine.id,
    }),
  );
  await locationRepo.save(
    locationRepo.create({
      level: 'city',
      nameUk: 'Київ',
      slug: 'kyiv',
      parentId: kyivRegion.id,
      lat: 50.4501,
      lng: 30.5234,
    }),
  );

  const topLevelCategories = [
    'Дитячий світ',
    'Нерухомість',
    'Авто',
    'Запчастини',
    'Електроніка',
    'Дім і сад',
    'Мода і стиль',
    'Хобі, відпочинок і спорт',
    'Робота',
    'Бізнес та послуги',
    'Тварини',
    'Оренда та прокат',
    'Житло подобово',
    'Безкоштовно',
    'Обмін',
  ];

  for (const [index, nameUk] of topLevelCategories.entries()) {
    await categoryRepo.save(
      categoryRepo.create({
        nameUk,
        slug: slugify(nameUk),
        level: 0,
        sortOrder: index,
        isActive: true,
      }),
    );
  }

  // eslint-disable-next-line no-console
  console.log('[seed] done: locations + top-level categories');
  await AppDataSource.destroy();
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
    з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
    о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ' ': '-', ',': '',
  };
  return input
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err);
  process.exit(1);
});
