import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../modules/users/user.entity';
import { OtpCode } from '../modules/auth/otp-code.entity';
import { Profile } from '../modules/profiles/profile.entity';
import { Location } from '../modules/location/location.entity';
import { Category } from '../modules/categories/category.entity';
import { CategoryAttribute } from '../modules/attributes/category-attribute.entity';
import { AppSetting } from '../modules/settings/app-setting.entity';

dotenv.config({ path: '../../.env' });
dotenv.config();

/** CLI data source для typeorm migration:generate/run/revert (npm scripts у package.json). */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://vzhyk:vzhyk_dev_password@localhost:5432/vzhyk',
  entities: [User, OtpCode, Profile, Location, Category, CategoryAttribute, AppSetting],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
