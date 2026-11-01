// src/components/ListeningModal.js
// The pop-up behind the hourglass button: a running hourglass and, underneath,
// how long you've spent listening — ticking up live while music plays.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import Hourglass from './Hourglass';

const pad = (n) => String(n).padStart(2, '0');

function clock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function words(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'less than a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function ListeningModal({ visible, onClose }) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);
  const { getListening, isPlaying } = usePlayer();
  const [t, setT] = useState({ total: 0, today: 0 });

  useEffect(() => {
    if (!visible) return;
    setT(getListening());
    const id = setInterval(() => setT(getListening()), 250);
    return () => clearInterval(id);
  }, [visible, getListening]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.content}>
          <Text style={s.kicker}>Listening time</Text>

          {visible && <Hourglass width={150} sand={COLORS.primary} glass={COLORS.textPrimary} />}

          <Text style={s.clock}>{clock(t.today)}</Text>
          <View style={s.liveRow}>
            <View style={[s.liveDot, isPlaying && { backgroundColor: COLORS.primary }]} />
            <Text style={s.liveText}>{isPlaying ? 'Counting now · today' : 'Today · paused'}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>All time</Text>
            <Text style={s.totalValue}>{words(t.total)}</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(2,8,10,0.88)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
  kicker: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 28,
  },
  clock: {
    color: COLORS.textPrimary, fontSize: 44, fontWeight: '200',
    letterSpacing: 2, marginTop: 28, fontVariant: ['tabular-nums'],
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted },
  liveText: { color: COLORS.textSecondary, fontSize: 12.5, letterSpacing: 0.3 },
  divider: { width: 40, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginVertical: 26 },
  totalRow: { alignItems: 'center', gap: 4 },
  totalLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  totalValue: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
  closeBtn: { marginTop: 34, padding: 8 },
});
