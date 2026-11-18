import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../viewmodels/theme';
import { Copy, IconButton } from './ui';

interface SetTargets { readonly reps: string; readonly weight: string }
interface SetEditor {
  readonly exerciseNumber: number;
  readonly disabled: boolean;
  changeSet(index: number, field: 'reps' | 'weight', value: string): void;
  removeSet(index: number): void;
}

// Saved targets and draft inputs use the same compact row and overflow behavior.
export function TemplateSetRows({ sets, editor }: { sets: readonly SetTargets[]; editor?: SetEditor }) {
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const valueStyle = [styles.value, { minWidth: 64 * fontScale, borderColor: colors.border, backgroundColor: colors.surface }];
  return <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
    <View style={styles.sets}>
      {sets.map((set, index) => <View key={index} style={styles.row}
        accessible={!editor} accessibilityLabel={editor ? undefined : `Set ${index + 1}: ${set.reps} reps × ${set.weight} lb`}>
        <Copy>Set {index + 1}:</Copy>
        {editor ? <TextInput
          accessibilityLabel={`Exercise ${editor.exerciseNumber} set ${index + 1} reps`}
          placeholder="Reps" placeholderTextColor={colors.secondary}
          value={set.reps} onChangeText={(value) => editor.changeSet(index, 'reps', value)}
          keyboardType="number-pad" editable={!editor.disabled} accessibilityState={{ disabled: editor.disabled }}
          style={[valueStyle, styles.input, { color: colors.text }]}
        /> : <View style={[styles.savedValue, valueStyle]}><Copy>{set.reps}</Copy></View>}
        <Copy>×</Copy>
        {editor ? <TextInput
          accessibilityLabel={`Exercise ${editor.exerciseNumber} set ${index + 1} weight (lb)`}
          placeholder="Weight" placeholderTextColor={colors.secondary}
          value={set.weight} onChangeText={(value) => editor.changeSet(index, 'weight', value)}
          keyboardType="decimal-pad" editable={!editor.disabled} accessibilityState={{ disabled: editor.disabled }}
          style={[valueStyle, styles.input, { color: colors.text }]}
        /> : <View style={[styles.savedValue, valueStyle]}><Copy>{set.weight}</Copy></View>}
        <Copy kind="muted">lb</Copy>
        {editor ? <IconButton label={`Remove exercise ${editor.exerciseNumber} set ${index + 1}`} icon="close-outline"
          disabled={editor.disabled} onPress={() => editor.removeSet(index)} /> : null}
      </View>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  sets: { flexGrow: 1, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8 },
  input: { fontSize: 16, textAlign: 'center' },
  savedValue: { alignItems: 'center', justifyContent: 'center' },
});
