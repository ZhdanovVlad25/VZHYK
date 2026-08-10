import { Module } from '@nestjs/common';
import { PostgresFtsSearchProvider } from './postgres-fts-search.provider';
import { SEARCH_PROVIDER } from './search-provider.interface';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [{ provide: SEARCH_PROVIDER, useClass: PostgresFtsSearchProvider }],
  exports: [SEARCH_PROVIDER],
})
export class SearchProviderModule {}
