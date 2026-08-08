import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, G, Rect,
} from 'react-native-svg';
import { EMOTION_COLORS } from '../theme';

interface VirtualPetProps {
  emotion: string;
  petType?: 'dog' | 'cat' | 'bunny' | 'bear' | 'fox' | 'panda' | 'owl' | 'seal' | 'hamster' | 'penguin' | 'capybara' | 'unicorn';
  size?: number;
  animate?: boolean;
  faceDetected?: boolean;
}

// ── Animation values per emotion ─────────────────────────────────────────────
const EMOTION_ANIMATIONS: Record<string, {
  bounce: number;
  shake: boolean;
  pulse: boolean;
  float: boolean;
  tilt: boolean;
  aura: boolean;
}> = {
  happy:     { bounce: 1, shake: false, pulse: false, float: true,  tilt: true,  aura: true },
  sad:       { bounce: 0, shake: false, pulse: true,  float: false, tilt: false, aura: true },
  angry:     { bounce: 0, shake: true,  pulse: false, float: false, tilt: false, aura: false },
  anxious:   { bounce: 0, shake: false, pulse: true,  float: false, tilt: true,  aura: true },
  neutral:   { bounce: 0, shake: false, pulse: false, float: true,  tilt: false, aura: false },
  surprised: { bounce: 1, shake: false, pulse: false, float: false, tilt: true,  aura: true },
  disgusted: { bounce: 0, shake: false, pulse: false, float: false, tilt: false, aura: false },
  fearful:   { bounce: 0, shake: true,  pulse: true,  float: false, tilt: true,  aura: true },
  waiting:   { bounce: 0, shake: false, pulse: true,  float: true,  tilt: true,  aura: false },
};

// ── Pet face renderer ─────────────────────────────────────────────────────────
function DogFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || EMOTION_COLORS.neutral.bg;

  // Eyes
  const eyeY = cy - r * 0.15;
  const eyeXL = cx - r * 0.35;
  const eyeXR = cx + r * 0.35;

  // Mouth shapes per emotion
  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.3;
    const mw = r * 0.5;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - mw} ${my} Q${mx} ${my + mw * 0.8} ${mx + mw} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - mw} ${my + mw * 0.4} Q${mx} ${my - mw * 0.4} ${mx + mw} ${my + mw * 0.4}`}
                     stroke="#5D4037" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - mw * 0.8} ${my} L${mx + mw * 0.8} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my + r * 0.05} rx={mw * 0.4} ry={mw * 0.5}
                        fill="#5D4037" opacity={0.7} />;
      case 'anxious':
        return <Path d={`M${mx - mw} ${my} Q${mx - mw * 0.3} ${my + mw * 0.3} ${mx} ${my} Q${mx + mw * 0.3} ${my - mw * 0.3} ${mx + mw} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      default:
        return <Path d={`M${mx - mw * 0.6} ${my} Q${mx} ${my + mw * 0.2} ${mx + mw * 0.6} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
    }
  };

  const getEyes = () => {
    if (emotion === 'happy') {
      // Happy eyes = curved
      return (
        <G>
          <Path d={`M${eyeXL - r * 0.12} ${eyeY} Q${eyeXL} ${eyeY - r * 0.15} ${eyeXL + r * 0.12} ${eyeY}`}
                stroke="#5D4037" strokeWidth={s * 0.03} fill="none" strokeLinecap="round" />
          <Path d={`M${eyeXR - r * 0.12} ${eyeY} Q${eyeXR} ${eyeY - r * 0.15} ${eyeXR + r * 0.12} ${eyeY}`}
                stroke="#5D4037" strokeWidth={s * 0.03} fill="none" strokeLinecap="round" />
        </G>
      );
    }
    if (emotion === 'sad') {
      return (
        <G>
          <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="#5D4037" />
          <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="#5D4037" />
          {/* Tear drops */}
          <Ellipse cx={eyeXL + r * 0.04} cy={eyeY + r * 0.2} rx={r * 0.05} ry={r * 0.12}
                   fill="#74B9FF" opacity={0.8} />
        </G>
      );
    }
    if (emotion === 'surprised') {
      return (
        <G>
          <Circle cx={eyeXL} cy={eyeY} r={r * 0.17} fill="white" />
          <Circle cx={eyeXL} cy={eyeY} r={r * 0.1} fill="#5D4037" />
          <Circle cx={eyeXR} cy={eyeY} r={r * 0.17} fill="white" />
          <Circle cx={eyeXR} cy={eyeY} r={r * 0.1} fill="#5D4037" />
        </G>
      );
    }
    return (
      <G>
        <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill="#5D4037" />
        <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.04} fill="white" />
        <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill="#5D4037" />
        <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.04} fill="white" />
      </G>
    );
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Ears */}
      <Ellipse cx={cx - r * 0.65} cy={cy - r * 0.75} rx={r * 0.28} ry={r * 0.38}
               fill={color} opacity={0.85} />
      <Ellipse cx={cx + r * 0.65} cy={cy - r * 0.75} rx={r * 0.28} ry={r * 0.38}
               fill={color} opacity={0.85} />

      {/* Head */}
      <Circle cx={cx} cy={cy} r={r} fill={color} />

      {/* Inner ears */}
      <Ellipse cx={cx - r * 0.65} cy={cy - r * 0.75} rx={r * 0.16} ry={r * 0.24}
               fill="#FFCCBC" opacity={0.7} />
      <Ellipse cx={cx + r * 0.65} cy={cy - r * 0.75} rx={r * 0.16} ry={r * 0.24}
               fill="#FFCCBC" opacity={0.7} />

      {/* Snout */}
      <Ellipse cx={cx} cy={cy + r * 0.18} rx={r * 0.35} ry={r * 0.25}
               fill="#FFCCBC" opacity={0.8} />

      {/* Nose */}
      <Ellipse cx={cx} cy={cy + r * 0.05} rx={r * 0.12} ry={r * 0.08}
               fill="#5D4037" />
      <Circle cx={cx - r * 0.04} cy={cy + r * 0.02} r={r * 0.03} fill="white" opacity={0.6} />

      {/* Eyes */}
      {getEyes()}

      {/* Blush */}
      {emotion === 'happy' && (
        <G>
          <Ellipse cx={cx - r * 0.55} cy={cy + r * 0.12} rx={r * 0.18} ry={r * 0.1}
                   fill="#FFB3BA" opacity={0.5} />
          <Ellipse cx={cx + r * 0.55} cy={cy + r * 0.12} rx={r * 0.18} ry={r * 0.1}
                   fill="#FFB3BA" opacity={0.5} />
        </G>
      )}

      {/* Mouth */}
      {getMouth()}
    </Svg>
  );
}

function CatFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || EMOTION_COLORS.neutral.bg;
  const dark = '#5D4037';

  const getEyes = () => {
    const eyeY = cy - r * 0.15;
    const eyeXL = cx - r * 0.35;
    const eyeXR = cx + r * 0.35;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.14} ${eyeY} Q${eyeXL} ${eyeY - r * 0.16} ${eyeXL + r * 0.14} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.14} ${eyeY} Q${eyeXR} ${eyeY - r * 0.16} ${eyeXR + r * 0.14} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.16} ry={r * 0.10} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.16} ry={r * 0.10} fill={dark} />
            <Ellipse cx={eyeXL + r * 0.05} cy={eyeY + r * 0.18} rx={r * 0.04} ry={r * 0.09} fill="#74B9FF" opacity={0.7} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.18} ry={r * 0.10} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.18} ry={r * 0.10} fill={dark} />
            <Path d={`M${eyeXL - r * 0.18} ${eyeY - r * 0.12} L${eyeXL + r * 0.12} ${eyeY - r * 0.20}`}
                  stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.18} ${eyeY - r * 0.12} L${eyeXR - r * 0.12} ${eyeY - r * 0.20}`}
                  stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.18} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.18} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
          </G>
        );
      case 'fearful':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.16} fill="white" />
            <Circle cx={eyeXL} cy={eyeY + r * 0.03} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.16} fill="white" />
            <Circle cx={eyeXR} cy={eyeY + r * 0.03} r={r * 0.08} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.18} ry={r * 0.12} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.18} ry={r * 0.12} fill={dark} />
            <Circle cx={eyeXL - r * 0.05} cy={eyeY - r * 0.04} r={r * 0.04} fill="white" />
            <Circle cx={eyeXR - r * 0.05} cy={eyeY - r * 0.04} r={r * 0.04} fill="white" />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.33;
    const mw = r * 0.3;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - mw} ${my} Q${mx} ${my + mw * 0.7} ${mx + mw} ${my}`}
                     stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - mw * 0.8} ${my + mw * 0.3} Q${mx} ${my - mw * 0.2} ${mx + mw * 0.8} ${my + mw * 0.3}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - mw * 0.6} ${my} L${mx + mw * 0.6} ${my}`}
                     stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={mw * 0.3} ry={mw * 0.4} fill={dark} opacity={0.6} />;
      case 'fearful':
        return <Path d={`M${mx - mw * 0.5} ${my} Q${mx - mw * 0.15} ${my + mw * 0.2} ${mx} ${my} Q${mx + mw * 0.15} ${my + mw * 0.2} ${mx + mw * 0.5} ${my}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      default:
        return <Path d={`M${mx - r * 0.15} ${my} L${mx} ${my - r * 0.03} L${mx + r * 0.15} ${my}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Pointy ears */}
      <Path d={`M${cx - r * 0.7} ${cy - r * 0.6} L${cx - r * 0.35} ${cy - r * 1.1} L${cx - r * 0.05} ${cy - r * 0.7}`}
            fill={color} />
      <Path d={`M${cx + r * 0.7} ${cy - r * 0.6} L${cx + r * 0.35} ${cy - r * 1.1} L${cx + r * 0.05} ${cy - r * 0.7}`}
            fill={color} />
      {/* Inner ear */}
      <Path d={`M${cx - r * 0.6} ${cy - r * 0.65} L${cx - r * 0.35} ${cy - r * 1.0} L${cx - r * 0.1} ${cy - r * 0.72}`}
            fill="#FFCCBC" opacity={0.6} />
      <Path d={`M${cx + r * 0.6} ${cy - r * 0.65} L${cx + r * 0.35} ${cy - r * 1.0} L${cx + r * 0.1} ${cy - r * 0.72}`}
            fill="#FFCCBC" opacity={0.6} />

      {/* Head */}
      <Circle cx={cx} cy={cy} r={r} fill={color} />

      {/* Tiny nose */}
      <Path d={`M${cx} ${cy + r * 0.08} L${cx - r * 0.08} ${cy + r * 0.18} L${cx + r * 0.08} ${cy + r * 0.18} Z`}
            fill="#FF8A80" />

      {/* Whiskers */}
      <Path d={`M${cx - r * 0.15} ${cy + r * 0.15} L${cx - r * 0.7} ${cy + r * 0.1}`}
            stroke="#9E9E9E" strokeWidth={1.5} opacity={0.6} />
      <Path d={`M${cx - r * 0.15} ${cy + r * 0.22} L${cx - r * 0.7} ${cy + r * 0.25}`}
            stroke="#9E9E9E" strokeWidth={1.5} opacity={0.6} />
      <Path d={`M${cx + r * 0.15} ${cy + r * 0.15} L${cx + r * 0.7} ${cy + r * 0.1}`}
            stroke="#9E9E9E" strokeWidth={1.5} opacity={0.6} />
      <Path d={`M${cx + r * 0.15} ${cy + r * 0.22} L${cx + r * 0.7} ${cy + r * 0.25}`}
            stroke="#9E9E9E" strokeWidth={1.5} opacity={0.6} />

      {/* Eyes */}
      {getEyes()}

      {/* Mouth */}
      {getMouth()}

      {/* Blush */}
      {(emotion === 'happy' || emotion === 'surprised') && (
        <G>
          <Ellipse cx={cx - r * 0.58} cy={cy + r * 0.12} rx={r * 0.15} ry={r * 0.09}
                   fill="#FFB3BA" opacity={0.5} />
          <Ellipse cx={cx + r * 0.58} cy={cy + r * 0.12} rx={r * 0.15} ry={r * 0.09}
                   fill="#FFB3BA" opacity={0.5} />
        </G>
      )}
      {/* Sad tear */}
      {emotion === 'sad' && (
        <Ellipse cx={cx - r * 0.30} cy={cy + r * 0.06} rx={r * 0.04} ry={r * 0.09} fill="#74B9FF" opacity={0.6} />
      )}
    </Svg>
  );
}

function BunnyFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.36;
  const color = EMOTION_COLORS[emotion]?.bg || '#E6D8FF';
  const dark = '#3E2C41';

  const getEyes = () => {
    const eyeXL = cx - r * 0.32;
    const eyeXR = cx + r * 0.32;
    const eyeY = cy - r * 0.12;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.09} ${eyeY} Q${eyeXL} ${eyeY - r * 0.13} ${eyeXL + r * 0.09} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.09} ${eyeY} Q${eyeXR} ${eyeY - r * 0.13} ${eyeXR + r * 0.09} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Ellipse cx={eyeXL + r * 0.04} cy={eyeY + r * 0.18} rx={r * 0.03} ry={r * 0.08} fill="#74B9FF" opacity={0.7} />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.08} fill={dark} />
          </G>
        );
      case 'fearful':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXL} cy={eyeY + r * 0.02} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXR} cy={eyeY + r * 0.02} r={r * 0.07} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.11} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.11} fill={dark} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.34;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.18} ${my} Q${mx} ${my + r * 0.12} ${mx + r * 0.18} ${my}`}
                     stroke="#5D4A66" strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.14} ${my + r * 0.06} Q${mx} ${my - r * 0.06} ${mx + r * 0.14} ${my + r * 0.06}`}
                     stroke="#5D4A66" strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.08} ry={r * 0.10} fill="#5D4A66" opacity={0.6} />;
      case 'angry':
        return <Path d={`M${mx - r * 0.12} ${my} L${mx + r * 0.12} ${my}`}
                     stroke="#5D4A66" strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      default:
        return <Path d={`M${mx - r * 0.10} ${my} Q${mx} ${my + r * 0.06} ${mx + r * 0.10} ${my}`}
                     stroke="#5D4A66" strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Long ears */}
      <Ellipse cx={cx - r * 0.32} cy={cy - r * 1.05} rx={r * 0.18} ry={r * 0.52} fill={color} />
      <Ellipse cx={cx + r * 0.32} cy={cy - r * 1.05} rx={r * 0.18} ry={r * 0.52} fill={color} />
      <Ellipse cx={cx - r * 0.32} cy={cy - r * 1.05} rx={r * 0.09} ry={r * 0.36} fill="#FFB6C1" opacity={0.7} />
      <Ellipse cx={cx + r * 0.32} cy={cy - r * 1.05} rx={r * 0.09} ry={r * 0.36} fill="#FFB6C1" opacity={0.7} />
      {/* One ear droops when sad */}
      {emotion === 'sad' && (
        <Ellipse cx={cx + r * 0.55} cy={cy - r * 0.55} rx={r * 0.18} ry={r * 0.48} fill={color}
                 transform={`rotate(35°,${cx + r * 0.55},${cy - r * 0.55})`} />
      )}

      {/* Head */}
      <Circle cx={cx} cy={cy} r={r} fill={color} />
      {/* Snout */}
      <Ellipse cx={cx} cy={cy + r * 0.24} rx={r * 0.24} ry={r * 0.18} fill="#FFF5FF" />
      {/* Nose */}
      <Circle cx={cx} cy={cy + r * 0.2} r={r * 0.06} fill="#FF8AAE" />

      {/* Eyes */}
      {getEyes()}
      {/* Mouth */}
      {getMouth()}

      {/* Blush */}
      <Circle cx={cx - r * 0.58} cy={cy + r * 0.04} r={r * 0.08} fill="#FFB6C1" opacity={0.35} />
      <Circle cx={cx + r * 0.58} cy={cy + r * 0.04} r={r * 0.08} fill="#FFB6C1" opacity={0.35} />
    </Svg>
  );
}

function BearFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || '#B9855B';
  const dark = '#3E2723';

  const getEyes = () => {
    const eyeXL = cx - r * 0.3;
    const eyeXR = cx + r * 0.3;
    const eyeY = cy - r * 0.1;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.08} ${eyeY} Q${eyeXL} ${eyeY - r * 0.12} ${eyeXL + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.08} ${eyeY} Q${eyeXR} ${eyeY - r * 0.12} ${eyeXR + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill={dark} />
            <Path d={`M${eyeXL - r * 0.12} ${eyeY - r * 0.10} Q${eyeXL} ${eyeY - r * 0.16} ${eyeXL + r * 0.12} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.12} ${eyeY - r * 0.14} Q${eyeXR} ${eyeY - r * 0.16} ${eyeXR + r * 0.12} ${eyeY - r * 0.10}`}
                  stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.08} L${eyeXL + r * 0.10} ${eyeY - r * 0.16}`}
                  stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.14} ${eyeY - r * 0.08} L${eyeXR - r * 0.10} ${eyeY - r * 0.16}`}
                  stroke={dark} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.08} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.30;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.18} ${my} Q${mx} ${my + r * 0.14} ${mx + r * 0.18} ${my}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.15} ${my + r * 0.06} Q${mx} ${my - r * 0.06} ${mx + r * 0.15} ${my + r * 0.06}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.14} ${my} L${mx + r * 0.14} ${my + r * 0.02}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.08} ry={r * 0.10} fill={dark} opacity={0.6} />;
      default:
        return <Path d={`M${mx - r * 0.12} ${my} Q${mx} ${my + r * 0.06} ${mx + r * 0.12} ${my}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx - r * 0.74} cy={cy - r * 0.62} r={r * 0.26} fill={color} />
      <Circle cx={cx + r * 0.74} cy={cy - r * 0.62} r={r * 0.26} fill={color} />
      <Circle cx={cx - r * 0.74} cy={cy - r * 0.62} r={r * 0.12} fill="#EACAA8" opacity={0.9} />
      <Circle cx={cx + r * 0.74} cy={cy - r * 0.62} r={r * 0.12} fill="#EACAA8" opacity={0.9} />

      <Circle cx={cx} cy={cy} r={r} fill={color} />
      <Ellipse cx={cx} cy={cy + r * 0.22} rx={r * 0.32} ry={r * 0.24} fill="#EACAA8" />
      <Ellipse cx={cx} cy={cy + r * 0.15} rx={r * 0.10} ry={r * 0.07} fill={dark} />

      {getEyes()}
      {getMouth()}

      <Circle cx={cx - r * 0.52} cy={cy + r * 0.04} r={r * 0.07} fill="#FFAB91" opacity={0.28} />
      <Circle cx={cx + r * 0.52} cy={cy + r * 0.04} r={r * 0.07} fill="#FFAB91" opacity={0.28} />
    </Svg>
  );
}

function FoxFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || '#FF8C42';
  const dark = '#2F2F2F';

  const getEyes = () => {
    const eyeXL = cx - r * 0.3;
    const eyeXR = cx + r * 0.3;
    const eyeY = cy - r * 0.12;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.09} ${eyeY} Q${eyeXL} ${eyeY - r * 0.12} ${eyeXL + r * 0.09} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.09} ${eyeY} Q${eyeXR} ${eyeY - r * 0.12} ${eyeXR + r * 0.09} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.10} ry={r * 0.08} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.10} ry={r * 0.08} fill={dark} />
            <Path d={`M${eyeXL - r * 0.12} ${eyeY - r * 0.08} Q${eyeXL} ${eyeY - r * 0.14} ${eyeXL + r * 0.12} ${eyeY - r * 0.12}`}
                  stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.12} ${eyeY - r * 0.12} Q${eyeXR} ${eyeY - r * 0.14} ${eyeXR + r * 0.12} ${eyeY - r * 0.08}`}
                  stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.11} ry={r * 0.09} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.11} ry={r * 0.09} fill={dark} />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.06} L${eyeXL + r * 0.10} ${eyeY - r * 0.15}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.14} ${eyeY - r * 0.06} L${eyeXR - r * 0.10} ${eyeY - r * 0.15}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.08} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.12} ry={r * 0.10} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.12} ry={r * 0.10} fill={dark} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.26;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.14} ${my} Q${mx} ${my + r * 0.12} ${mx + r * 0.14} ${my}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.12} ${my + r * 0.04} Q${mx} ${my - r * 0.06} ${mx + r * 0.12} ${my + r * 0.04}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.12} ${my} L${mx + r * 0.12} ${my + r * 0.02}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.07} ry={r * 0.09} fill={dark} opacity={0.5} />;
      default:
        return <Path d={`M${mx - r * 0.08} ${my} Q${mx} ${my + r * 0.04} ${mx + r * 0.08} ${my}`}
                     stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path d={`M${cx - r * 0.75} ${cy - r * 0.45} L${cx - r * 0.35} ${cy - r * 1.0} L${cx - r * 0.05} ${cy - r * 0.35} Z`} fill={color} />
      <Path d={`M${cx + r * 0.75} ${cy - r * 0.45} L${cx + r * 0.35} ${cy - r * 1.0} L${cx + r * 0.05} ${cy - r * 0.35} Z`} fill={color} />
      <Path d={`M${cx - r * 0.64} ${cy - r * 0.46} L${cx - r * 0.35} ${cy - r * 0.88} L${cx - r * 0.14} ${cy - r * 0.44} Z`} fill="#FFF3E0" />
      <Path d={`M${cx + r * 0.64} ${cy - r * 0.46} L${cx + r * 0.35} ${cy - r * 0.88} L${cx + r * 0.14} ${cy - r * 0.44} Z`} fill="#FFF3E0" />

      <Circle cx={cx} cy={cy} r={r} fill={color} />
      <Path d={`M${cx - r * 0.72} ${cy - r * 0.05} Q${cx} ${cy + r * 0.55} ${cx + r * 0.72} ${cy - r * 0.05} Q${cx} ${cy + r * 0.12} ${cx - r * 0.72} ${cy - r * 0.05} Z`} fill="#FFF3E0" />

      <Path d={`M${cx} ${cy + r * 0.08} L${cx - r * 0.08} ${cy + r * 0.2} L${cx + r * 0.08} ${cy + r * 0.2} Z`} fill={dark} />

      {getEyes()}
      {getMouth()}
    </Svg>
  );
}

function PandaFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || '#F5F5F5';
  const dark = '#1E1E1E';

  const getEyes = () => {
    const eyeXL = cx - r * 0.32;
    const eyeXR = cx + r * 0.32;
    const eyeY = cy - r * 0.1;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Path d={`M${eyeXL - r * 0.06} ${eyeY} Q${eyeXL} ${eyeY - r * 0.08} ${eyeXL + r * 0.06} ${eyeY}`}
                  stroke="#FFF" strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.06} ${eyeY} Q${eyeXR} ${eyeY - r * 0.08} ${eyeXR + r * 0.06} ${eyeY}`}
                  stroke="#FFF" strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Circle cx={eyeXL} cy={eyeY + r * 0.02} r={r * 0.05} fill="#FFF" />
            <Circle cx={eyeXR} cy={eyeY + r * 0.02} r={r * 0.05} fill="#FFF" />
            <Ellipse cx={eyeXL + r * 0.12} cy={eyeY + r * 0.18} rx={r * 0.03} ry={r * 0.05} fill="#90CAF9" opacity={0.7} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.06} fill="#FFF" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.06} fill="#FFF" />
            <Path d={`M${eyeXL - r * 0.16} ${eyeY - r * 0.10} L${eyeXL + r * 0.12} ${eyeY - r * 0.18}`}
                  stroke={color} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.16} ${eyeY - r * 0.10} L${eyeXR - r * 0.12} ${eyeY - r * 0.18}`}
                  stroke={color} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.20} ry={r * 0.18} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.20} ry={r * 0.18} fill={dark} />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill="#FFF" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill="#FFF" />
          </G>
        );
      default:
        return (
          <G>
            <Ellipse cx={eyeXL} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={r * 0.20} ry={r * 0.16} fill={dark} />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.07} fill="#FFF" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.07} fill="#FFF" />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.30;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.16} ${my} Q${mx} ${my + r * 0.14} ${mx + r * 0.16} ${my}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.14} ${my + r * 0.06} Q${mx} ${my - r * 0.06} ${mx + r * 0.14} ${my + r * 0.06}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.12} ${my} L${mx + r * 0.12} ${my}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.07} ry={r * 0.10} fill={dark} opacity={0.5} />;
      default:
        return <Path d={`M${mx - r * 0.10} ${my} Q${mx} ${my + r * 0.06} ${mx + r * 0.10} ${my}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx - r * 0.7} cy={cy - r * 0.62} r={r * 0.24} fill={dark} />
      <Circle cx={cx + r * 0.7} cy={cy - r * 0.62} r={r * 0.24} fill={dark} />

      <Circle cx={cx} cy={cy} r={r} fill={color} />

      <Ellipse cx={cx} cy={cy + r * 0.15} rx={r * 0.1} ry={r * 0.07} fill={dark} />

      {getEyes()}
      {getMouth()}
    </Svg>
  );
}

function OwlFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.36;
  const color = EMOTION_COLORS[emotion]?.bg || '#8E6D5A';
  const dark = '#3E2723';

  const getEyes = () => {
    const eyeXL = cx - r * 0.28;
    const eyeXR = cx + r * 0.28;
    const eyeY = cy - r * 0.12;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Path d={`M${eyeXL - r * 0.08} ${eyeY} Q${eyeXL} ${eyeY - r * 0.10} ${eyeXL + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.08} ${eyeY} Q${eyeXR} ${eyeY - r * 0.10} ${eyeXR + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXL} cy={eyeY + r * 0.02} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY + r * 0.02} r={r * 0.07} fill={dark} />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.12} Q${eyeXL} ${eyeY - r * 0.18} ${eyeXL + r * 0.14} ${eyeY - r * 0.16}`}
                  stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.14} ${eyeY - r * 0.16} Q${eyeXR} ${eyeY - r * 0.18} ${eyeXR + r * 0.14} ${eyeY - r * 0.12}`}
                  stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill={dark} />
            <Path d={`M${eyeXL - r * 0.16} ${eyeY - r * 0.10} L${eyeXL + r * 0.12} ${eyeY - r * 0.20}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.16} ${eyeY - r * 0.10} L${eyeXR - r * 0.12} ${eyeY - r * 0.20}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.24} fill="#FFF8E1" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.24} fill="#FFF8E1" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill={dark} />
            <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.03} fill="#FFF" />
            <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.03} fill="#FFF" />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.22} fill="#FFF8E1" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill={dark} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.30;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.18} ${my} Q${mx} ${my + r * 0.12} ${mx + r * 0.18} ${my}`}
                     stroke="#FFF8E1" strokeWidth={s * 0.017} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.14} ${my + r * 0.06} Q${mx} ${my - r * 0.04} ${mx + r * 0.14} ${my + r * 0.06}`}
                     stroke="#FFF8E1" strokeWidth={s * 0.017} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.06} ry={r * 0.08} fill="#FFF8E1" opacity={0.8} />;
      default:
        return <Path d={`M${mx - r * 0.12} ${my} Q${mx} ${my + r * 0.04} ${mx + r * 0.12} ${my}`}
                     stroke="#FFF8E1" strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path d={`M${cx - r * 0.6} ${cy - r * 0.85} L${cx - r * 0.35} ${cy - r * 1.15} L${cx - r * 0.1} ${cy - r * 0.82} Z`} fill={color} />
      <Path d={`M${cx + r * 0.6} ${cy - r * 0.85} L${cx + r * 0.35} ${cy - r * 1.15} L${cx + r * 0.1} ${cy - r * 0.82} Z`} fill={color} />

      <Ellipse cx={cx} cy={cy} rx={r * 0.95} ry={r} fill={color} />

      <Path d={`M${cx} ${cy + r * 0.02} L${cx - r * 0.09} ${cy + r * 0.18} L${cx + r * 0.09} ${cy + r * 0.18} Z`} fill="#F4B400" />

      {getEyes()}
      {getMouth()}
    </Svg>
  );
}

function SealFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const bodyColor = EMOTION_COLORS[emotion]?.bg || '#9CB4C5';
  const bodyShadow = EMOTION_COLORS[emotion]?.light || '#839AAC';
  const muzzle = '#E8F0F5';
  const dark = '#2A3440';

  const getEyes = () => {
    const eyeXL = cx - r * 0.28;
    const eyeXR = cx + r * 0.28;
    const eyeY = cy - r * 0.12;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.08} ${eyeY} Q${eyeXL} ${eyeY - r * 0.10} ${eyeXL + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.08} ${eyeY} Q${eyeXR} ${eyeY - r * 0.10} ${eyeXR + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" opacity={0.85} />
            <Circle cx={eyeXR - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" opacity={0.85} />
            <Ellipse cx={eyeXL + r * 0.08} cy={eyeY + r * 0.15} rx={r * 0.025} ry={r * 0.04} fill="#90CAF9" opacity={0.7} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.06} L${eyeXL + r * 0.10} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.14} ${eyeY - r * 0.06} L${eyeXR - r * 0.10} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.07} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" opacity={0.85} />
            <Circle cx={eyeXR + r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" opacity={0.85} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.30;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.24} ${my} Q${mx} ${my + r * 0.17} ${mx + r * 0.24} ${my}`}
                     stroke={dark} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.18} ${my + r * 0.06} Q${mx} ${my - r * 0.06} ${mx + r * 0.18} ${my + r * 0.06}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.14} ${my} L${mx + r * 0.14} ${my + r * 0.02}`}
                     stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.07} ry={r * 0.09} fill={dark} opacity={0.5} />;
      default:
        return <Path d={`M${mx - r * 0.20} ${my} Q${mx} ${my - r * 0.06} ${mx + r * 0.20} ${my}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Ellipse cx={cx - r * 0.86} cy={cy + r * 0.2} rx={r * 0.2} ry={r * 0.11} fill={bodyShadow} opacity={0.9} />
      <Ellipse cx={cx + r * 0.86} cy={cy + r * 0.2} rx={r * 0.2} ry={r * 0.11} fill={bodyShadow} opacity={0.9} />

      <Ellipse cx={cx} cy={cy} rx={r * 1.02} ry={r * 0.88} fill={bodyColor} />
      <Ellipse cx={cx} cy={cy + r * 0.36} rx={r * 0.88} ry={r * 0.38} fill={bodyShadow} opacity={0.22} />
      <Ellipse cx={cx} cy={cy + r * 0.18} rx={r * 0.48} ry={r * 0.34} fill={muzzle} />
      <Ellipse cx={cx - r * 0.58} cy={cy - r * 0.05} rx={r * 0.12} ry={r * 0.08} fill="#FFC6CF" opacity={0.4} />
      <Ellipse cx={cx + r * 0.58} cy={cy - r * 0.05} rx={r * 0.12} ry={r * 0.08} fill="#FFC6CF" opacity={0.4} />

      <Ellipse cx={cx} cy={cy + r * 0.1} rx={r * 0.1} ry={r * 0.08} fill={dark} />

      {getEyes()}
      {getMouth()}

      <Path d={`M${cx - r * 0.18} ${cy + r * 0.17} L${cx - r * 0.58} ${cy + r * 0.13}`} stroke="#6B7D8A" strokeWidth={1.6} opacity={0.75} />
      <Path d={`M${cx - r * 0.18} ${cy + r * 0.23} L${cx - r * 0.58} ${cy + r * 0.27}`} stroke="#6B7D8A" strokeWidth={1.6} opacity={0.75} />
      <Path d={`M${cx + r * 0.18} ${cy + r * 0.17} L${cx + r * 0.58} ${cy + r * 0.13}`} stroke="#6B7D8A" strokeWidth={1.6} opacity={0.75} />
      <Path d={`M${cx + r * 0.18} ${cy + r * 0.23} L${cx + r * 0.58} ${cy + r * 0.27}`} stroke="#6B7D8A" strokeWidth={1.6} opacity={0.75} />

      <Ellipse cx={cx - r * 0.42} cy={cy - r * 0.58} rx={r * 0.08} ry={r * 0.05} fill="#FFFFFF" opacity={0.2} />
    </Svg>
  );
}

