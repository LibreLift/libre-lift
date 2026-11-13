import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ExerciseImages } from '../models/exercise';
import { useTheme } from '../viewmodels/theme';
import { Button, Copy } from './ui';

export function CatalogExerciseImages({ images, name }: { images?: ExerciseImages; name: string }) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, Math.min(window.width, 700) - 48));
  const [active, setActive] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const pages = images?.preferred === 'pair'
    ? [{ label: 'Start', uri: images.pair.start }, { label: 'Peak', uri: images.pair.peak }]
    : [{ label: 'Illustration', uri: images?.main }];

  function showPage(index: number) {
    setActive(index);
    scroll.current?.scrollTo({ x: index * width, animated: true });
  }

  return (
    <View style={styles.gallery} onLayout={({ nativeEvent }) => {
      if (nativeEvent.layout.width > 0) setWidth(nativeEvent.layout.width);
    }}>
      <ScrollView
        ref={scroll}
        accessibilityLabel="Exercise images"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        onContentSizeChange={() => scroll.current?.scrollTo({ x: active * width, animated: false })}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const pageWidth = nativeEvent.layoutMeasurement.width;
          if (pageWidth > 0) setActive(Math.max(0, Math.min(pages.length - 1, Math.round(nativeEvent.contentOffset.x / pageWidth))));
        }}
      >
        {pages.map((page, index) => (
          <View key={page.label} style={{ width }} accessibilityElementsHidden={index !== active} importantForAccessibility={index === active ? 'auto' : 'no-hide-descendants'}>
            <CatalogImage key={page.uri} uri={page.uri} name={name} label={page.label} />
          </View>
        ))}
      </ScrollView>
      <Copy>{pages[active].label} · {active + 1} of {pages.length}</Copy>
      {pages.length > 1 ? (
        <View style={styles.controls}>
          <View style={styles.control}><Button label="Previous image" disabled={active === 0} onPress={() => showPage(active - 1)} /></View>
          <View style={styles.control}><Button label="Next image" disabled={active === pages.length - 1} onPress={() => showPage(active + 1)} /></View>
        </View>
      ) : null}
    </View>
  );
}

function CatalogImage({ uri, name, label }: { uri: string | undefined; name: string; label: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>(uri ? 'loading' : 'failed');
  const { colors } = useTheme();
  return (
    <View style={[styles.image, { backgroundColor: colors.surface }]}>
      {status === 'failed' ? <Copy>Image unavailable</Copy> : (
        <Image
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${name} — ${label} image`}
          source={{ uri }}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
        />
      )}
      {status === 'loading' ? <ActivityIndicator accessibilityLabel={`Loading ${label} image`} color={colors.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { gap: 12 },
  controls: { flexDirection: 'row', gap: 12 },
  control: { flex: 1 },
  image: { width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
});
