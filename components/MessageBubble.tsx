"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import { BotIcon } from "lucide-react";

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
    // Check if this is a terminal output
    if (text.includes('---START---') && text.includes('---END---')) {
      // For terminal output, just return it as HTML
      const terminalContent = text
        .replace(/---START---\n?/g, '')
        .replace(/\n?---END---/g, '');
      return <div dangerouslySetInnerHTML={{ __html: terminalContent }} />;
    }

    // For regular text, apply our formatting
    const sections = text.split(/(?=###\s)/);

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
