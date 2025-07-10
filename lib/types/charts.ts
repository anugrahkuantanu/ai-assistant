export interface ChartData {
  x: (string | number | Date)[];
  y: (string | number | Date)[];
  xLabel: string;
  yLabel: string;
}

export interface PlotlyTrace {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  labels?: string[];
  values?: number[];
  z?: (string | number)[][];
  mode?: string;
  type: string;
  name: string;
  marker?: {
    color?: string | string[];
    [key: string]: unknown;
  };
  fill?: string;
  colorscale?: string;
  [key: string]: unknown;
}

export interface ChartLayout {
  title: string;
  xaxis: {
    title: string;
  };
  yaxis: {
    title: string;
  };
  responsive: boolean;
  [key: string]: unknown;
}

export interface ChartConfig {
  type: string;
  title: string;
  plotlyType: string;
  plotlyData: PlotlyTrace[];
  layout: ChartLayout;
  data: ChartData;
}

export interface ChartToolResponse {
  success: boolean;
  fileName: string;
  chartConfig: ChartConfig;
  chartType: string;
  xColumn: string;
  yColumn: string;
  title: string;
  dataPoints: number;
  error?: string;
}

export interface MultiChartResponse {
  success: boolean;
  fileName: string;
  analysisType: string;
  charts: ChartConfig[];
  chartCount: number;
  dataAnalysis: {
    columns: Array<{
      name: string;
      type: string;
      sample: (string | number | Date | boolean)[];
    }>;
    suggestedCharts: string[];
  };
  error?: string;
}

export interface DataAnalysisResponse {
  success: boolean;
  fileName: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    sample: (string | number | Date | boolean)[];
  }>;
  suggestedCharts: string[];
  recommendations: {
    bestForTrends: string;
    bestForComparison: string;
    bestForDistribution: string;
    bestForParts: string;
  };
  error?: string;
}