// ── New Pet: Hamster ──
function HamsterFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.36;
  const color = EMOTION_COLORS[emotion]?.bg || '#F5C98A';
  const dark = '#3E2723';

  const getEyes = () => {
    const eyeXL = cx - r * 0.28;
    const eyeXR = cx + r * 0.28;
    const eyeY = cy - r * 0.1;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.08} ${eyeY} Q${eyeXL} ${eyeY - r * 0.10} ${eyeXL + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.08} ${eyeY} Q${eyeXR} ${eyeY - r * 0.10} ${eyeXR + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.09} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.025} fill="#FFF" />
            <Circle cx={eyeXR - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.025} fill="#FFF" />
            <Ellipse cx={eyeXL + r * 0.07} cy={eyeY + r * 0.14} rx={r * 0.02} ry={r * 0.04} fill="#90CAF9" opacity={0.7} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.06} L${eyeXL + r * 0.08} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.14} ${eyeY - r * 0.06} L${eyeXR - r * 0.08} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.07} fill={dark} />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.10} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" />
            <Circle cx={eyeXR - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.03} fill="#FFF" />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.22;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.16} ${my} Q${mx} ${my + r * 0.14} ${mx + r * 0.16} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.12} ${my + r * 0.06} Q${mx} ${my - r * 0.04} ${mx + r * 0.12} ${my + r * 0.06}`}
                     stroke="#5D4037" strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.10} ${my} L${mx + r * 0.10} ${my + r * 0.02}`}
                     stroke="#5D4037" strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.06} ry={r * 0.08} fill="#5D4037" opacity={0.5} />;
      default:
        return <Path d={`M${mx - r * 0.1} ${my} L${mx + r * 0.1} ${my}`}
                     stroke="#5D4037" strokeWidth={s * 0.018} strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx - r * 0.72} cy={cy - r * 0.52} r={r * 0.22} fill={color} />
      <Circle cx={cx + r * 0.72} cy={cy - r * 0.52} r={r * 0.22} fill={color} />
      <Circle cx={cx - r * 0.72} cy={cy - r * 0.52} r={r * 0.12} fill="#FFD4B8" opacity={0.8} />
      <Circle cx={cx + r * 0.72} cy={cy - r * 0.52} r={r * 0.12} fill="#FFD4B8" opacity={0.8} />
      <Ellipse cx={cx} cy={cy} rx={r * 1.08} ry={r * 0.92} fill={color} />
      <Ellipse cx={cx - r * 0.62} cy={cy + r * 0.15} rx={r * 0.28} ry={r * 0.22} fill="#FFE0B2" opacity={0.85} />
      <Ellipse cx={cx + r * 0.62} cy={cy + r * 0.15} rx={r * 0.28} ry={r * 0.22} fill="#FFE0B2" opacity={0.85} />

      <Circle cx={cx} cy={cy + r * 0.08} r={r * 0.06} fill="#FF8A80" />

      {getEyes()}
      {getMouth()}

      <Ellipse cx={cx - r * 0.5} cy={cy + r * 0.08} rx={r * 0.1} ry={r * 0.06} fill="#FFB3BA" opacity={0.5} />
      <Ellipse cx={cx + r * 0.5} cy={cy + r * 0.08} rx={r * 0.1} ry={r * 0.06} fill="#FFB3BA" opacity={0.5} />
    </Svg>
  );
}

