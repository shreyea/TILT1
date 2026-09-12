// src/components/EmptyState.js
// Shared empty/error state. Empty screens are where an app either feels
// unfinished or feels considered — so each one says what happened, what to do
// next, and offers the action instead of leaving a dead end.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function EmptyState({ icon, title, body, actionLabel, onAction, compact = false }) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={[s.container, compact && s.compact]}>
      {!!icon && (
        <View style={s.iconRing}>
          <Ionicons name={icon} size={24} color={COLORS.textSecondary} />
        </View>
      )}
      <Text style={s.title}>{title}</Text>
      {!!body && <Text style={s.body}>{body}</Text>}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity onPress={onAction} style={s.action} activeOpacity={0.7}>
          <Text style={s.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 42,
    paddingBottom: 60,
  },
  compact: { flex: 0, paddingVertical: 52, paddingBottom: 52 },
  // A ring rather than a filled tile — keeps the boxless language.
  iconRing: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.textPrimary, fontSize: 17, fontWeight: '700',
    textAlign: 'center', letterSpacing: -0.2,
  },
  body: {
    color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 20,
    textAlign: 'center', marginTop: 9,
  },
  action: { marginTop: 20, paddingVertical: 9, paddingHorizontal: 20 },
  actionText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
