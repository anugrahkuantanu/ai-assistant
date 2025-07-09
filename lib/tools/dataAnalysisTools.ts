import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// Types for data analysis
interface FileData {
  fileName: string;
  uploadDate: string;
  userId: string;
  data: any[][];
}

interface ColumnStats {
  count: number;
  type: string;
  unique: number;
  sample: any[];
}

// Check if uploaded data files are available
export const checkUploadedDataTool = tool(
  async () => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadsDir)) {
        return {
          success: true,
          hasFiles: false,
          fileCount: 0,
          message: "No data files have been uploaded yet. Please upload an Excel or CSV file using the paperclip icon."
        };
      }

      const files = readdirSync(uploadsDir).filter((file: string) => file.endsWith('.json'));
      
      return {
        success: true,
        hasFiles: files.length > 0,
        fileCount: files.length,
        files: files.map((file: string) => file.replace('.json', '')),
        message: files.length > 0 
          ? `Found ${files.length} data file(s) available for analysis.`
          : "No data files have been uploaded yet. Please upload an Excel or CSV file using the paperclip icon."
      };
    } catch (error) {
      return {
        success: false,
        hasFiles: false,
        fileCount: 0,
        error: 'Error checking data file availability.'
      };
    }
  },
  {
    name: 'check_uploaded_data',
    description: 'Check if the user has uploaded any data files (Excel/CSV) that can be analyzed. Use this before attempting to analyze data.',
    schema: z.object({}),
  }
);

// Read and analyze uploaded data
export const readDataTool = tool(
  async ({ fileId, operation }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      
      if (!existsSync(uploadsDir)) {
        return {
          success: false,
          error: "Upload directory not found. Please upload a file first using the paperclip icon."
        };
      }
      
      const filePath = join(uploadsDir, `${fileId}.json`);
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "Data file not found. Please upload a file first using the paperclip icon."
        };
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const fileData: FileData = JSON.parse(fileContent);
      const { fileName, data, uploadDate } = fileData;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: 'No valid data found in the uploaded file.'
        };
      }

      // Basic data analysis operations
      const result: Record<string, any> = {
        success: true,
        fileName,
        uploadDate,
        rowCount: data.length,
        columnCount: data[0]?.length || 0
      };

      switch (operation) {
        case 'preview':
          result.preview = data.slice(0, 10); // First 10 rows
          result.headers = data[0]; // Assuming first row is headers
          break;
          
        case 'summary':
          result.summary = {
            totalRows: data.length,
            totalColumns: data[0]?.length || 0,
            headers: data[0],
            sampleData: data.slice(1, 6) // Skip header, show next 5 rows
          };
          break;
          
        case 'full':
          result.data = data;
          break;
          
        case 'headers':
          result.headers = data[0];
          break;
          
        case 'stats':
          const headers = data[0];
          const dataRows = data.slice(1);
          const stats: Record<string, ColumnStats> = {};
          
          headers.forEach((header: string, index: number) => {
            const columnData = dataRows.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
            stats[header] = {
              count: columnData.length,
              type: typeof columnData[0],
              unique: [...new Set(columnData)].length,
              sample: columnData.slice(0, 5)
            };
          });
          
          result.statistics = stats;
          break;
          
        default:
          result.data = data;
      }

      return result;
      
    } catch (error) {
      return {
        success: false,
        error: `Error reading data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
  {
    name: 'read_data',
    description: `Read and analyze uploaded data files. 
    
    Use this tool when:
    - User asks about uploaded data
    - User wants to see data content or statistics
    - User wants to analyze uploaded files
    
    Operations:
    - preview: Show first 10 rows
    - summary: Show basic file info and sample data
    - full: Return complete dataset
    - headers: Return column headers
    - stats: Return column statistics`,
    schema: z.object({
      fileId: z.string().describe('The ID of the uploaded file to read'),
      operation: z.enum(['preview', 'summary', 'full', 'headers', 'stats']).describe('The type of operation to perform on the data'),
    }),
  }
);

// Query data with filters
export const queryDataTool = tool(
  async ({ fileId, columnName, value, operation }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      
      if (!existsSync(uploadsDir)) {
        return {
          success: false,
          error: "Upload directory not found. Please upload a file first."
        };
      }
      
      const filePath = join(uploadsDir, `${fileId}.json`);
      
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: "Data file not found. Please upload a file first."
        };
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const fileData: FileData = JSON.parse(fileContent);
      const { fileName, data } = fileData;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: 'No valid data found in the uploaded file.'
        };
      }

      const headers = data[0];
      const dataRows = data.slice(1);
      const columnIndex = headers.indexOf(columnName);
      
      if (columnIndex === -1) {
        return {
          success: false,
          error: `Column "${columnName}" not found. Available columns: ${headers.join(', ')}`
        };
      }

      let filteredData = dataRows;
      
      // Apply filters based on operation
      switch (operation) {
        case 'equals':
          filteredData = dataRows.filter(row => row[columnIndex] === value);
          break;
        case 'contains':
          filteredData = dataRows.filter(row => 
            String(row[columnIndex]).toLowerCase().includes(String(value).toLowerCase())
          );
          break;
        case 'greater':
          filteredData = dataRows.filter(row => Number(row[columnIndex]) > Number(value));
          break;
        case 'less':
          filteredData = dataRows.filter(row => Number(row[columnIndex]) < Number(value));
          break;
        case 'not_null':
          filteredData = dataRows.filter(row => 
            row[columnIndex] !== null && row[columnIndex] !== undefined && row[columnIndex] !== ''
          );
          break;
        default:
          filteredData = dataRows;
      }

      return {
        success: true,
        fileName,
        query: { columnName, value, operation },
        totalRows: dataRows.length,
        filteredRows: filteredData.length,
        headers,
        data: filteredData.slice(0, 100) // Limit to first 100 results
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error querying data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
  {
    name: 'query_data',
    description: `Query and filter data from uploaded files.
    
    Use this tool to:
    - Filter data by column values
    - Search for specific records
    - Apply conditions to data
    
    Operations:
    - equals: Find exact matches
    - contains: Find partial matches (case-insensitive)
    - greater: Find values greater than specified
    - less: Find values less than specified
    - not_null: Find non-empty values`,
    schema: z.object({
      fileId: z.string().describe('The ID of the uploaded file to query'),
      columnName: z.string().describe('The name of the column to filter by'),
      value: z.string().optional().describe('The value to filter for (not needed for not_null operation)'),
      operation: z.enum(['equals', 'contains', 'greater', 'less', 'not_null']).describe('The filter operation to apply'),
    }),
  }
);

// Clear uploaded data files
export const clearDataTool = tool(
  async ({ fileId }) => {
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      
      if (fileId) {
        const filePath = join(uploadsDir, `${fileId}.json`);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          return {
            success: true,
            message: `Cleared data file: ${fileId}`
          };
        } else {
          return {
            success: false,
            error: `File ${fileId} not found`
          };
        }
      } else {
        // Clear all files
        if (existsSync(uploadsDir)) {
          const files = readdirSync(uploadsDir).filter((file: string) => file.endsWith('.json'));
          files.forEach((file: string) => {
            unlinkSync(join(uploadsDir, file));
          });
          return {
            success: true,
            message: `Cleared ${files.length} data files`
          };
        } else {
          return {
            success: true,
            message: "No data files to clear"
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Error clearing data files.'
      };
    }
  },
  {
    name: 'clear_data',
    description: 'Clear uploaded data files. Use only when explicitly requested by the user.',
    schema: z.object({
      fileId: z.string().optional().describe('Specific file ID to clear, or leave empty to clear all files'),
    }),
  }
);