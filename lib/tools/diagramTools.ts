import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ChartToolResponse, MultiChartResponse, DataAnalysisResponse } from '../types/charts';

// Detect data types and suggest appropriate chart types
function detectDataTypes(data: any[]): { 
  columns: { name: string; type: string; sample: any[] }[];
  suggestedCharts: string[];
} {
  if (!data || data.length < 2) {
    return { columns: [], suggestedCharts: [] };
  }

  const headers = data[0];
  const dataRows = data.slice(1);
  
  const columns = headers.map((header: string, index: number) => {
    const columnData = dataRows.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
    const sample = columnData.slice(0, 5);
    
    // Detect data type
    let type = 'string';
    if (columnData.length > 0) {
      const firstValue = columnData[0];
      if (typeof firstValue === 'number' || !isNaN(Number(firstValue))) {
        type = 'number';
      } else if (typeof firstValue === 'boolean') {
        type = 'boolean';
      } else if (Date.parse(firstValue)) {
        type = 'date';
      }
    }
    
    return { name: header, type, sample };
  });

  // Suggest appropriate chart types based on data structure
  const suggestedCharts = [];
  const numericColumns = columns.filter((col: { type: string }) => col.type === 'number').length;
  const stringColumns = columns.filter((col: { type: string }) => col.type === 'string').length;
  const dateColumns = columns.filter((col: { type: string }) => col.type === 'date').length;

  if (numericColumns >= 2) {
    suggestedCharts.push('scatter', 'line', 'bar');
  }
  if (numericColumns >= 1 && stringColumns >= 1) {
    suggestedCharts.push('bar', 'pie', 'doughnut');
  }
  if (dateColumns >= 1 && numericColumns >= 1) {
    suggestedCharts.push('line', 'area');
  }
  if (stringColumns >= 1) {
    suggestedCharts.push('bar', 'pie');
  }

  return { columns, suggestedCharts };
}

// Generate chart configuration based on data and user preferences
function generateChartConfig(
  data: any[],
  chartType: string,
  xColumn: string,
  yColumn: string,
  title?: string,
  options?: any
): any {
  const headers = data[0];
  const dataRows = data.slice(1);
  
  const xIndex = headers.indexOf(xColumn);
  const yIndex = headers.indexOf(yColumn);
  
  if (xIndex === -1 || yIndex === -1) {
    throw new Error(`Column not found: ${xIndex === -1 ? xColumn : yColumn}`);
  }

  const xValues = dataRows.map(row => row[xIndex]);
  const yValues = dataRows.map(row => row[yIndex]);

  const config: any = {
    type: chartType,
    title: title || `${yColumn} vs ${xColumn}`,
    data: {
      x: xValues,
      y: yValues,
      xLabel: xColumn,
      yLabel: yColumn
    },
    layout: {
      title: title || `${yColumn} vs ${xColumn}`,
      xaxis: { title: xColumn },
      yaxis: { title: yColumn },
      responsive: true
    }
  };

  // Chart type specific configurations
  switch (chartType) {
    case 'scatter':
      config.plotlyType = 'scatter';
      config.plotlyData = [{
        x: xValues,
        y: yValues,
        mode: 'markers',
        type: 'scatter',
        name: yColumn
      }];
      break;

    case 'line':
      config.plotlyType = 'line';
      config.plotlyData = [{
        x: xValues,
        y: yValues,
        mode: 'lines+markers',
        type: 'scatter',
        name: yColumn
      }];
      break;

    case 'bar':
      config.plotlyType = 'bar';
      config.plotlyData = [{
        x: xValues,
        y: yValues,
        type: 'bar',
        name: yColumn
      }];
      break;

    case 'pie':
      // For pie charts, aggregate data by categories
      const categoryData = dataRows.reduce((acc: any, row) => {
        const category = row[xIndex];
        const value = Number(row[yIndex]) || 0;
        acc[category] = (acc[category] || 0) + value;
        return acc;
      }, {});
      
      config.plotlyType = 'pie';
      config.plotlyData = [{
        labels: Object.keys(categoryData),
        values: Object.values(categoryData),
        type: 'pie',
        name: yColumn
      }];
      break;

    case 'histogram':
      config.plotlyType = 'histogram';
      config.plotlyData = [{
        x: yValues,
        type: 'histogram',
        name: yColumn
      }];
      break;

    case 'box':
      config.plotlyType = 'box';
      config.plotlyData = [{
        y: yValues,
        type: 'box',
        name: yColumn
      }];
      break;

    case 'area':
      config.plotlyType = 'area';
      config.plotlyData = [{
        x: xValues,
        y: yValues,
        fill: 'tozeroy',
        type: 'scatter',
        name: yColumn
      }];
      break;

    case 'heatmap':
      // For heatmap, we need to process the data differently
      config.plotlyType = 'heatmap';
      config.plotlyData = [{
        z: [yValues],
        x: xValues,
        type: 'heatmap',
        colorscale: 'Viridis'
      }];
      break;

    default:
      config.plotlyType = 'scatter';
      config.plotlyData = [{
        x: xValues,
        y: yValues,
        mode: 'markers',
        type: 'scatter',
        name: yColumn
      }];
  }

  // Apply user options if provided
  if (options) {
    config.layout = { ...config.layout, ...options.layout };
    if (options.colors) {
      config.plotlyData[0].marker = { color: options.colors };
    }
  }

  return config;
}