// ── New Pet: Penguin ──
function PenguinFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const color = EMOTION_COLORS[emotion]?.bg || '#2C3E50';
  const belly = '#F0F4F8';
  const dark = '#1A1A2E';

  const getEyes = () => {
    const eyeXL = cx - r * 0.25;
    const eyeXR = cx + r * 0.25;
    const eyeY = cy - r * 0.18;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="white" />
            <Path d={`M${eyeXL - r * 0.06} ${eyeY + r * 0.02} Q${eyeXL} ${eyeY - r * 0.06} ${eyeXL + r * 0.06} ${eyeY + r * 0.02}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.06} ${eyeY + r * 0.02} Q${eyeXR} ${eyeY - r * 0.06} ${eyeXR + r * 0.06} ${eyeY + r * 0.02}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXL} cy={eyeY + r * 0.02} r={r * 0.06} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY + r * 0.02} r={r * 0.06} fill={dark} />
            <Path d={`M${eyeXL - r * 0.10} ${eyeY - r * 0.06} Q${eyeXL} ${eyeY - r * 0.12} ${eyeXL + r * 0.10} ${eyeY - r * 0.10}`}
                  stroke={dark} strokeWidth={s * 0.014} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.10} ${eyeY - r * 0.10} Q${eyeXR} ${eyeY - r * 0.12} ${eyeXR + r * 0.10} ${eyeY - r * 0.06}`}
                  stroke={dark} strokeWidth={s * 0.014} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.07} fill={dark} />
            <Path d={`M${eyeXL - r * 0.12} ${eyeY - r * 0.06} L${eyeXL + r * 0.08} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.12} ${eyeY - r * 0.06} L${eyeXR - r * 0.08} ${eyeY - r * 0.14}`}
                  stroke={dark} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.14} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.08} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.02} fill="#FFF" />
            <Circle cx={eyeXR - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.02} fill="#FFF" />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.12} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.07} fill={dark} />
            <Circle cx={eyeXL - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.025} fill="#FFF" />
            <Circle cx={eyeXR - r * 0.03} cy={eyeY - r * 0.03} r={r * 0.025} fill="#FFF" />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.26;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.18} ${my} Q${mx} ${my + r * 0.14} ${mx + r * 0.18} ${my}`}
                     stroke={dark} strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.14} ${my + r * 0.06} Q${mx} ${my - r * 0.04} ${mx + r * 0.14} ${my + r * 0.06}`}
                     stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.12} ${my} L${mx + r * 0.12} ${my + r * 0.02}`}
                     stroke={dark} strokeWidth={s * 0.020} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.06} ry={r * 0.08} fill={dark} opacity={0.5} />;
      default:
        return <Path d={`M${mx - r * 0.12} ${my} Q${mx} ${my - r * 0.04} ${mx + r * 0.12} ${my}`}
                     stroke={dark} strokeWidth={s * 0.016} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Ellipse cx={cx} cy={cy} rx={r * 0.92} ry={r} fill={color} />
      <Ellipse cx={cx} cy={cy + r * 0.08} rx={r * 0.6} ry={r * 0.72} fill={belly} />
      <Path d={`M${cx - r * 0.12} ${cy + r * 0.02} L${cx} ${cy + r * 0.18} L${cx + r * 0.12} ${cy + r * 0.02} Z`}
            fill="#F4B400" />

      {getEyes()}
      {getMouth()}

      <Ellipse cx={cx - r * 0.42} cy={cy + r * 0.02} rx={r * 0.1} ry={r * 0.06} fill="#FFB3BA" opacity={0.5} />
      <Ellipse cx={cx + r * 0.42} cy={cy + r * 0.02} rx={r * 0.1} ry={r * 0.06} fill="#FFB3BA" opacity={0.5} />
      <Ellipse cx={cx - r * 0.25} cy={cy + r * 0.88} rx={r * 0.14} ry={r * 0.06} fill="#F4B400" opacity={0.7} />
      <Ellipse cx={cx + r * 0.25} cy={cy + r * 0.88} rx={r * 0.14} ry={r * 0.06} fill="#F4B400" opacity={0.7} />
    </Svg>
  );
}

// ── New Pet: Capybara ──
function CapybaraFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;
  const bodyColor = '#A0836D';
  const snoutColor = '#D4B896';
  const darkBrown = '#5D4037';

  const getEyes = () => {
    const eyeY = cy - r * 0.12;
    const eyeXL = cx - r * 0.30;
    const eyeXR = cx + r * 0.30;
    const eyeR = r * 0.10;

    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - eyeR} ${eyeY} Q${eyeXL} ${eyeY - eyeR * 1.5} ${eyeXL + eyeR} ${eyeY}`}
                  stroke={darkBrown} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - eyeR} ${eyeY} Q${eyeXR} ${eyeY - eyeR * 1.5} ${eyeXR + eyeR} ${eyeY}`}
                  stroke={darkBrown} strokeWidth={s * 0.028} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR} fill={darkBrown} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR} fill={darkBrown} />
            {/* Droopy brows */}
            <Path d={`M${eyeXL - eyeR * 1.4} ${eyeY - eyeR * 1.2} Q${eyeXL} ${eyeY - eyeR * 2.0} ${eyeXL + eyeR * 1.4} ${eyeY - eyeR * 1.6}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - eyeR * 1.4} ${eyeY - eyeR * 1.6} Q${eyeXR} ${eyeY - eyeR * 2.0} ${eyeXR + eyeR * 1.4} ${eyeY - eyeR * 1.2}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
            {/* Tear */}
            <Ellipse cx={eyeXL + eyeR * 0.5} cy={eyeY + eyeR * 2.0} rx={r * 0.04} ry={r * 0.10} fill="#74B9FF" opacity={0.75} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR} fill={darkBrown} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR} fill={darkBrown} />
            {/* Angry brows (V-shape) */}
            <Path d={`M${eyeXL - eyeR * 1.5} ${eyeY - eyeR * 1.0} L${eyeXL + eyeR * 1.0} ${eyeY - eyeR * 1.8}`}
                  stroke={darkBrown} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + eyeR * 1.5} ${eyeY - eyeR * 1.0} L${eyeXR - eyeR * 1.0} ${eyeY - eyeR * 1.8}`}
                  stroke={darkBrown} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR * 1.5} fill="white" />
            <Circle cx={eyeXL} cy={eyeY} r={eyeR * 0.9} fill={darkBrown} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR * 1.5} fill="white" />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR * 0.9} fill={darkBrown} />
            {/* Raised brows */}
            <Path d={`M${eyeXL - eyeR * 1.3} ${eyeY - eyeR * 2.2} Q${eyeXL} ${eyeY - eyeR * 2.8} ${eyeXL + eyeR * 1.3} ${eyeY - eyeR * 2.2}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - eyeR * 1.3} ${eyeY - eyeR * 2.2} Q${eyeXR} ${eyeY - eyeR * 2.8} ${eyeXR + eyeR * 1.3} ${eyeY - eyeR * 2.2}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'fearful':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR * 1.4} fill="white" />
            <Circle cx={eyeXL} cy={eyeY + eyeR * 0.2} r={eyeR * 0.7} fill={darkBrown} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR * 1.4} fill="white" />
            <Circle cx={eyeXR} cy={eyeY + eyeR * 0.2} r={eyeR * 0.7} fill={darkBrown} />
            {/* Worried brows */}
            <Path d={`M${eyeXL - eyeR * 1.3} ${eyeY - eyeR * 1.6} Q${eyeXL} ${eyeY - eyeR * 2.4} ${eyeXL + eyeR * 1.3} ${eyeY - eyeR * 2.0}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - eyeR * 1.3} ${eyeY - eyeR * 2.0} Q${eyeXR} ${eyeY - eyeR * 2.4} ${eyeXR + eyeR * 1.3} ${eyeY - eyeR * 1.6}`}
                  stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'anxious':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR * 1.1} fill="white" />
            <Circle cx={eyeXL + eyeR * 0.2} cy={eyeY} r={eyeR * 0.65} fill={darkBrown} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR * 1.1} fill="white" />
            <Circle cx={eyeXR - eyeR * 0.2} cy={eyeY} r={eyeR * 0.65} fill={darkBrown} />
            {/* Sweat drop */}
            <Ellipse cx={eyeXR + eyeR * 2.2} cy={eyeY - eyeR * 0.5} rx={r * 0.03} ry={r * 0.06} fill="#74B9FF" opacity={0.6} />
          </G>
        );
      case 'disgusted':
        return (
          <G>
            {/* Squinted / half-closed eyes */}
            <Ellipse cx={eyeXL} cy={eyeY} rx={eyeR * 1.0} ry={eyeR * 0.5} fill={darkBrown} />
            <Ellipse cx={eyeXR} cy={eyeY} rx={eyeR * 1.0} ry={eyeR * 0.5} fill={darkBrown} />
          </G>
        );
      default: // neutral
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={eyeR} fill={darkBrown} />
            <Circle cx={eyeXL - eyeR * 0.35} cy={eyeY - eyeR * 0.35} r={eyeR * 0.3} fill="white" opacity={0.7} />
            <Circle cx={eyeXR} cy={eyeY} r={eyeR} fill={darkBrown} />
            <Circle cx={eyeXR - eyeR * 0.35} cy={eyeY - eyeR * 0.35} r={eyeR * 0.3} fill="white" opacity={0.7} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.32;
    const mw = r * 0.35;

    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - mw} ${my} Q${mx} ${my + mw * 0.9} ${mx + mw} ${my}`}
                     stroke={darkBrown} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - mw * 0.8} ${my + mw * 0.3} Q${mx} ${my - mw * 0.3} ${mx + mw * 0.8} ${my + mw * 0.3}`}
                     stroke={darkBrown} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - mw * 0.7} ${my} L${mx + mw * 0.7} ${my + mw * 0.08}`}
                     stroke={darkBrown} strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my + r * 0.05} rx={mw * 0.35} ry={mw * 0.45}
                        fill={darkBrown} opacity={0.65} />;
      case 'fearful':
        return <Path d={`M${mx - mw * 0.6} ${my} Q${mx - mw * 0.2} ${my + mw * 0.2} ${mx} ${my} Q${mx + mw * 0.2} ${my + mw * 0.2} ${mx + mw * 0.6} ${my}`}
                     stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'anxious':
        return <Path d={`M${mx - mw * 0.5} ${my} Q${mx - mw * 0.15} ${my + mw * 0.2} ${mx} ${my} Q${mx + mw * 0.15} ${my - mw * 0.15} ${mx + mw * 0.5} ${my}`}
                     stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'disgusted':
        return (
          <G>
            <Path d={`M${mx - mw * 0.6} ${my + mw * 0.15} Q${mx} ${my - mw * 0.15} ${mx + mw * 0.6} ${my + mw * 0.15}`}
                  stroke={darkBrown} strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />
            {/* Tongue out for disgust */}
            <Ellipse cx={mx + mw * 0.1} cy={my + mw * 0.25} rx={mw * 0.12} ry={mw * 0.08} fill="#E88080" opacity={0.6} />
          </G>
        );
      default:
        return <Path d={`M${mx - mw * 0.5} ${my} Q${mx} ${my + mw * 0.15} ${mx + mw * 0.5} ${my}`}
                     stroke={darkBrown} strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Small round ears on top */}
      <Ellipse cx={cx - r * 0.58} cy={cy - r * 0.68} rx={r * 0.18} ry={r * 0.14} fill={bodyColor} />
      <Ellipse cx={cx + r * 0.58} cy={cy - r * 0.68} rx={r * 0.18} ry={r * 0.14} fill={bodyColor} />
      <Ellipse cx={cx - r * 0.58} cy={cy - r * 0.68} rx={r * 0.10} ry={r * 0.08} fill="#C4A882" opacity={0.7} />
      <Ellipse cx={cx + r * 0.58} cy={cy - r * 0.68} rx={r * 0.10} ry={r * 0.08} fill="#C4A882" opacity={0.7} />

      {/* Large rectangular-ish head (capybara has a boxy face) */}
      <Ellipse cx={cx} cy={cy} rx={r * 0.95} ry={r} fill={bodyColor} />

      {/* Lighter snout area (capybara's large flat muzzle) */}
      <Ellipse cx={cx} cy={cy + r * 0.25} rx={r * 0.55} ry={r * 0.38} fill={snoutColor} />

      {/* Darker fur patch on top of head */}
      <Ellipse cx={cx} cy={cy - r * 0.45} rx={r * 0.45} ry={r * 0.20} fill="#8B6F5E" opacity={0.4} />

      {/* Nostrils (capybara has prominent nostrils on top of snout) */}
      <Ellipse cx={cx - r * 0.10} cy={cy + r * 0.12} rx={r * 0.05} ry={r * 0.04} fill={darkBrown} />
      <Ellipse cx={cx + r * 0.10} cy={cy + r * 0.12} rx={r * 0.05} ry={r * 0.04} fill={darkBrown} />

      {/* Eyes */}
      {getEyes()}

      {/* Whisker dots (capybara has whisker spots on snout) */}
      <Circle cx={cx - r * 0.25} cy={cy + r * 0.22} r={r * 0.02} fill={darkBrown} opacity={0.4} />
      <Circle cx={cx - r * 0.18} cy={cy + r * 0.26} r={r * 0.02} fill={darkBrown} opacity={0.4} />
      <Circle cx={cx - r * 0.30} cy={cy + r * 0.28} r={r * 0.02} fill={darkBrown} opacity={0.3} />
      <Circle cx={cx + r * 0.25} cy={cy + r * 0.22} r={r * 0.02} fill={darkBrown} opacity={0.4} />
      <Circle cx={cx + r * 0.18} cy={cy + r * 0.26} r={r * 0.02} fill={darkBrown} opacity={0.4} />
      <Circle cx={cx + r * 0.30} cy={cy + r * 0.28} r={r * 0.02} fill={darkBrown} opacity={0.3} />

      {/* Mouth */}
      {getMouth()}

      {/* Blush */}
      {(emotion === 'happy' || emotion === 'surprised') && (
        <G>
          <Ellipse cx={cx - r * 0.52} cy={cy + r * 0.10} rx={r * 0.14} ry={r * 0.08} fill="#FFB3BA" opacity={0.45} />
          <Ellipse cx={cx + r * 0.52} cy={cy + r * 0.10} rx={r * 0.14} ry={r * 0.08} fill="#FFB3BA" opacity={0.45} />
        </G>
      )}

      {/* Small tuft of grass/flower on head when happy (capybara vibes) */}
      {emotion === 'happy' && (
        <G>
          <Path d={`M${cx + r * 0.05} ${cy - r * 0.80} Q${cx + r * 0.02} ${cy - r * 1.05} ${cx - r * 0.08} ${cy - r * 1.10}`}
                stroke="#66BB6A" strokeWidth={s * 0.015} fill="none" strokeLinecap="round" />
          <Path d={`M${cx + r * 0.05} ${cy - r * 0.80} Q${cx + r * 0.12} ${cy - r * 1.05} ${cx + r * 0.20} ${cy - r * 1.05}`}
                stroke="#66BB6A" strokeWidth={s * 0.015} fill="none" strokeLinecap="round" />
          <Circle cx={cx + r * 0.06} cy={cy - r * 1.08} r={r * 0.05} fill="#FFC107" opacity={0.8} />
        </G>
      )}
    </Svg>
  );
}

// ── New Pet: Unicorn ──
function UnicornFace({ emotion, size }: { emotion: string; size: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.36;
  const color = EMOTION_COLORS[emotion]?.bg || '#F3E5F5';
  const dark = '#4A148C';

  const getEyes = () => {
    const eyeXL = cx - r * 0.3;
    const eyeXR = cx + r * 0.3;
    const eyeY = cy - r * 0.08;
    switch (emotion) {
      case 'happy':
        return (
          <G>
            <Path d={`M${eyeXL - r * 0.08} ${eyeY} Q${eyeXL} ${eyeY - r * 0.12} ${eyeXL + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR - r * 0.08} ${eyeY} Q${eyeXR} ${eyeY - r * 0.12} ${eyeXR + r * 0.08} ${eyeY}`}
                  stroke={dark} strokeWidth={s * 0.026} fill="none" strokeLinecap="round" />
            <Circle cx={eyeXL + r * 0.12} cy={eyeY - r * 0.08} r={r * 0.025} fill="#FFD54F" opacity={0.8} />
            <Circle cx={eyeXR + r * 0.12} cy={eyeY - r * 0.08} r={r * 0.025} fill="#FFD54F" opacity={0.8} />
          </G>
        );
      case 'sad':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Ellipse cx={eyeXL + r * 0.10} cy={eyeY + r * 0.18} rx={r * 0.025} ry={r * 0.05} fill="#CE93D8" opacity={0.7} />
          </G>
        );
      case 'angry':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Path d={`M${eyeXL - r * 0.14} ${eyeY - r * 0.08} L${eyeXL + r * 0.10} ${eyeY - r * 0.16}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
            <Path d={`M${eyeXR + r * 0.14} ${eyeY - r * 0.08} L${eyeXR - r * 0.10} ${eyeY - r * 0.16}`}
                  stroke={dark} strokeWidth={s * 0.024} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'surprised':
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.15} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.15} fill={dark} />
            <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.05} r={r * 0.06} fill="white" />
            <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.05} r={r * 0.06} fill="white" />
            <Circle cx={eyeXL + r * 0.04} cy={eyeY + r * 0.04} r={r * 0.03} fill="white" opacity={0.7} />
            <Circle cx={eyeXR + r * 0.04} cy={eyeY + r * 0.04} r={r * 0.03} fill="white" opacity={0.7} />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={eyeXL} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXR} cy={eyeY} r={r * 0.13} fill={dark} />
            <Circle cx={eyeXL - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Circle cx={eyeXR - r * 0.04} cy={eyeY - r * 0.04} r={r * 0.05} fill="white" />
            <Circle cx={eyeXL + r * 0.04} cy={eyeY + r * 0.02} r={r * 0.025} fill="white" opacity={0.7} />
            <Circle cx={eyeXR + r * 0.04} cy={eyeY + r * 0.02} r={r * 0.025} fill="white" opacity={0.7} />
          </G>
        );
    }
  };

  const getMouth = () => {
    const mx = cx;
    const my = cy + r * 0.28;
    switch (emotion) {
      case 'happy':
        return <Path d={`M${mx - r * 0.20} ${my} Q${mx} ${my + r * 0.14} ${mx + r * 0.20} ${my}`}
                     stroke="#6A1B9A" strokeWidth={s * 0.02} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <Path d={`M${mx - r * 0.16} ${my + r * 0.06} Q${mx} ${my - r * 0.06} ${mx + r * 0.16} ${my + r * 0.06}`}
                     stroke="#6A1B9A" strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
      case 'angry':
        return <Path d={`M${mx - r * 0.14} ${my} L${mx + r * 0.14} ${my + r * 0.02}`}
                     stroke="#6A1B9A" strokeWidth={s * 0.022} fill="none" strokeLinecap="round" />;
      case 'surprised':
        return <Ellipse cx={mx} cy={my} rx={r * 0.07} ry={r * 0.09} fill="#6A1B9A" opacity={0.4} />;
      default:
        return <Path d={`M${mx - r * 0.15} ${my} Q${mx} ${my - r * 0.04} ${mx + r * 0.15} ${my}`}
                     stroke="#6A1B9A" strokeWidth={s * 0.018} fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path d={`M${cx} ${cy - r * 1.15} L${cx - r * 0.12} ${cy - r * 0.65} L${cx + r * 0.12} ${cy - r * 0.65} Z`}
            fill="#FFD54F" />
      <Path d={`M${cx - r * 0.04} ${cy - r * 1.0} L${cx + r * 0.04} ${cy - r * 0.85}`}
            stroke="#FFF176" strokeWidth={2} opacity={0.7} />
      <Path d={`M${cx - r * 0.06} ${cy - r * 0.88} L${cx + r * 0.06} ${cy - r * 0.75}`}
            stroke="#FFF176" strokeWidth={2} opacity={0.7} />
      <Path d={`M${cx - r * 0.62} ${cy - r * 0.55} L${cx - r * 0.42} ${cy - r * 0.95} L${cx - r * 0.22} ${cy - r * 0.6} Z`}
            fill={color} />
      <Path d={`M${cx + r * 0.62} ${cy - r * 0.55} L${cx + r * 0.42} ${cy - r * 0.95} L${cx + r * 0.22} ${cy - r * 0.6} Z`}
            fill={color} />
      <Path d={`M${cx - r * 0.55} ${cy - r * 0.58} L${cx - r * 0.42} ${cy - r * 0.85} L${cx - r * 0.28} ${cy - r * 0.62} Z`}
            fill="#F8BBD0" opacity={0.6} />
      <Path d={`M${cx + r * 0.55} ${cy - r * 0.58} L${cx + r * 0.42} ${cy - r * 0.85} L${cx + r * 0.28} ${cy - r * 0.62} Z`}
            fill="#F8BBD0" opacity={0.6} />
      <Circle cx={cx} cy={cy} r={r} fill={color} />
      <Path d={`M${cx + r * 0.65} ${cy - r * 0.55} Q${cx + r * 0.95} ${cy - r * 0.2} ${cx + r * 0.75} ${cy + r * 0.15}`}
            stroke="#E88AED" strokeWidth={r * 0.08} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d={`M${cx + r * 0.72} ${cy - r * 0.48} Q${cx + r * 1.02} ${cy - r * 0.1} ${cx + r * 0.82} ${cy + r * 0.22}`}
            stroke="#82B1FF" strokeWidth={r * 0.06} fill="none" strokeLinecap="round" opacity={0.5} />
      <Ellipse cx={cx} cy={cy + r * 0.12} rx={r * 0.08} ry={r * 0.06} fill="#CE93D8" />

      {getEyes()}
      {getMouth()}

      <Path d={`M${cx - r * 0.7} ${cy - r * 0.3} l${r * 0.06} ${r * 0.02} l${r * 0.02} ${r * 0.06} l${r * 0.02} ${-r * 0.06} l${r * 0.06} ${-r * 0.02} l${-r * 0.06} ${-r * 0.02} l${-r * 0.02} ${-r * 0.06} l${-r * 0.02} ${r * 0.06} Z`}
            fill="#FFD54F" opacity={0.6} />
    </Svg>
  );
}

