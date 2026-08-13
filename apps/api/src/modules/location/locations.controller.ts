import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('cities')
  cities() {
    return this.locations.listCities();
  }
}