// Analyze data and suggest chart types
export const analyzeDataForChartsTool = tool(
  async ({ fileId }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      const filePath = join(uploadsDir, `${fileId}.json`);
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "Data file not found. Please upload a file first."
        };
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);
      const { fileName, data } = fileData;
      
      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'No data found in the uploaded file.'
        };
      }

      const analysis = detectDataTypes(data);
      
      return {
        success: true,
        fileName,
        rowCount: data.length - 1,
        columns: analysis.columns,
        suggestedCharts: analysis.suggestedCharts,
        recommendations: {
          bestForTrends: analysis.columns.filter(col => col.type === 'date').length > 0 ? 'line' : 'bar',
          bestForComparison: 'bar',
          bestForDistribution: 'histogram',
          bestForParts: 'pie'
        }
      } as DataAnalysisResponse;
      
    } catch (error) {
      return {
        success: false,
        error: `Error analyzing data: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as DataAnalysisResponse;
    }
  },
  {
    name: 'analyze_data_for_charts',
    description: `Analyze uploaded data to suggest appropriate chart types and understand data structure.
    
    Returns a JSON response with the following structure:
    {
      "success": true,
      "fileName": "string",
      "rowCount": number,
      "columns": [
        {
          "name": "string",
          "type": "string|number|date|boolean", 
          "sample": ["sample values array"]
        }
      ],
      "suggestedCharts": ["scatter", "line", "bar", "pie"],
      "recommendations": {
        "bestForTrends": "line|bar",
        "bestForComparison": "bar",
        "bestForDistribution": "histogram", 
        "bestForParts": "pie"
      }
    }
    
    IMPORTANT: Always return the complete JSON response to the user so they can see the data structure and recommendations.
    
    Use this tool to:
    - Understand data types and structure
    - Get chart type recommendations
    - See column information and samples
    - Plan data visualization strategy`,
    schema: z.object({
      fileId: z.string().describe('The ID of the uploaded file to analyze'),
    }),
  }
);

// Create chart/diagram from data
export const createChartTool = tool(
  async ({ fileId, chartType, xColumn, yColumn, title, options }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      const filePath = join(uploadsDir, `${fileId}.json`);
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "Data file not found. Please upload a file first."
        };
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);
      const { fileName, data } = fileData;
      
      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'No data found in the uploaded file.'
        };
      }

      const headers = data[0];
      
      // Validate columns exist
      if (!headers.includes(xColumn)) {
        return {
          success: false,
          error: `Column "${xColumn}" not found. Available columns: ${headers.join(', ')}`
        };
      }
      
      if (!headers.includes(yColumn)) {
        return {
          success: false,
          error: `Column "${yColumn}" not found. Available columns: ${headers.join(', ')}`
        };
      }

      const chartConfig = generateChartConfig(data, chartType, xColumn, yColumn, title, options);
      
      return {
        success: true,
        fileName,
        chartConfig,
        chartType,
        xColumn,
        yColumn,
        title: title || `${yColumn} vs ${xColumn}`,
        dataPoints: data.length - 1
      } as ChartToolResponse;
      
    } catch (error) {
      return {
        success: false,
        error: `Error creating chart: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as ChartToolResponse;
    }
  },
  {
    name: 'create_chart',
    description: `Create charts and diagrams from uploaded data.
    
    Returns a JSON response with the following structure:
    {
      "success": true,
      "fileName": "string",
      "chartConfig": {
        "type": "scatter|line|bar|pie|histogram|box|area|heatmap",
        "title": "string",
        "plotlyType": "string",
        "plotlyData": [
          {
            "x": ["array of x values"],
            "y": ["array of y values"], 
            "type": "string",
            "name": "string",
            "mode": "string (optional)"
          }
        ],
        "layout": {
          "title": "string",
          "xaxis": { "title": "string" },
          "yaxis": { "title": "string" },
          "responsive": true
        },
        "data": {
          "x": ["array of x values"],
          "y": ["array of y values"],
          "xLabel": "string",
          "yLabel": "string"
        }
      },
      "chartType": "string",
      "xColumn": "string", 
      "yColumn": "string",
      "title": "string",
      "dataPoints": number
    }
    
    CRITICAL: When you receive this response, return the ENTIRE JSON response to the user. 
    The UI will automatically detect the chartConfig and render the chart.
    DO NOT modify or summarize the response - return it exactly as received.
    
    Supported chart types:
    - scatter: Scatter plot for numeric data relationships
    - line: Line chart for trends over time
    - bar: Bar chart for comparisons
    - pie: Pie chart for parts of a whole
    - histogram: Distribution of a single variable
    - box: Box plot for statistical distribution
    - area: Area chart for cumulative data
    - heatmap: Heat map for matrix data`,
    schema: z.object({
      fileId: z.string().describe('The ID of the uploaded file to create chart from'),
      chartType: z.enum(['scatter', 'line', 'bar', 'pie', 'histogram', 'box', 'area', 'heatmap']).describe('The type of chart to create'),
      xColumn: z.string().describe('The column to use for X-axis'),
      yColumn: z.string().describe('The column to use for Y-axis'),
      title: z.string().optional().describe('Custom title for the chart'),
      options: z.object({
        colors: z.array(z.string()).optional().describe('Custom colors for the chart'),
        layout: z.object({}).optional().describe('Additional layout options')
      }).optional().describe('Additional chart options')
    }),
  }
);

