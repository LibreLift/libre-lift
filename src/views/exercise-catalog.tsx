import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExerciseCatalogViewModel, type CatalogExerciseSummary } from '../viewmodels/exercise-catalog';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy } from './ui';

export function ExerciseCatalogScreen() {
  const { state, query, setQuery, groups, selectedGroup, setSelectedGroup } = useExerciseCatalogViewModel();
  const [filterOpen, setFilterOpen] = useState(false);
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={state.status === 'ready' ? state.exercises : []}
        keyExtractor={(item) => item.exercise.catalogId}
        renderItem={({ item }) => <CatalogExerciseCard item={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ExerciseSeparator}
        ListEmptyComponent={state.status === 'ready' ? (
          <Card>
            <Copy>No matching exercises</Copy>
            <Button label="Clear search and filter" onPress={() => { setQuery(''); setSelectedGroup(null); setFilterOpen(false); }} />
          </Card>
        ) : undefined}
        ListHeaderComponent={
          <View style={styles.header}>
            <Copy kind="title">Exercise catalog</Copy>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://repdb.co')} style={styles.credit}>
              <Text style={{ color: colors.text, fontSize: 15, textDecorationLine: 'underline' }}>Exercise data by RepDB</Text>
            </Pressable>
            {state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading exercise catalog" color={colors.text} /> : null}
            {state.status === 'failure' ? (
              <Card>
                <Copy>We couldn’t load the exercise catalog.</Copy>
                <Button label="Back" onPress={() => router.back()} />
              </Card>
            ) : null}
            {state.status === 'ready' && state.rejectedRecords > 0 ? <Copy kind="muted">Some exercises couldn’t be loaded</Copy> : null}
            {state.status === 'ready' ? (
              <>
              <TextInput
                accessibilityRole="search"
                accessibilityLabel="Search exercises"
                placeholder="Search exercises"
                placeholderTextColor={colors.secondary}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                style={[styles.search, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Muscle group: ${selectedGroup ?? 'All muscles'}`}
                accessibilityState={{ expanded: filterOpen }}
                onPress={() => setFilterOpen((open) => !open)}
                style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Copy>Muscle group: {selectedGroup ?? 'All muscles'} {filterOpen ? '▴' : '▾'}</Copy>
              </Pressable>
              {filterOpen ? (
                <View style={styles.groups}>
                  {[null, ...groups].map((group) => (
                    <Pressable
                      key={group ?? 'all'}
                      accessibilityRole="button"
                      accessibilityLabel={group ?? 'All muscles'}
                      accessibilityState={{ selected: selectedGroup === group }}
                      onPress={() => { setSelectedGroup(group); setFilterOpen(false); }}
                      style={[styles.group, {
                        borderColor: colors.border,
                        backgroundColor: selectedGroup === group ? colors.selected : colors.surface,
                      }]}
                    >
                      <Text style={{ color: selectedGroup === group ? colors.onSelected : colors.text, fontSize: 16 }}>
                        {group ?? 'All muscles'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              </>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function CatalogExerciseCard({ item }: { item: CatalogExerciseSummary }) {
  return (
    <Card>
      <Copy kind="heading">{item.exercise.name}</Copy>
      <Copy kind="muted">Primary muscles: {item.primaryGroups.length ? item.primaryGroups.join(' · ') : 'Not specified'}</Copy>
      {item.secondaryGroups.length ? <Copy kind="muted">Secondary muscles: {item.secondaryGroups.join(' · ')}</Copy> : null}
      <Copy kind="muted">Equipment: {item.equipment}</Copy>
    </Card>
  );
}

function ExerciseSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { padding: 24, paddingBottom: 32, maxWidth: 700, width: '100%', alignSelf: 'center' },
  header: { gap: 20, paddingBottom: 20 },
  credit: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  separator: { height: 20 },
  search: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, justifyContent: 'center' },
});
