import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, PanResponder, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../viewmodels/theme';
import { Button, Copy, useScreenScroll } from './ui';

interface Placement { readonly id: string; readonly name: string }
interface Drag { id: string; startY: number; pageY: number; listTop: number; offset: number; target: number }

// Keep the draft unchanged until drop, so cancellation never commits a partial move.
export function ReorderableExercises<T extends Placement>({ exercises, disabled, onMove, children }: {
  exercises: readonly T[]; disabled: boolean; onMove(id: string, target: number): void;
  children(exercise: T, index: number): ReactNode;
}) {
  const scroll = useScreenScroll();
  const root = useRef<ComponentRef<typeof View>>(null);
  const rows = useRef<Record<string, { y: number; height: number }>>({});
  const active = useRef<Drag | null>(null);
  const activation = useRef(0);
  const [preview, setPreview] = useState<{ id: string; target: number; translation: number } | null>(null);
  const { colors } = useTheme();
  const latest = useRef({ exercises, scroll, onMove });
  latest.current = { exercises, scroll, onMove };

  function updatePreview() {
    const drag = active.current;
    if (!drag) return;
    const { exercises: placements, scroll: viewport } = latest.current;
    const y = drag.pageY - drag.listTop + viewport.offset() - drag.offset;
    let target = 0;
    placements.forEach((exercise, index) => {
      const row = rows.current[exercise.id];
      if (row && y >= row.y + row.height / 2) target = index;
    });
    // A finger in the upper half of a row targets that row, not the previous one.
    const containing = placements.findIndex((exercise) => {
      const row = rows.current[exercise.id];
      return row && y >= row.y && y < row.y + row.height;
    });
    if (containing >= 0) target = containing;
    drag.target = target;
    setPreview({ id: drag.id, target, translation: drag.pageY - drag.startY + viewport.offset() - drag.offset });
  }
  function start(id: string, pageY: number) {
    Keyboard.dismiss();
    const token = ++activation.current;
    root.current?.measureInWindow((_x, top) => {
      const index = latest.current.exercises.findIndex((exercise) => exercise.id === id);
      if (index < 0 || token !== activation.current) return;
      active.current = { id, startY: pageY, pageY, listTop: top, offset: latest.current.scroll.offset(), target: index };
      latest.current.scroll.beginDrag();
      updatePreview();
    });
  }
  function move(pageY: number) {
    if (active.current) { active.current.pageY = pageY; updatePreview(); }
  }
  function finish(commit: boolean) {
    activation.current++;
    const drag = active.current;
    active.current = null;
    setPreview(null);
    latest.current.scroll.endDrag();
    if (commit && drag) {
      latest.current.onMove(drag.id, drag.target);
      AccessibilityInfo.announceForAccessibility(`Exercise moved to position ${drag.target + 1}.`);
    }
  }
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => {
      if (active.current) {
        latest.current.scroll.scrollAtEdge(active.current.pageY);
        updatePreview();
      }
    }, 16);
    return () => clearInterval(timer);
  }, [preview?.id]);
  useEffect(() => () => { if (active.current) latest.current.scroll.endDrag(); }, []);

  return <View ref={root} style={{ gap: 20 }}>
    {exercises.map((exercise, index) => <View key={exercise.id}
      onLayout={(event) => { rows.current[exercise.id] = event.nativeEvent.layout; }}
      style={{ zIndex: preview?.id === exercise.id ? 1 : 0,
        transform: [{ translateY: preview?.id === exercise.id ? preview.translation : 0 }],
        borderColor: preview?.target === index ? colors.accent : 'transparent', borderWidth: 2, borderRadius: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <DragHandle label={`Reorder exercise ${index + 1}`} disabled={disabled} onStart={(y) => start(exercise.id, y)} onMove={move} onFinish={finish} />
        <Copy>{preview?.id === exercise.id ? `Move to position ${preview.target + 1}` : `Exercise ${index + 1}`}</Copy>
      </View>
      {children(exercise, index)}
      <View style={{ gap: 8 }}>
        <Button label={`Move exercise ${index + 1} up`} disabled={disabled || index === 0 || !!preview} onPress={() => onMove(exercise.id, index - 1)} />
        <Button label={`Move exercise ${index + 1} down`} disabled={disabled || index === exercises.length - 1 || !!preview} onPress={() => onMove(exercise.id, index + 1)} />
      </View>
    </View>)}
  </View>;
}

function DragHandle({ label, disabled, onStart, onMove, onFinish }: {
  label: string; disabled: boolean; onStart(pageY: number): void; onMove(pageY: number): void; onFinish(commit: boolean): void;
}) {
  const { colors } = useTheme();
  const latest = useRef({ disabled, onStart, onMove, onFinish });
  latest.current = { disabled, onStart, onMove, onFinish };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: (event) => {
      const pageY = event.nativeEvent.pageY;
      timer.current = setTimeout(() => {
        held.current = true;
        latest.current.onStart(pageY);
      }, 450);
    },
    onPanResponderMove: (_event, gesture) => {
      if (held.current) latest.current.onMove(gesture.moveY);
      else if (Math.abs(gesture.dy) > 10 || Math.abs(gesture.dx) > 10) clear();
    },
    onPanResponderRelease: () => { clear(); if (held.current) latest.current.onFinish(true); held.current = false; },
    onPanResponderTerminate: () => { clear(); if (held.current) latest.current.onFinish(false); held.current = false; },
    onPanResponderTerminationRequest: () => !held.current,
  }));
  useEffect(() => clear, []);
  return <View {...responder.panHandlers} accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint="Long press and drag to reorder. Move up and Move down buttons are also available."
    accessibilityState={{ disabled }} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
    <Ionicons name="reorder-three-outline" size={32} color={colors.text} accessible={false} />
  </View>;
}
