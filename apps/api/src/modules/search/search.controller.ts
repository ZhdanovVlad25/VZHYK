import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';

/** docs/api.md §7 Search — публічні read-endpoints. */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@Query() query: SearchQueryDto) {
    return this.search.search(query);
  }

  @Get('suggestions')
  suggestions(@Query() query: SuggestionsQueryDto) {
    return this.search.suggest(query.q);
  }
}
