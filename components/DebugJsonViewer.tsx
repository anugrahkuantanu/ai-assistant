"use client";

import React, { useState } from 'react';

interface DebugJsonViewerProps {
  jsonString: string;
}

export const DebugJsonViewer: React.FC<DebugJsonViewerProps> = ({ jsonString }) => {
  const [showRaw, setShowRaw] = useState(false);
  
  let parsedData = null;
  let parseError = null;
  
  try {
    parsedData = JSON.parse(jsonString);
  } catch (error) {
    parseError = error instanceof Error ? error.message : 'Unknown parsing error';
  }
  
  return (
    <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50 my-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-yellow-800">🔍 Debug: JSON Data</h4>
        <button 
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-yellow-600 hover:text-yellow-800"
        >
          {showRaw ? 'Hide Raw' : 'Show Raw'}
        </button>
      </div>
      
      {parseError ? (
        <div className="text-red-600 text-sm">
          <p className="font-medium">JSON Parse Error:</p>
          <p className="text-xs mt-1">{parseError}</p>
        </div>
      ) : (
        <div className="text-green-600 text-sm">
          <p className="font-medium">✅ Valid JSON detected</p>
          <p className="text-xs mt-1">
            Contains: {parsedData?.chartConfig ? 'chartConfig' : ''} 
            {parsedData?.charts ? 'charts array' : ''}
            {parsedData?.success !== undefined ? ` (success: ${parsedData.success})` : ''}
          </p>
        </div>
      )}
      
      {showRaw && (
        <details className="mt-2">
          <summary className="text-xs text-yellow-600 cursor-pointer">Raw JSON (click to expand)</summary>
          <pre className="text-xs mt-1 bg-white p-2 rounded border overflow-x-auto">
            {jsonString}
          </pre>
        </details>
      )}
    </div>
  );
};