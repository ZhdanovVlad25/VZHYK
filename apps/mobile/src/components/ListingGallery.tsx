import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Media } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ListingGalleryProps = {
  media: Media[];
};

/** Свайп-галерея з крапками-індикатором + повноекранний перегляд по тапу — RN-порт ListingGallery.tsx. */
export function ListingGallery({ media }: ListingGalleryProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const listRef = useRef<FlatList<Media>>(null);
  const zoomListRef = useRef<FlatList<Media>>(null);

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
        renderItem={({ item }) => (
          <Pressable style={styles.imageBox} onPress={() => setIsZoomed(true)}>
            <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
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
            renderItem={({ item }) => (
              <View style={styles.zoomImageBox}>
                <Image source={{ uri: item.url }} style={styles.zoomImage} resizeMode="contain" />
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
    aspectRatio: 1,
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
