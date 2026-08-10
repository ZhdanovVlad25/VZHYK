import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchProviderModule } from '../../providers/search/search.module';

@Module({
  imports: [SearchProviderModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
