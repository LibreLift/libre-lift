import { useRef, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { useDisplayName } from '../viewmodels/display-name';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy, FormError, Screen } from './ui';

export function OnboardingScreen() {
  const [showNotice, setShowNotice] = useState(true);
  const dismissNotice = () => setShowNotice(false);

  return (
    <Screen>
      <Copy kind="title">Make it yours</Copy>
      <DisplayNameForm initialName="" />
      {showNotice ? (
        <Modal transparent animationType="fade" onRequestClose={dismissNotice}>
          <View accessibilityViewIsModal style={styles.noticeBackdrop}>
            <View style={styles.notice}>
              <Card>
                <Copy kind="heading">Local storage</Copy>
                <Copy>Training data is stored on this device. Backup is unavailable.</Copy>
                <Button label="Got it" onPress={dismissNotice} />
              </Card>
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  notice: {
    width: '100%',
    maxWidth: 420,
  },
});

export function DisplayNameForm({ initialName, onDone }: { initialName: string; onDone?: () => void }) {
  const { colors } = useTheme();
  const { saveDisplayName } = useDisplayName();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  async function save() {
    if (pending.current) return;
    const displayName = name.trim();
    if (!displayName) {
      setError('Enter a display name.');
      return;
    }

    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await saveDisplayName(displayName);
      onDone?.();
    } catch {
      setError('Your display name couldn’t be saved. Please try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <>
    <Copy>Display name</Copy>
    <TextInput
      accessibilityLabel="Display name"
      accessibilityState={{ disabled: saving }}
      autoCapitalize="words"
      autoComplete="name"
      autoCorrect={false}
      value={name}
      onChangeText={setName}
      editable={!saving}
      style={{
        borderWidth: 1, borderColor: colors.border, color: colors.text,
        backgroundColor: colors.background, borderRadius: 12, padding: 16, minHeight: 52, fontSize: 18,
      }}
    />
    <FormError message={error} />
    <Button label={saving ? 'Saving…' : onDone ? 'Save name' : 'Continue'} disabled={saving} onPress={() => void save()} />
    {onDone ? <Button label="Cancel" disabled={saving} onPress={onDone} /> : null}
  </>;
}
