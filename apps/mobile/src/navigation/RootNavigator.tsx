import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { AddListingScreen } from '../screens/AddListingScreen';
import { ChatThreadScreen } from '../screens/ChatThreadScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { EditListingScreen } from '../screens/EditListingScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ListingDetailScreen } from '../screens/ListingDetailScreen';
import { MyListingsScreen } from '../screens/MyListingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SavedSearchesScreen } from '../screens/SavedSearchesScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { useLanguage } from '../lib/language-context';
import { useTheme } from '../lib/theme-context';
import type { RootStackParamList, TabParamList } from './types';
import type { TranslationKey } from '../lib/i18n';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Search: 'search-outline',
  Add: 'add-circle-outline',
  Chats: 'chatbubbles-outline',
  Profile: 'person-outline',
};

const TAB_LABEL_KEYS: Record<keyof TabParamList, TranslationKey> = {
  Home: 'navHome',
  Search: 'navSearch',
  Add: 'navAdd',
  Chats: 'navChats',
  Profile: 'navProfile',
};

function TabNavigator() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabel: t(TAB_LABEL_KEYS[route.name]),
        tabBarIcon: ({ color, size, focused }) => (
          <View style={[styles.iconWrap, focused && { backgroundColor: colors.brand[100] }]}>
            <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Add" component={AddListingScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.brand[700] }}>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Оголошення' }} />
      <Stack.Screen name="MyListings" component={MyListingsScreen} options={{ title: 'Мої оголошення' }} />
      <Stack.Screen name="EditListing" component={EditListingScreen} options={{ title: 'Редагування' }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Обране' }} />
      <Stack.Screen name="SavedSearches" component={SavedSearchesScreen} options={{ title: 'Збережені пошуки' }} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Чат' }} />
    </Stack.Navigator>
  );
}
