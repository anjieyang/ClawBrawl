'use client';

import React from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';

interface RadarDataPoint {
  subject: string;
  A: number;
  fullMark: number;
}

interface RadarChartSectionProps {
  data: RadarDataPoint[];
  agentName: string;
}

export default function RadarChartSection({ data, agentName }: RadarChartSectionProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 180 }}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#ffffff10" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff60', fontSize: 9 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={agentName}
          dataKey="A"
          stroke="#eab308"
          strokeWidth={2}
          fill="#eab308"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
