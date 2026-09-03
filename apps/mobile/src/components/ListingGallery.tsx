import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import type { Media } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ListingGalleryProps = {
  media: Media[];
  /** Для accessibilityLabel на фото — "{title} — фото {n} з {total}" (аудит 27.08, той самий фікс, що на вебі). */
  title?: string;
};

/** Свайп-галерея з крапками-індикатором + повноекранний перегляд по тапу — RN-порт ListingGallery.tsx. */
export function ListingGallery({ media, title }: ListingGalleryProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const listRef = useRef<FlatList<Media>>(null);
  const zoomListRef = useRef<FlatList<Media>>(null);

  // Свайп у повноекранному перегляді був помітно повільним — кожне фото довантажувалось
  // заново замість використання диск/пам'ять-кешу. Прогріваємо кеш одразу всіма фото
  // оголошення (їх зазвичай небагато), а не лише тим, що зараз у в'юпорті.
  useEffect(() => {
    Image.prefetch(media.map((m) => m.url)).catch(() => {});
  }, [media]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }

  if (media.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.noPhotoText}>Без фото</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={media}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.id}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index }) => (
          <Pressable style={styles.imageBox} onPress={() => setIsZoomed(true)}>
            <Image
              source={{ uri: item.url }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessible
              accessibilityLabel={title ? `${title} — фото ${index + 1} з ${media.length}` : `Фото ${index + 1} з ${media.length}`}
            />
          </Pressable>
        )}
      />
      {media.length > 1 && (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {activeIndex + 1}/{media.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {media.map((m, i) => (
              <View key={m.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>
        </>
      )}

      <Modal visible={isZoomed} animationType="fade" transparent onRequestClose={() => setIsZoomed(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.closeButton} onPress={() => setIsZoomed(false)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <FlatList
            ref={zoomListRef}
            data={media}
            horizontal
            pagingEnabled
            initialScrollIndex={activeIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m) => m.id}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item, index }) => (
              <View style={styles.zoomImageBox}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.zoomImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessible
                  accessibilityLabel={title ? `${title} — фото ${index + 1} з ${media.length}` : `Фото ${index + 1} з ${media.length}`}
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  imageBox: {
    width: SCREEN_WIDTH,
    // 1:1 на всю ширину екрана займав майже половину видимого простору на відкритті картки
    // (виміряно на веб-версії тієї ж галереї — 44% висоти viewport). 4:3 (0.75) все одно
    // сприймався користувачем як завеликий на живому сайті — 16:9 (0.5625) нижче.
    aspectRatio: 16 / 9,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Без фото — повноекранний квадрат-плейсхолдер лишає величезну порожню сіру зону,
  // тому тут суттєво нижче: просто позначка "нема фото", а не імітація розміру галереї.
  emptyBox: {
    width: '100%',
    height: 140,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  noPhotoText: { color: colors.textMuted, fontSize: 14 },
  counter: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: { color: colors.buttonText, fontSize: 12 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand[600] },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: colors.buttonText, fontSize: 20 },
  zoomImageBox: { width: SCREEN_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: SCREEN_WIDTH, height: '100%' },
  });
}
