import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useTemplateExerciseEditorViewModel } from '../viewmodels/template-editor';
import { useTheme } from '../viewmodels/theme';
import { ExerciseSummary } from './exercise-summary';
import { Button, Card, Copy, IconButton, Screen } from './ui';

export function TemplateExerciseEditorScreen() {
  const { draftId = '', exerciseId = '' } = useLocalSearchParams<{ draftId?: string; exerciseId?: string }>();
  const model = useTemplateExerciseEditorViewModel(draftId, exerciseId);
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  usePreventRemove(model.saving, () => {});
  const backToTemplate = () => router.dismissTo(draftId === 'new' ? '/templates/new' : {
    pathname: '/templates/[id]', params: { id: draftId },
  });
  if (!model.exercise) return <Screen>
    <Copy>This exercise draft is no longer available.</Copy>
    <Button label="Open templates" onPress={() => router.replace('/templates')} />
  </Screen>;
  return <>
    <Stack.Screen options={{ title: model.exercise.name, gestureEnabled: !model.saving, headerBackVisible: !model.saving }} />
    <Screen>
      <Copy kind="title">{model.exercise.name}</Copy>
      <ExerciseSummary exercise={model.exercise} />
      <Copy kind="heading">{model.exercise.sets.length} {model.exercise.sets.length === 1 ? 'set' : 'sets'}</Copy>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.setScroll}>
      <View style={styles.sets}>
        {model.exercise.sets.map((set, index) => <View key={index} style={styles.row}>
          <Copy>Set {index + 1}:</Copy>
          <TextInput
            accessibilityLabel={`Exercise ${model.exerciseNumber} set ${index + 1} reps`}
            placeholder="Reps" placeholderTextColor={colors.secondary}
            value={set.reps} onChangeText={(value) => model.changeSet(index, 'reps', value)}
            keyboardType="number-pad" editable={!model.saving} accessibilityState={{ disabled: model.saving }}
            style={[styles.input, { minWidth: 64 * fontScale, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          <Copy>×</Copy>
          <TextInput
            accessibilityLabel={`Exercise ${model.exerciseNumber} set ${index + 1} weight (lb)`}
            placeholder="Weight" placeholderTextColor={colors.secondary}
            value={set.weight} onChangeText={(value) => model.changeSet(index, 'weight', value)}
            keyboardType="decimal-pad" editable={!model.saving} accessibilityState={{ disabled: model.saving }}
            style={[styles.input, { minWidth: 64 * fontScale, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          <Copy kind="muted">lb</Copy>
          <IconButton label={`Remove exercise ${model.exerciseNumber} set ${index + 1}`} icon="close-outline"
            disabled={model.saving} onPress={() => model.removeSet(index)} />
        </View>)}
      </View>
      </ScrollView>
      {!model.exercise.sets.length ? <Card><Copy>Add a set before saving the template.</Copy></Card> : null}
      <Button label={`Add set to exercise ${model.exerciseNumber}`} disabled={model.saving} onPress={model.addSet} />
      <Button label="Done" disabled={model.saving} onPress={backToTemplate} />
    </Screen>
  </>;
}

const styles = StyleSheet.create({
  setScroll: { flexGrow: 1 },
  sets: { flexGrow: 1, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, fontSize: 16, textAlign: 'center' },
});
