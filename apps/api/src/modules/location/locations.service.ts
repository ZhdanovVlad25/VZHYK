import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity';

export interface RegionWithCities {
  id: string;
  nameUk: string;
  slug: string;
  cities: Location[];
}

/** Мінімальний зріз: лише міста для фільтра/вибору в оголошенні (region/district — поза цим зрізом, docs/api.md §7). */
@Injectable()
export class LocationsService {
  constructor(@InjectRepository(Location) private readonly locations: Repository<Location>) {}

  listCities(): Promise<Location[]> {
    return this.locations.find({ where: { level: 'city' }, order: { nameUk: 'ASC' } });
  }

  /** Області з вкладеними містами — двоступеневий вибір "Область → місто" у формі оголошення. */
  async listRegionsWithCities(): Promise<RegionWithCities[]> {
    const [regions, cities] = await Promise.all([
      this.locations.find({ where: { level: 'region' }, order: { nameUk: 'ASC' } }),
      this.locations.find({ where: { level: 'city' }, order: { nameUk: 'ASC' } }),
    ]);

    const citiesByRegion = new Map<string, Location[]>();
    for (const city of cities) {
      if (!city.parentId) continue;
      const list = citiesByRegion.get(city.parentId) ?? [];
      list.push(city);
      citiesByRegion.set(city.parentId, list);
    }

    return regions.map((region) => ({
      id: region.id,
      nameUk: region.nameUk,
      slug: region.slug,
      cities: citiesByRegion.get(region.id) ?? [],
    }));
  }
}