// Create multiple charts for comprehensive analysis
export const createMultiChartAnalysisTool = tool(
  async ({ fileId, analysisType }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      const filePath = join(uploadsDir, `${fileId}.json`);
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "Data file not found. Please upload a file first."
        };
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);
      const { fileName, data } = fileData;
      
      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'No data found in the uploaded file.'
        };
      }

      const analysis = detectDataTypes(data);
      const charts = [];
      
      // Generate different chart combinations based on analysis type
      switch (analysisType) {
        case 'overview':
          // Create overview charts
          const numericCols = analysis.columns.filter(col => col.type === 'number');
          const stringCols = analysis.columns.filter(col => col.type === 'string');
          
          if (numericCols.length >= 2) {
            charts.push(generateChartConfig(data, 'scatter', numericCols[0].name, numericCols[1].name, 'Correlation Analysis'));
          }
          if (stringCols.length >= 1 && numericCols.length >= 1) {
            charts.push(generateChartConfig(data, 'bar', stringCols[0].name, numericCols[0].name, 'Category Comparison'));
          }
          break;
          
        case 'distribution':
          // Create distribution charts
          const numericColumns = analysis.columns.filter(col => col.type === 'number');
          numericColumns.forEach(col => {
            charts.push(generateChartConfig(data, 'histogram', col.name, col.name, `${col.name} Distribution`));
          });
          break;
          
        case 'comparison':
          // Create comparison charts
          const categoricalCols = analysis.columns.filter(col => col.type === 'string');
          const valueCols = analysis.columns.filter(col => col.type === 'number');
          
          if (categoricalCols.length >= 1 && valueCols.length >= 1) {
            charts.push(generateChartConfig(data, 'bar', categoricalCols[0].name, valueCols[0].name, 'Category Comparison'));
            charts.push(generateChartConfig(data, 'pie', categoricalCols[0].name, valueCols[0].name, 'Category Distribution'));
          }
          break;
          
        case 'trends':
          // Create trend charts
          const dateCols = analysis.columns.filter(col => col.type === 'date');
          const numCols = analysis.columns.filter(col => col.type === 'number');
          
          if (dateCols.length >= 1 && numCols.length >= 1) {
            charts.push(generateChartConfig(data, 'line', dateCols[0].name, numCols[0].name, 'Trend Analysis'));
          }
          break;
          
        default:
          // Default to overview
          const defaultNumeric = analysis.columns.filter(col => col.type === 'number');
          const defaultString = analysis.columns.filter(col => col.type === 'string');
          
          if (defaultNumeric.length >= 2) {
            charts.push(generateChartConfig(data, 'scatter', defaultNumeric[0].name, defaultNumeric[1].name));
          }
          if (defaultString.length >= 1 && defaultNumeric.length >= 1) {
            charts.push(generateChartConfig(data, 'bar', defaultString[0].name, defaultNumeric[0].name));
          }
      }
      
      return {
        success: true,
        fileName,
        analysisType,
        charts,
        chartCount: charts.length,
        dataAnalysis: analysis
      } as MultiChartResponse;
      
    } catch (error) {
      return {
        success: false,
        error: `Error creating analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as MultiChartResponse;
    }
  },
  {
    name: 'create_multi_chart_analysis',
    description: `Create comprehensive data analysis with multiple charts.
    
    Returns a JSON response with the following structure:
    {
      "success": true,
      "fileName": "string",
      "analysisType": "overview|distribution|comparison|trends",
      "charts": [
        {
          "type": "chart type",
          "title": "string", 
          "plotlyType": "string",
          "plotlyData": ["array of plotly traces"],
          "layout": {
            "title": "string",
            "xaxis": { "title": "string" },
            "yaxis": { "title": "string" },
            "responsive": true
          },
          "data": {
            "x": ["array"],
            "y": ["array"], 
            "xLabel": "string",
            "yLabel": "string"
          }
        }
      ],
      "chartCount": number,
      "dataAnalysis": {
        "columns": ["column info array"],
        "suggestedCharts": ["array of chart types"]
      }
    }
    
    CRITICAL: When you receive this response, return the ENTIRE JSON response to the user.
    The UI will automatically detect the charts array and render all charts in a grid layout.
    DO NOT modify or summarize the response - return it exactly as received.
    
    Analysis types:
    - overview: General overview with correlation and comparison charts
    - distribution: Focus on data distribution patterns
    - comparison: Compare categories and values
    - trends: Show trends over time (requires date columns)
    
    Use this tool to:
    - Get comprehensive data insights
    - Create dashboard-like analysis
    - Generate multiple related visualizations`,
    schema: z.object({
      fileId: z.string().describe('The ID of the uploaded file to analyze'),
      analysisType: z.enum(['overview', 'distribution', 'comparison', 'trends']).describe('The type of analysis to perform'),
    }),
  }
);