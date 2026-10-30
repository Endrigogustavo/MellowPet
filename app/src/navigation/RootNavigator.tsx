import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { CoachOverlay } from '../components/CoachOverlay';
import { DockInsetProvider } from '../components/DockInset';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { TabBar } from '../components/TabBar';
import { COACH } from '../data/content';
import { AgendaScreen } from '../screens/AgendaScreen';
import { CareScreen } from '../screens/CareScreen';
import { CareDataScreen } from '../screens/CareDataScreen';
import { CareAlertsScreen } from '../screens/CareAlertsScreen';
import { CareAuditScreen } from '../screens/CareAuditScreen';
import { CarePlanScreen } from '../screens/CarePlanScreen';
import { CareGuideScreen } from '../screens/CareGuideScreen';
import { CareSignupScreen } from '../screens/CareSignupScreen';
import { CareToolsScreen } from '../screens/CareToolsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { CheckinScreen } from '../screens/CheckinScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FairnessScreen } from '../screens/FairnessScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { LullabyScreen } from '../screens/LullabyScreen';
import { WardrobeScreen } from '../screens/WardrobeScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { HeatmapScreen } from '../screens/HeatmapScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MusicScreen } from '../screens/MusicScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { PlaylistDetailScreen } from '../screens/PlaylistDetailScreen';
import { PlaylistEditorScreen } from '../screens/PlaylistEditorScreen';
import { RoutineScreen } from '../screens/RoutineScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { SpotifyImportScreen } from '../screens/SpotifyImportScreen';
import { SpotifyPlayerScreen } from '../screens/SpotifyPlayerScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { VisionScreen } from '../screens/VisionScreen';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { VisionEngine } from '../vision/VisionEngine';
import { CrisisPlanScreen } from '../screens/CrisisPlanScreen';
import { SosScreen } from '../screens/SosScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { CareMirrorScreen } from '../screens/CareMirrorScreen';
import { canAccess, homeFor, isTabRoot } from './navModel';
import { stepBackCareSignup } from './flowBack';

const SCREENS: Record<Screen, React.ComponentType> = {
  splash: SplashScreen,
  onboarding: OnboardingScreen,
  login: LoginScreen,
  caresignup: CareSignupScreen,
  home: HomeScreen,
  tools: ToolsScreen,
  routine: RoutineScreen,
  music: MusicScreen,
  playlisteditor: PlaylistEditorScreen,
  playlistdetail: PlaylistDetailScreen,
  spotifyimport: SpotifyImportScreen,
  spotifyplayer: SpotifyPlayerScreen,
  dashboard: DashboardEntry,
  checkin: CheckinScreen,
  heatmap: HeatmapScreen,
  friends: FriendsScreen,
  fairness: FairnessScreen,
  lullaby: LullabyScreen,
  sos: SosScreen,
  caremirror: CareMirrorScreen,
  groups: GroupsScreen,
  crisisplan: CrisisPlanScreen,
  wardrobe: WardrobeScreen,
  care: CareScreen,
  carealerts: CareAlertsScreen,
  careaudit: CareAuditScreen,
  careplan: CarePlanScreen,
  careguide: CareGuideScreen,
  agenda: AgendaScreen,
  caretools: CareToolsScreen,
  chat: ChatScreen,
  guide: GuideScreen,
  plans: PlansScreen,
  settings: SettingsScreen,
  vision: VisionScreen,
};

function DashboardEntry() {
  const { state } = useApp();
  return state.role === 'care' ? <CareDataScreen /> : <DashboardScreen />;
}

/** Telas em que a barra de abas fica escondida. */
const NO_TABS: Screen[] = ['splash', 'onboarding', 'chat', 'login', 'caresignup', 'vision', 'spotifyplayer'];

export function RootNavigator() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();

  const signedOut = !state.userId;
  const nav = { authed: !signedOut, role: state.role };
  const home = homeFor(state.role, !signedOut);
  // Guarda de rota por sessão e perfil: sem sessão só existem a abertura e o
  // login; com sessão, tela de outro perfil cai na inicial deste. O reducer
  // já barra a navegação; isto cobre o que escapar (troca de conta, estado
  // antigo).
  const screen: Screen = canAccess(state.screen, nav) ? state.screen : home;
  const showCoach = state.coach < COACH.length && screen === 'home';

  // Botão físico de voltar no Android. Sem sessão, na abertura ou na tela
  // inicial do perfil, sai do app (padrão do Android). Nas outras abas, vai
  // para a inicial. Nas demais telas, a anterior que o perfil pode abrir.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (signedOut || screen === 'splash') return false;
      // Tour aberto: o voltar fecha o tour, não a Home embaixo dele.
      if (showCoach) {
        actions.set({ coach: COACH.length });
        return true;
      }
      // Fluxos de entrada fazem o mesmo que o "Voltar" da própria tela.
      if (screen === 'onboarding') {
        if (state.onb === 0) return false;
        actions.set((s) => ({ onb: Math.max(0, s.onb - 1) }));
        return true;
      }
      if (screen === 'caresignup') {
        stepBackCareSignup(state.careStep, actions);
        return true;
      }
      if (screen === home) return false;
      if (isTabRoot(screen, state.role)) {
        actions.goTab(home);
        return true;
      }
      return actions.back();
    });
    return () => sub.remove();
  }, [screen, home, actions, signedOut, showCoach, state.onb, state.careStep, state.role]);

  const Current = SCREENS[screen];
  const showTabs = !NO_TABS.includes(screen) && !signedOut;
  const onSplash = screen === 'splash';

  // Troca de tela até aqui era um corte seco (componente inteiro trocado no
  // mesmo frame). O fade não reanima a tela em si, só suaviza a entrada.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [screen, fade]);

  return (
    <DockInsetProvider>
      <View style={{ flex: 1, backgroundColor: onSplash ? T.splashBg : T.bg }}>
        <StatusBar style={isDark || onSplash ? 'light' : 'dark'} />
        <VisionEngine />
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <Current />
        </Animated.View>
        {/* O mini-player leva ao player e à Música, telas só do usuário. */}
        {showTabs && state.role === 'user' ? <NowPlayingBar /> : null}
        {showTabs ? <TabBar /> : null}
        {showCoach ? <CoachOverlay /> : null}
      </View>
    </DockInsetProvider>
  );
}
