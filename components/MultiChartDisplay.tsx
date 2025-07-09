'use client';

import React from 'react';
import ChartDisplay from './ChartDisplay';

interface MultiChartDisplayProps {
  charts: Array<{
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
  }>;
  fileName: string;
  analysisType: string;
  className?: string;
}

const MultiChartDisplay: React.FC<MultiChartDisplayProps> = ({ 
  charts, 
  fileName, 
  analysisType, 
  className = '' 
}) => {
  if (!charts || charts.length === 0) {
    return (
      <div className={`border border-gray-200 rounded-lg p-6 bg-gray-50 ${className}`}>
        <p className="text-gray-500 text-center">No charts available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Data Analysis: {fileName}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Analysis Type: <span className="capitalize">{analysisType}</span> | 
          Charts Generated: {charts.length}
        </p>
      </div>
      
      <div className={`grid gap-6 ${
        charts.length === 1 ? 'grid-cols-1' : 
        charts.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
        'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
      }`}>
        {charts.map((chart, index) => (
          <div key={index} className="min-h-0">
            <ChartDisplay 
              chartConfig={chart} 
              className="h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiChartDisplay;