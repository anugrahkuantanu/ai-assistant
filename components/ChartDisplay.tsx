'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg flex items-center justify-center">
    <span className="text-gray-500">Loading chart...</span>
  </div>
});

interface ChartDisplayProps {
  chartConfig: {
    type: string;
    title: string;
    plotlyType: string;
    plotlyData: any[];
    layout: any;
    data: {
      x: any[];
      y: any[];
      xLabel: string;
      yLabel: string;
    };
  };
  className?: string;
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({ chartConfig, className = '' }) => {

  const plotlyConfig = useMemo(() => {
    const config = {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'] as any,
      responsive: true,
    };
    return config;
  }, []);

  const plotData = useMemo(() => {
    if (!chartConfig?.plotlyData || !Array.isArray(chartConfig.plotlyData)) {
      return [];
    }
    
    return chartConfig.plotlyData.map((trace: any) => {
      return {
        ...trace,
        marker: {
          ...trace.marker,
          color: trace.marker?.color || '#3b82f6', // Default blue color
        },
      };
    });
  }, [chartConfig?.plotlyData]);

  const layout = useMemo(() => {
    const baseLayout = {
      autosize: true,
      margin: {
        l: 50,
        r: 30,
        t: 50,
        b: 50,
      },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#374151',
        family: 'Inter, sans-serif',
      },
      showlegend: plotData.length > 1,
    };

    // Merge with chartConfig layout if it exists
    return {
      ...baseLayout,
      ...chartConfig?.layout,
    };
  }, [chartConfig?.layout, plotData.length]);


  if (!chartConfig) {
    return (
      <div className={`border border-red-200 rounded-lg p-6 bg-red-50 ${className}`}>
        <p className="text-red-500 text-center">No chart configuration provided</p>
      </div>
    );
  }

  if (!chartConfig.plotlyData || !Array.isArray(chartConfig.plotlyData) || chartConfig.plotlyData.length === 0) {
    return (
      <div className={`border border-yellow-200 rounded-lg p-6 bg-yellow-50 ${className}`}>
        <p className="text-yellow-600 text-center">No chart data available</p>
        <details className="mt-2">
          <summary className="text-sm cursor-pointer">Debug Info</summary>
          <pre className="text-xs mt-1 bg-white p-2 rounded border overflow-auto">
            {JSON.stringify(chartConfig, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-4 bg-white shadow-sm ${className}`}>
      <div className="w-full h-96">
        <Plot
          data={plotData}
          layout={layout}
          config={plotlyConfig}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          onError={(error) => {
            console.error('Plotly error:', error);
          }}
        />
      </div>
      <div className="mt-2 text-sm text-gray-600">
        <p>
          <strong>Chart Type:</strong> {chartConfig.type} | 
          <strong> Data Points:</strong> {chartConfig.plotlyData[0]?.x?.length || chartConfig.plotlyData[0]?.values?.length || 0}
        </p>
        {chartConfig.data?.xLabel && chartConfig.data?.yLabel && (
          <p>
            <strong>X-Axis:</strong> {chartConfig.data.xLabel} | 
            <strong> Y-Axis:</strong> {chartConfig.data.yLabel}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChartDisplay;