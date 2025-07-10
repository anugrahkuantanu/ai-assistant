"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import { BotIcon } from "lucide-react";
import ChartDisplay from './ChartDisplay';
import MultiChartDisplay from './MultiChartDisplay';
import { DebugJsonViewer } from './DebugJsonViewer';
import { ChartToolResponse, MultiChartResponse, DataAnalysisResponse } from '@/lib/types/charts';

interface MessageBubbleProps {
  content: string;
  isUser?: boolean;
}

const formatMessage = (content: string): string => {
  // First unescape backslashes
  content = content.replace(/\\\\/g, "\\");

  // Then handle newlines
  content = content.replace(/\\n/g, "\n");

  // Trim any extra whitespace that might be left
  return content.trim();
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, isUser = false }) => {
  const { user } = useUser();

  const formatText = (text: string) => {
    // Debug: Log incoming text to help debug chart rendering issues
    if (text.includes('chartConfig') || text.includes('charts') || text.includes('"success"')) {
      console.log('🔍 MessageBubble: Potential chart data detected:', text.substring(0, 200) + '...');
    }
    
    // PRIORITY 1: Check for the working format with ---START--- and ---END--- markers
    const startEndMatch = text.match(/---START---([\s\S]*?)---END---/);
    if (startEndMatch) {
      try {
        const jsonStr = startEndMatch[1].trim();
        const toolResponse = JSON.parse(jsonStr);
        console.log('✅ MessageBubble: Successfully parsed JSON from ---START--- markers:', toolResponse);
        
        if (toolResponse.success !== undefined) {
          // Extract the explanatory text before and after the JSON
          const beforeJson = text.substring(0, text.indexOf('---START---')).trim();
          const afterJson = text.substring(text.indexOf('---END---') + 9).trim();
          
          return (
            <div className="space-y-4">
              {beforeJson && (
                <div className="prose prose-sm max-w-none">
                  {processRegularText(beforeJson)}
                </div>
              )}
              {handleChartResponse(toolResponse)}
              {afterJson && (
                <div className="prose prose-sm max-w-none">
                  {processRegularText(afterJson)}
                </div>
              )}
            </div>
          );
        }
      } catch (error) {
        console.log('❌ MessageBubble: Failed to parse JSON from ---START--- markers:', error);
      }
    }
    
    // First, try to parse the entire text as JSON (for clean responses)
    try {
      const toolResponse = JSON.parse(text);
      console.log('✅ MessageBubble: Successfully parsed entire text as JSON:', toolResponse);
      
      // Handle chart tool responses
      if (toolResponse.success !== undefined) {
        return handleChartResponse(toolResponse);
      }
    } catch {
      // Not a clean JSON response, continue with extraction logic
    }
    
    // Extract JSON from mixed text responses (verbose AI responses)
    const jsonMatch = extractJsonFromText(text);
    if (jsonMatch) {
      try {
        // Clean the JSON string before parsing
        let cleanedJson = jsonMatch
          .trim()
          .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/}\s*}$/, '}'); // Remove duplicate closing braces
        
        // Try to find the end of the JSON object if it's incomplete
        if (!cleanedJson.endsWith('}')) {
          const lastBrace = cleanedJson.lastIndexOf('}');
          if (lastBrace > 0) {
            cleanedJson = cleanedJson.substring(0, lastBrace + 1);
          }
        }
        
        console.log('🔧 MessageBubble: Cleaned JSON:', cleanedJson.substring(0, 200) + '...');
        
        const toolResponse = JSON.parse(cleanedJson);
        console.log('✅ MessageBubble: Successfully extracted and parsed JSON:', toolResponse);
        
        // Handle chart tool responses
        if (toolResponse.success !== undefined) {
          return handleChartResponse(toolResponse, text, jsonMatch);
        }
      } catch (error) {
        console.log('❌ MessageBubble: Failed to parse extracted JSON:', error);
        console.log('❌ MessageBubble: Raw JSON that failed:', jsonMatch.substring(0, 300));
        
        // Show debug information to help identify the issue
        return (
          <div className="space-y-4">
            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <p className="text-orange-800 font-medium">⚠️ Chart data detected but failed to parse</p>
              <p className="text-sm text-orange-600 mt-1">JSON parse error: {error instanceof Error ? error.message : 'Unknown error'}</p>
              <details className="mt-2">
                <summary className="text-sm text-orange-600 cursor-pointer">Show raw JSON (click to expand)</summary>
                <pre className="text-xs mt-1 bg-white p-2 rounded border overflow-x-auto">
                  {jsonMatch}
                </pre>
              </details>
            </div>
          </div>
        );
      }
    }
    
    // Legacy handling for old format
    return handleLegacyFormat(text);
  };
  
  // Helper function to extract JSON from mixed text
  const extractJsonFromText = (text: string): string | null => {
    console.log('🔍 MessageBubble: Attempting to extract JSON from text:', text.substring(0, 200) + '...');
    
    // Method 1: Find JSON by counting braces - most reliable for complex nested objects
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for a line that starts with { and contains "success"
      if (line.startsWith('{"success"') || (line.startsWith('{') && line.includes('"success"'))) {
        console.log('🎯 MessageBubble: Found potential JSON start:', line.substring(0, 100));
        
        let jsonStr = line;
        let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        
        // If the line already has balanced braces, try to parse it
        if (braceCount === 0) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
              console.log('✅ MessageBubble: Single line JSON is complete!');
              return line;
            }
          } catch {
            // Continue to multi-line collection
          }
        }
        
        // Collect additional lines until braces are balanced
        let j = i + 1;
        while (j < lines.length && braceCount > 0) {
          const nextLine = lines[j];
          jsonStr += nextLine;
          braceCount += (nextLine.match(/\{/g) || []).length - (nextLine.match(/\}/g) || []).length;
          j++;
          
          // Safety check
          if (j - i > 50) {
            console.log('❌ MessageBubble: Too many lines, stopping');
            break;
          }
        }
        
        // If braces are balanced, try to parse
        if (braceCount === 0) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
              console.log('✅ MessageBubble: Multi-line JSON is complete!');
              return jsonStr;
            }
          } catch (error) {
            console.log('❌ MessageBubble: Multi-line JSON parse failed:', error);
          }
        }
        
        // If we still don't have balanced braces, try to find the end manually
        if (braceCount !== 0) {
          console.log('⚠️ MessageBubble: Unbalanced braces, trying to find JSON end manually');
          
          // Look for the pattern that suggests end of our JSON object
          const remainingText = text.substring(text.indexOf(line));
          
          // Find patterns that typically come after our JSON
          const endPatterns = [
            /\}\s*\}\\*\s*This is the JSON response/,  // Handle } }\ pattern
            /\}\s*\}\\*$/,  // Handle } }\ at end
            /\}\s*This is the JSON response/,
            /\}\s*The chart is ready/,
            /\}\s*$/,
            /\}\s*\n\s*[A-Z]/,  // } followed by a sentence starting with capital
            /\}\s*\n.*chart.*ready/i,  // } followed by "chart ready" text
          ];
          
          for (const pattern of endPatterns) {
            const endMatch = remainingText.match(pattern);
            if (endMatch) {
              const endIndex = text.indexOf(line) + endMatch.index! + 1; // +1 to include the }
              const extractedJson = text.substring(text.indexOf(line), endIndex);
              
              try {
                const parsed = JSON.parse(extractedJson);
                if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
                  console.log('✅ MessageBubble: Found JSON end with pattern matching!');
                  return extractedJson;
                }
              } catch (error) {
                console.log('❌ MessageBubble: Pattern-based extraction failed:', error);
              }
            }
          }
        }
      }
    }
    
    // Method 2: Regex-based extraction as fallback
    const patterns = [
      // Handle the specific AI format with } }\ ending
      /(\{\"success\"[\s\S]*?\}\s*\})\\*\s*This is the JSON/,
      // Complete JSON object starting with {"success"
      /(\{\"success\"[\s\S]*?\})\s*(?:This is the JSON|The chart|$)/,
      // Any complete JSON object with chartConfig
      /(\{[\s\S]*?\"chartConfig\"[\s\S]*?\})\s*(?:This is|The chart|$)/,
      // More aggressive pattern for nested objects
      /(\{\"success\"[\s\S]*?\"dataPoints\":\s*\d+\s*\})/,
      // Greedy pattern to capture everything until likely end
      /(\{\"success\"[\s\S]*?\})\s*(?=\w+|$)/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      if (match) {
        console.log(`✅ MessageBubble: Found JSON with regex pattern ${i + 1}`);
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
            return match[1];
          }
        } catch (error) {
          console.log(`❌ MessageBubble: Regex pattern ${i + 1} parse failed:`, error);
        }
      }
    }
    
    // Method 3: Last resort - look for the specific format from CLAUDE.md logs
    console.log('🔍 MessageBubble: Trying last resort extraction');
    
    // Find the JSON start
    const jsonStartIndex = text.indexOf('{"success":true');
    if (jsonStartIndex !== -1) {
      const fromStart = text.substring(jsonStartIndex);
      
      // Look for the end pattern - specifically the pattern from logs
      const endPattern = /(\})\s*\}\\*\s*This is the JSON response/;
      const endMatch = fromStart.match(endPattern);
      
      if (endMatch && endMatch.index !== undefined) {
        const jsonStr = fromStart.substring(0, endMatch.index + 1); // +1 to include the }
        console.log('🎯 MessageBubble: Last resort found JSON:', jsonStr.substring(0, 100) + '...');
        
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
            console.log('✅ MessageBubble: Last resort JSON is valid!');
            return jsonStr;
          }
        } catch (error) {
          console.log('❌ MessageBubble: Last resort parse failed:', error);
        }
      }
      
      // If that didn't work, try finding "dataPoints" as end marker
      const dataPointsPattern = /\"dataPoints\":\s*\d+\s*\}/;
      const dataPointsMatch = fromStart.match(dataPointsPattern);
      if (dataPointsMatch && dataPointsMatch.index !== undefined) {
        const endIndex = dataPointsMatch.index + dataPointsMatch[0].length;
        const jsonStr = fromStart.substring(0, endIndex);
        console.log('🎯 MessageBubble: Using dataPoints as end marker:', jsonStr.substring(0, 100) + '...');
        
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.success !== undefined && (parsed.chartConfig || parsed.charts)) {
            console.log('✅ MessageBubble: DataPoints-based JSON is valid!');
            return jsonStr;
          }
        } catch (error) {
          console.log('❌ MessageBubble: DataPoints-based parse failed:', error);
        }
      }
    }
    
    console.log('❌ MessageBubble: No valid JSON found');
    return null;
  };
  
  // Helper function to handle chart responses
  const handleChartResponse = (toolResponse: any, originalText?: string, extractedJson?: string) => {
    if (toolResponse.chartConfig) {
      // Single chart response
      const response = toolResponse as ChartToolResponse;
      return (
        <div className="space-y-4">
          {originalText && extractedJson && (
            <div className="prose prose-sm max-w-none mb-4">
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                ✅ Chart data successfully extracted and rendered!
              </div>
            </div>
          )}
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-gray-800">Chart Created: {response.title}</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Type:</span> {response.chartType} | 
              <span className="font-medium">Data Points:</span> {response.dataPoints}
            </p>
          </div>
          <ChartDisplay chartConfig={response.chartConfig} />
          {originalText && extractedJson && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Show AI explanation</summary>
              <div className="mt-2 p-2 bg-gray-50 rounded">
                {originalText.replace(extractedJson, '[Chart Data Rendered Above]')}
              </div>
            </details>
          )}
        </div>
      );
    } else if (toolResponse.charts) {
      // Multi-chart response
      const response = toolResponse as MultiChartResponse;
      return (
        <div className="space-y-4">
          {originalText && extractedJson && (
            <div className="prose prose-sm max-w-none mb-4">
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                ✅ Multi-chart data successfully extracted and rendered!
              </div>
            </div>
          )}
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-gray-800">Multi-Chart Analysis: {response.fileName}</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Analysis Type:</span> {response.analysisType} | 
              <span className="font-medium">Charts Generated:</span> {response.chartCount}
            </p>
          </div>
          <MultiChartDisplay 
            charts={response.charts}
            fileName={response.fileName}
            analysisType={response.analysisType}
          />
          {originalText && extractedJson && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Show AI explanation</summary>
              <div className="mt-2 p-2 bg-gray-50 rounded">
                {originalText.replace(extractedJson, '[Chart Data Rendered Above]')}
              </div>
            </details>
          )}
        </div>
      );
    } else if (toolResponse.columns) {
      // Data analysis response
      const response = toolResponse as DataAnalysisResponse;
      return (
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-gray-800">Data Analysis: {response.fileName}</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Rows:</span> {response.rowCount} | 
              <span className="font-medium">Columns:</span> {response.columns.length}
            </p>
            <div className="mt-2">
              <p className="font-medium text-gray-700">Suggested Charts:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {response.suggestedCharts.map((chart, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {chart}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    } else if (!toolResponse.success) {
      // Error response
      return (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-sm text-red-500 mt-1">{toolResponse.error}</p>
        </div>
      );
    }
    
    return null;
  };
  
  // Helper function to handle legacy formats
  const handleLegacyFormat = (text: string) => {

    // Check if this might be JSON that we should debug
    const mightBeJson = text.trim().startsWith('{') && text.trim().endsWith('}');
    if (mightBeJson && (text.includes('chartConfig') || text.includes('charts') || text.includes('success'))) {
      return (
        <div className="space-y-4">
          <DebugJsonViewer jsonString={text} />
          <div className="text-sm text-gray-600">
            The above appears to be chart data that should render as a chart. If you see this debug view instead of a chart, there may be a JSON parsing issue.
          </div>
        </div>
      );
    }
    
    // Check if this is a terminal output (non-chart tools)
    if (text.includes('---START---') && text.includes('---END---') && !text.includes('---CHART-START---')) {
      // For regular terminal output, just return it as HTML
      const terminalContent = text
        .replace(/---START---\n?/g, '')
        .replace(/\n?---END---/g, '');
      return <div dangerouslySetInnerHTML={{ __html: terminalContent }} />;
    }

    // Check if this message contains legacy chart data
    const chartMatch = text.match(/---CHART-START---([\s\S]*?)---CHART-END---/);
    if (chartMatch) {
      try {
        let cleanJsonString = chartMatch[1].trim();
        
        // Handle escaped JSON - this might be double or triple escaped
        // Try to unescape multiple levels of escaping
        const unescapeJson = (str: string): string => {
          let result = str;
          let previousResult = '';
          
          // Keep unescaping until no more changes occur
          while (result !== previousResult) {
            previousResult = result;
            result = result
              .replace(/^\\+/, '')        // Remove leading backslashes
              .replace(/\\+$/, '')        // Remove trailing backslashes
              .replace(/\\n/g, '\n')      // Replace \\n with \n
              .replace(/\\r/g, '\r')      // Replace \\r with \r
              .replace(/\\t/g, '\t')      // Replace \\t with \t
              .replace(/\\"/g, '"')       // Replace \\" with "
              .replace(/\\\\/g, '\\');    // Replace \\\\ with \\
          }
          
          return result.trim();
        };
        
        cleanJsonString = unescapeJson(cleanJsonString);
        
        let chartData;
        try {
          chartData = JSON.parse(cleanJsonString);
        } catch {
          // Try alternative unescaping approach - handle the specific case where JSON starts with backslash
          let alternativeClean = chartMatch[1];
          
          // If it starts with backslash and newline, remove them
          if (alternativeClean.startsWith('\\\n')) {
            alternativeClean = alternativeClean.substring(2);
          } else if (alternativeClean.startsWith('\\')) {
            alternativeClean = alternativeClean.substring(1);
          }
          
          // Remove trailing backslashes and whitespace
          alternativeClean = alternativeClean
            .replace(/\\+$/, '')
            .trim()
            .replace(/\\"/g, '"')        // Unescape quotes
            .replace(/\\\\/g, '\\');     // Unescape backslashes
          
          chartData = JSON.parse(alternativeClean);
        }
        
        // Extract text without chart markers
        const textWithoutChart = text.replace(/---CHART-START---[\s\S]*?---CHART-END---/g, '').trim();
        
        return (
          <div className="space-y-4">
            {textWithoutChart && (
              <div className="prose prose-sm max-w-none">
                {processRegularText(textWithoutChart)}
              </div>
            )}
            {/* Legacy chart rendering */}
            {chartData.charts ? (
              <MultiChartDisplay 
                charts={chartData.charts}
                fileName={chartData.fileName}
                analysisType={chartData.analysisType}
              />
            ) : chartData.chartConfig ? (
              <ChartDisplay chartConfig={chartData.chartConfig} />
            ) : (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <p className="text-red-600 font-medium">Chart data structure not recognized</p>
                <details className="mt-2">
                  <summary className="text-sm text-red-500 cursor-pointer">Chart data (click to expand)</summary>
                  <pre className="text-xs text-red-400 mt-1 whitespace-pre-wrap">{JSON.stringify(chartData, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
        );
      } catch (error) {
        console.error('❌ Error parsing chart data:', error, 'Raw JSON string:', chartMatch[1]);
        return (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <p className="text-red-600 font-medium">Error displaying chart</p>
            <p className="text-sm text-red-500 mt-1">JSON parsing failed: {error instanceof Error ? error.message : 'Unknown error'}</p>
            <details className="mt-2">
              <summary className="text-sm text-red-500 cursor-pointer">Raw data (click to expand)</summary>
              <pre className="text-xs text-red-400 mt-1 whitespace-pre-wrap">{chartMatch[1]}</pre>
            </details>
          </div>
        );
      }
    }

    // For regular text, apply our formatting
    return processRegularText(text);
  };

  const processRegularText = (text: string) => {
    const sections = text.split(/(?=###\s)/);

    return sections.map((section, index) => {
      if (section.trim().startsWith('###')) {
        // Extract header and content
        const [header, ...content] = section.split('\n');
        return (
          <div key={index} className="section mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {header.replace('###', '').trim()}
            </h3>
            <div className="pl-2">{processContent(content.join('\n'))}</div>
          </div>
        );
      }
      return <div key={index}>{processContent(section)}</div>;
    });
  };

  const processContent = (content: string) => {
      // Replace **text** with bold text
      const boldFormatted = content.replace(
        /\*\*(.*?)\*\*/g,
        '<span class="font-bold text-gray-800">$1</span>'
      );

      // Split into lines
      const lines = boldFormatted.split('\n');
      
      return lines.map((line, index) => {
        return (
          <p key={index} className="my-1" dangerouslySetInnerHTML={{ __html: line }} />
        );
      });
    };

  const formattedContent = formatMessage(content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 max-w-[85%] md:max-w-[75%] shadow-sm ring-1 ring-inset relative ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none ring-blue-700"
            : "bg-white text-gray-900 rounded-bl-none ring-gray-200"
        }`}
      >
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {formatText(formattedContent)}
        </div>
        <div
          className={`absolute bottom-0 ${
            isUser
              ? "right-0 translate-x-1/2 translate-y-1/2"
              : "left-0 -translate-x-1/2 translate-y-1/2"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full border-2 ${
              isUser ? "bg-white border-gray-100" : "bg-blue-600 border-white"
            } flex items-center justify-center shadow-sm`}
          >
            {isUser ? (
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <BotIcon className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