// ── Waiting face (no face detected) ──
function WaitingOverlay({ size }: { size: number }) {
  const s = size;
  const cx = s / 2;
  const r = s * 0.36;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ position: 'absolute' }}>
      {/* Question mark floating above */}
      <Path d={`M${cx + r * 0.55} ${s * 0.06} Q${cx + r * 0.68} ${s * 0.02} ${cx + r * 0.55} ${s * -0.02} Q${cx + r * 0.40} ${s * -0.06} ${cx + r * 0.52} ${s * -0.02}`}
            stroke="#BDBDBD" strokeWidth={s * 0.025} fill="none" strokeLinecap="round" />
      <Circle cx={cx + r * 0.55} cy={s * 0.11} r={r * 0.04} fill="#BDBDBD" />
      {/* Zzz hint */}
      <Path d={`M${cx - r * 0.85} ${s * 0.18} l${r * 0.15} 0 l${-r * 0.15} ${r * 0.1} l${r * 0.15} 0`}
            stroke="#BDBDBD" strokeWidth={s * 0.018} fill="none" strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export const VirtualPet: React.FC<VirtualPetProps> = ({
  emotion,
  petType = 'dog',
  size = 200,
  animate = true,
  faceDetected = true,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const auraAnim = useRef(new Animated.Value(0.2)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  const effectiveEmotion = faceDetected ? emotion : 'waiting';
  const config = EMOTION_ANIMATIONS[effectiveEmotion] || EMOTION_ANIMATIONS.neutral;
  const emotionColor = faceDetected
    ? (EMOTION_COLORS[emotion]?.bg || EMOTION_COLORS.neutral.bg)
    : '#BDBDBD';
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!animate) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(1);
    }

    // Bounce (happy/surprised)
    if (config.bounce) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -16, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      ).start();
    } else {
      bounceAnim.setValue(0);
    }

    // Shake (angry/fearful)
    if (config.shake) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -5, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
          Animated.delay(400),
        ])
      ).start();
    } else {
      shakeAnim.setValue(0);
    }

    // Pulse (sad/anxious)
    if (config.pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.94, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }

    // Float (happy/neutral)
    if (config.float) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      floatAnim.setValue(0);
    }

    if (config.tilt) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(tiltAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(tiltAnim, { toValue: -1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(tiltAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      tiltAnim.setValue(0);
    }

    if (config.aura) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(auraAnim, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
          Animated.timing(auraAnim, { toValue: 0.15, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      auraAnim.setValue(0.08);
    }

    return () => {
      bounceAnim.stopAnimation();
      shakeAnim.stopAnimation();
      pulseAnim.stopAnimation();
      floatAnim.stopAnimation();
      tiltAnim.stopAnimation();
      auraAnim.stopAnimation();
    };
  }, [emotion, animate, faceDetected]);

  const renderPet = () => {
    const petEmotion = faceDetected ? emotion : 'neutral';
    let face;
    switch (petType) {
      case 'cat': face = <CatFace emotion={petEmotion} size={size} />; break;
      case 'bunny': face = <BunnyFace emotion={petEmotion} size={size} />; break;
      case 'bear': face = <BearFace emotion={petEmotion} size={size} />; break;
      case 'fox': face = <FoxFace emotion={petEmotion} size={size} />; break;
      case 'panda': face = <PandaFace emotion={petEmotion} size={size} />; break;
      case 'owl': face = <OwlFace emotion={petEmotion} size={size} />; break;
      case 'seal': face = <SealFace emotion={petEmotion} size={size} />; break;
      case 'hamster': face = <HamsterFace emotion={petEmotion} size={size} />; break;
      case 'penguin': face = <PenguinFace emotion={petEmotion} size={size} />; break;
      case 'capybara': face = <CapybaraFace emotion={petEmotion} size={size} />; break;
      case 'unicorn': face = <UnicornFace emotion={petEmotion} size={size} />; break;
      default: face = <DogFace emotion={petEmotion} size={size} />; break;
    }
    if (!faceDetected) {
      return (
        <View style={{ width: size, height: size }}>
          {face}
          <WaitingOverlay size={size} />
        </View>
      );
    }
    return face;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [
            { translateY: Animated.add(bounceAnim, floatAnim) },
            { translateX: shakeAnim },
            {
              rotate: tiltAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ['-4deg', '0deg', '4deg'],
              }),
            },
            { scale: Animated.multiply(scaleAnim, pulseAnim) },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.floorShadow,
          {
            width: size * 0.52,
            height: size * 0.12,
            borderRadius: size * 0.07,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.aura,
          {
            width: size * 0.86,
            height: size * 0.86,
            borderRadius: size * 0.43,
            backgroundColor: emotionColor,
            opacity: auraAnim,
            transform: [
              {
                scale: auraAnim.interpolate({
                  inputRange: [0.1, 0.35],
                  outputRange: [0.9, 1.06],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.sparkle,
          styles.sparkleOne,
          {
            opacity: 0.28,
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [-8, 0],
                  outputRange: [-2, 2],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.sparkle,
          styles.sparkleTwo,
          {
            opacity: 0.22,
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [-8, 0],
                  outputRange: [2, -2],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.sparkle,
          styles.sparkleThree,
          {
            opacity: 0.2,
          },
        ]}
      />
      {renderPet()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
  },
  floorShadow: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: '#0C22311A',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  sparkleOne: {
    top: 26,
    left: 18,
  },
  sparkleTwo: {
    top: 42,
    right: 16,
    width: 6,
    height: 6,
    borderRadius: 4,
  },
  sparkleThree: {
    top: 18,
    right: 44,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
