import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Камера/галерея з нативним чузером — Alert.alert з кількома кнопками не має web-реалізації
 * в react-native, тож на web-прев'ю одразу відкриваємо галерею (звичайний file picker).
 * На Android/iOS показуємо вибір, як і очікується.
 */
export function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  if (Platform.OS === 'web') {
    return pickFromLibrary();
  }
  return new Promise((resolve) => {
    Alert.alert('Додати фото', undefined, [
      { text: 'Камера', onPress: () => pickFromCamera().then(resolve) },
      { text: 'Галерея', onPress: () => pickFromLibrary().then(resolve) },
      { text: 'Скасувати', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

async function pickFromLibrary(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Немає дозволу на доступ до галереї.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
  return result.canceled ? null : (result.assets[0] ?? null);
}

/**
 * Кілька фото за один вибір (для оголошень — на відміну від аватарки, де завжди одне фото).
 * Камера принципово дає по одному кадру за раз, тож там повертаємо масив з 0 або 1 елемента.
 */
export function pickPhotos(): Promise<ImagePicker.ImagePickerAsset[]> {
  if (Platform.OS === 'web') {
    return pickMultipleFromLibrary();
  }
  return new Promise((resolve) => {
    Alert.alert('Додати фото', undefined, [
      { text: 'Камера', onPress: () => pickFromCamera().then((asset) => resolve(asset ? [asset] : [])) },
      { text: 'Галерея', onPress: () => pickMultipleFromLibrary().then(resolve) },
      { text: 'Скасувати', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}

async function pickMultipleFromLibrary(): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Немає дозволу на доступ до галереї.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.8,
    allowsMultipleSelection: true,
  });
  return result.canceled ? [] : result.assets;
}

async function pickFromCamera(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Немає дозволу на доступ до камери.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
  return result.canceled ? null : (result.assets[0] ?? null);
}

export function assetToRNFile(asset: ImagePicker.ImagePickerAsset) {
  return { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' };
}
