import type { NavigatorScreenParams, NavigationProp } from '@react-navigation/native';

export type SearchParams = {
  q?: string;
  category?: string;
  categoryName?: string;
  seller?: string;
};

export type TabParamList = {
  Home: undefined;
  Search: SearchParams | undefined;
  Add: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  ListingDetail: { listingId: string };
  MyListings: undefined;
  EditListing: { listingId: string };
  Favorites: undefined;
  SavedSearches: undefined;
  ChatThread: { chatId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

/**
 * navigate() у React Navigation "спливає" до найближчого навігатора, що має екран з такою
 * назвою (Tabs → root Stack), тож з екрана всередині табів можна напряму викликати і сусідній
 * таб (Search), і кореневий стек (ListingDetail). Об'єднаний тип покриває обидва без
 * складної CompositeNavigationProp-типізації для кожного екрана окремо.
 */
export type AppNavigation = NavigationProp<RootStackParamList & TabParamList>;
