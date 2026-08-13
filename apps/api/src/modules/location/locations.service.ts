import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity';

/** Мінімальний зріз: лише міста для фільтра/вибору в оголошенні (region/district — поза цим зрізом, docs/api.md §7). */
@Injectable()
export class LocationsService {
  constructor(@InjectRepository(Location) private readonly locations: Repository<Location>) {}

  listCities(): Promise<Location[]> {
    return this.locations.find({ where: { level: 'city' }, order: { nameUk: 'ASC' } });
  }
}
