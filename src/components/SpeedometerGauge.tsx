import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SpeedometerGaugeProps {
  speed: number; // in km/h
  maxSpeed?: number;
  size?: number;
  showTicks?: boolean;
}

export function SpeedometerGauge({
  speed = 0,
  maxSpeed = 160,
  size = 85,
  showTicks = false,
}: SpeedometerGaugeProps) {
  const clampedSpeed = Math.min(Math.max(speed, 0), maxSpeed);
  // Angle range: from -135deg to +135deg (total 270 deg)
  const angle = -135 + (clampedSpeed / maxSpeed) * 270;

  const center = size / 2;
  const radius = size * 0.38;
  const strokeWidth = size * 0.08;

  // Calculate arc path for SVG
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const greenArc = describeArc(center, center, radius, -135, -45);
  const yellowArc = describeArc(center, center, radius, -45, 45);
  const redArc = describeArc(center, center, radius, 45, 135);

  // Needle tip
  const needleLength = radius * 0.8;
  const needleTip = polarToCartesian(center, center, needleLength, angle);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Soft background shadow glow */}
        <Circle cx={center} cy={center} r={radius * 1.15} fill="#FFF5F5" />

        {/* Speed Arcs: Green, Yellow, Red */}
        <Path
          d={greenArc}
          fill="none"
          stroke="#22C55E"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Path
          d={yellowArc}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={strokeWidth}
        />
        <Path
          d={redArc}
          fill="none"
          stroke="#EF4444"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Needle */}
        <Line
          x1={center}
          y1={center}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#1F2937"
          strokeWidth={size > 100 ? 3 : 2}
          strokeLinecap="round"
        />
        <Circle cx={center} cy={center} r={size > 100 ? 4 : 3} fill="#1F2937" />
      </Svg>

      {/* Speed Value readout */}
      <View style={styles.textContainer}>
        {showTicks && size > 100 && (
          <View style={styles.ticksOverlay}>
            <Text style={[styles.tickText, { left: 16, top: 22 }]}>50</Text>
            <Text style={[styles.tickText, { alignSelf: 'center', top: 6 }]}>100</Text>
            <Text style={[styles.tickText, { right: 16, top: 22 }]}>150</Text>
          </View>
        )}
        <Text style={[styles.speedText, { fontSize: size > 100 ? 16 : 13 }]}>
          {Math.round(clampedSpeed)}
        </Text>
        <Text style={[styles.unitText, { fontSize: size > 100 ? 10 : 9 }]}>km/h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
    bottom: '12%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontWeight: '800',
    color: '#111827',
    lineHeight: 16,
  },
  unitText: {
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 1,
  },
  ticksOverlay: {
    position: 'absolute',
    top: -40,
    width: 100,
    height: 60,
  },
  tickText: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },
});

