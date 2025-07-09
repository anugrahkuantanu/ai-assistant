"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import { BotIcon } from "lucide-react";
import ChartDisplay from './ChartDisplay';
import MultiChartDisplay from './MultiChartDisplay';

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
    // Preprocess text to handle potential escape sequences
    let processedText = text;
    
    // PRIORITY 1: Check if this contains chart tool output (even in terminal format)
    if (processedText.includes('create_chart') || processedText.includes('create_multi_chart_analysis')) {
      // Extract displayMessage from tool response using a more robust regex
      const displayMessageMatch = processedText.match(/"displayMessage":\s*"((?:[^"\\]|\\.)*)"/);
      if (displayMessageMatch) {
        try {
          // The displayMessage is escaped in the JSON, so we need to unescape it
          const unescapedMessage = displayMessageMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          
          // Use the unescaped message for further processing
          processedText = unescapedMessage;
        } catch (error) {
          console.error('Error processing display message:', error);
        }
      }
    }

    // PRIORITY 2: Check if this is a terminal output (non-chart tools)
    if (processedText.includes('---START---') && processedText.includes('---END---') && !processedText.includes('---CHART-START---')) {
      // For regular terminal output, just return it as HTML
      const terminalContent = processedText
        .replace(/---START---\n?/g, '')
        .replace(/\n?---END---/g, '');
      return <div dangerouslySetInnerHTML={{ __html: terminalContent }} />;
    }

    // PRIORITY 3: Check if this message contains chart data
    const chartMatch = processedText.match(/---CHART-START---([\s\S]*?)---CHART-END---/);
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
        } catch (firstError) {
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
        const textWithoutChart = processedText.replace(/---CHART-START---[\s\S]*?---CHART-END---/g, '').trim();
        
        return (
          <div className="space-y-4">
            {textWithoutChart && (
              <div className="prose prose-sm max-w-none">
                {processRegularText(textWithoutChart)}
              </div>
            )}
            {/* Render chart based on data structure */}
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
    return processRegularText(processedText);
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
