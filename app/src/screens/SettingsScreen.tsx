import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../hooks/useStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

const PET_TYPES = [
  { id: 'dog', icon: 'dog-side', label: 'Cachorro' },
  { id: 'cat', icon: 'cat', label: 'Gatinho' },
  { id: 'bunny', icon: 'rabbit', label: 'Coelho' },
  { id: 'bear', icon: 'teddy-bear', label: 'Urso' },
  { id: 'fox', icon: 'paw', label: 'Raposa' },
  { id: 'panda', icon: 'yin-yang', label: 'Panda' },
  { id: 'owl', icon: 'bird', label: 'Coruja' },
  { id: 'seal', icon: 'seal', label: 'Foca' },
  { id: 'hamster', icon: 'rodent', label: 'Hamster' },
  { id: 'penguin', icon: 'penguin', label: 'Pinguim' },
  { id: 'capybara', icon: 'rodent', label: 'Capivara' },
  { id: 'unicorn', icon: 'unicorn-variant', label: 'Unicórnio' },
] as const;

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settings, updateSettings, resetSession } = useAppStore();
  const [petName, setPetName] = useState(settings.petName);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const saveSettings = () => {
    updateSettings({ petName: petName.trim() || 'Mellow' });
    Alert.alert('Configurações', 'Configurações salvas!');
  };

  const addContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) {
      Alert.alert('Preencha nome e email do contato.');
      return;
    }
    updateSettings({
      emergencyContacts: [
        ...settings.emergencyContacts,
        { name: newContactName.trim(), email: newContactEmail.trim(), phone: '' },
      ],
    });
    setNewContactName('');
    setNewContactEmail('');
  };

  const removeContact = (index: number) => {
    const updated = settings.emergencyContacts.filter((_, i) => i !== index);
    updateSettings({ emergencyContacts: updated });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Configurações</Text>
        <TouchableOpacity onPress={saveSettings} style={styles.saveBtn}>
          <Text style={styles.saveText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Pet Customization */}
        <Text style={styles.sectionTitle}>Seu Pet</Text>
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.fieldLabel}>Nome do pet</Text>
          <TextInput
            style={styles.input}
            value={petName}
            onChangeText={setPetName}
            placeholder="Ex: Mellow, Fofão..."
            maxLength={24}
          />
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Tipo de pet</Text>
          <View style={styles.petGrid}>
            {PET_TYPES.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.petChip,
                  settings.petType === p.id && styles.petChipActive,
                ]}
                onPress={() => updateSettings({ petType: p.id })}
              >
                <MaterialCommunityIcons name={p.icon as any} size={28} color={Colors.textPrimary} />
                <Text style={[
                  styles.petLabel,
                  settings.petType === p.id && { color: Colors.primary },
                ]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggles */}
        <Text style={styles.sectionTitle}>Funcionalidades</Text>
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.toggleRow}>
            <View>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="music-note-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Músicas de apoio</Text>
              </View>
              <Text style={styles.toggleSub}>Sugerir músicas conforme sua emoção</Text>
            </View>
            <Switch
              value={settings.musicEnabled}
              onValueChange={(v) => updateSettings({ musicEnabled: v })}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="alert-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Alertas de emoção</Text>
              </View>
              <Text style={styles.toggleSub}>Notificar contatos de emergência</Text>
            </View>
            <Switch
              value={settings.alertsEnabled}
              onValueChange={(v) => updateSettings({ alertsEnabled: v })}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="account-voice" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Assistente por voz</Text>
              </View>
              <Text style={styles.toggleSub}>Falar com voce com base na emocao detectada</Text>
            </View>
            <Switch
              value={settings.voiceAssistantEnabled}
              onValueChange={(v) => updateSettings({ voiceAssistantEnabled: v })}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="bell-ring-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Notificacao no celular</Text>
              </View>
              <Text style={styles.toggleSub}>Enviar aviso local quando ficar mal por muito tempo</Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>

          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="vibrate" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Vibracao de alerta</Text>
              </View>
              <Text style={styles.toggleSub}>Vibrar quando detectar fase emocional critica</Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={(v) => updateSettings({ hapticsEnabled: v })}
              trackColor={{ true: Colors.primary, false: Colors.border }}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View style={{ flex: 1, marginRight: Spacing.base }}>
              <View style={styles.toggleLabelRow}>
                <MaterialCommunityIcons name="timer-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.toggleLabel}>Alerta sem rosto</Text>
              </View>
              <Text style={styles.toggleSub}>
                Alertar após {settings.noFaceAlertMinutes} min sem detecção
              </Text>
            </View>
            <View style={styles.minuteSelector}>
              {[5, 10, 15, 20].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.minuteBtn,
                    settings.noFaceAlertMinutes === m && styles.minuteBtnActive,
                  ]}
                  onPress={() => updateSettings({ noFaceAlertMinutes: m })}
                >
                  <Text style={[
                    styles.minuteText,
                    settings.noFaceAlertMinutes === m && { color: Colors.primary },
                  ]}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Emergency Contacts */}
        <Text style={styles.sectionTitle}>Contatos de Emergência</Text>
        <View style={[styles.card, Shadow.sm]}>
          {settings.emergencyContacts.length === 0 && (
            <Text style={styles.emptyContacts}>Nenhum contato cadastrado ainda.</Text>
          )}
          {settings.emergencyContacts.map((c, i) => (
            <View key={i} style={[styles.contactRow, i > 0 && styles.toggleRowBorder]}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{c.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactEmail}>{c.email}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(i)}>
                <Ionicons name="close" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addContactForm}>
            <TextInput
              style={styles.input}
              value={newContactName}
              onChangeText={setNewContactName}
              placeholder="Nome do contato"
            />
            <TextInput
              style={[styles.input, { marginTop: Spacing.sm }]}
              value={newContactEmail}
              onChangeText={setNewContactEmail}
              placeholder="E-mail do contato"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addContact}>
              <Text style={styles.addBtnText}>+ Adicionar contato</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger zone */}
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            Alert.alert('Reiniciar sessão?', 'O histórico local será limpo.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Reiniciar', onPress: resetSession, style: 'destructive' },
            ]);
          }}
        >
          <View style={styles.resetRow}>
            <Ionicons name="refresh" size={16} color={Colors.error} />
            <Text style={styles.resetText}>Reiniciar sessão</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  saveBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
  },
  saveText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.primary },
  scroll: { padding: Spacing.xl, paddingBottom: 60, gap: Spacing.sm },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 4, marginTop: Spacing.md,
  },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl },
  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary,
  },
  petGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  petChip: {
    width: '30%', alignItems: 'center', padding: Spacing.sm,
    borderRadius: Radius.lg, backgroundColor: Colors.background,
  },
  petChipActive: { backgroundColor: Colors.primaryLight },
  petLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.sm, paddingTop: Spacing.md },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  toggleSub: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  minuteSelector: { flexDirection: 'row', gap: 4 },
  minuteBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm, backgroundColor: Colors.background,
  },
  minuteBtnActive: { backgroundColor: Colors.primaryLight },
  minuteText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },
  contactName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  contactEmail: { fontSize: Typography.xs, color: Colors.textTertiary },
  emptyContacts: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.md },
  addContactForm: { marginTop: Spacing.md, gap: 0 },
  addBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.primaryLight,
    padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center',
  },
  addBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.primary },
  resetBtn: {
    marginTop: Spacing.xl, padding: Spacing.base,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.error + '40',
    alignItems: 'center',
  },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetText: { fontSize: Typography.base, color: Colors.error },
});
