import type { ImageProps } from 'expo-image';
import { repDbAssets } from './repdb-assets.generated';

export function exerciseImageSource(reference: string | undefined): ImageProps['source'] {
  if (!reference) return;
  // The provider's existing URL doubles as the stable image reference in snapshots.
  const path = /^https?:\/\/exercise-dataset\.com\/(images\/flat\/[^/?#]+\.webp)$/.exec(reference)?.[1];
  const asset = path ? repDbAssets.get(path) : undefined;
  return asset ? asset() : { uri: reference };
}
