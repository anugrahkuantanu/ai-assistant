"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon, ChevronDownIcon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import TimeAgo from "react-timeago";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/lib/context/navigation";
import { useState } from "react";
import { useModelConfig } from "@/components/ModelConfigProvider";

function ChatRow({
  chat,
  onDelete,
}: {
  chat: Doc<"chats">;
  onDelete: (id: Id<"chats">) => void;
}) {
  const router = useRouter();
  const { closeMobileNav } = useNavigation();
  const lastMessage = useQuery(api.messages.getLastMessage, {
    chatId: chat._id,
  });

  const handleClick = () => {
    router.push(`/dashboard/chat/${chat._id}`);
    closeMobileNav();
  };

  return (
    <div
      className="group rounded-xl border border-gray-200/30 bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
      onClick={handleClick}
    >
      <div className="p-4">
        <div className="flex justify-between items-start">
          <p className="text-sm text-gray-600 truncate flex-1 font-medium">
            {lastMessage ? (
              <>
                {lastMessage.role === "user" ? "You: " : "AI: "}
                {lastMessage.content.replace(/\\n/g, "\n")}
              </>
            ) : (
              <span className="text-gray-400">New conversation</span>
            )}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 -mr-2 -mt-2 ml-2 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(chat._id);
            }}
          >
            <TrashIcon className="h-4 w-4 text-gray-400 hover:text-red-500 transition-colors" />
          </Button>
        </div>
        {lastMessage && (
          <p className="text-xs text-gray-400 mt-1.5 font-medium">
            <TimeAgo date={lastMessage.createdAt} />
          </p>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { isMobileNavOpen, closeMobileNav } = useNavigation();

  // Use context for model config
  const { config, setConfig } = useModelConfig();
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // List of available models
  const modelOptions = [
    { label: "GPT-4.1 nano", value: "gpt-4.1-nano-2025-04-14", provider: "openai" },
    { label: "GPT-4.1 mini", value: "gpt-4.1-mini-2025-04-14", provider: "openai" },
    { label: "GPT-4.1", value: "gpt-4.1-2025-04-14", provider: "openai" },
    { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo", provider: "openai" },
    { label: "Claude 3 Opus", value: "claude-3-opus-20240229", provider: "anthropic" },
    { label: "Claude 3 Sonnet", value: "claude-3-sonnet-20240229", provider: "anthropic" },
    { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307", provider: "anthropic" },
  ];

  const chats = useQuery(api.chats.listChats);
  const createChat = useMutation(api.chats.createChat);
  const deleteChat = useMutation(api.chats.deleteChat);

  const handleNewChat = async () => {
    const chatId = await createChat({ title: "New Chat" }); 
    router.push(`/dashboard/chat/${chatId}`);
    closeMobileNav();
  };

  const handleDeleteChat = async (id: Id<"chats">) => {
    await deleteChat({ id });
    // If we're currently viewing this chat, redirect to dashboard
    if (window.location.pathname.includes(id)) {
      router.push("/dashboard");
    }
  };

  return (
    <>
      {/* Background Overlay for mobile */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={closeMobileNav}
        />
      )}

      <div
        className={cn(
          "fixed md:inset-y-0 top-14 bottom-0 left-0 z-50 w-72 bg-gray-50/80 backdrop-blur-xl border-r border-gray-200/50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:top-0 flex flex-col",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Model selection and settings */}
        <div className="p-4 border-b border-gray-200/50 space-y-3">
          <Button
            onClick={() => setShowModelDropdown((v) => !v)}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/50 shadow-sm hover:shadow transition-all duration-200 flex justify-between items-center"
          >
            <span>Choose Model</span>
            <ChevronDownIcon className={`ml-2 transition-transform ${showModelDropdown ? "rotate-180" : "rotate-0"}`} />
          </Button>
          {showModelDropdown && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-md mt-2 p-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                >
                  {modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? "text" : "password"}
                    className="w-full border rounded px-2 py-1 text-sm pr-8"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="Enter API Key"
                  />
                  <button
                    type="button"
                    className="absolute right-2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowApiKey((v) => !v)}
                  >
                    {showApiKey ? <EyeOpenIcon /> : <EyeClosedIcon />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Temperature: <span className="font-semibold">{config.temperature}</span></label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Tokens: <span className="font-semibold">{config.maxTokens}</span></label>
                <input
                  type="number"
                  min={1}
                  max={32768}
                  value={config.maxTokens}
                  onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          )}
          <Button
            onClick={handleNewChat}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/50 shadow-sm hover:shadow transition-all duration-200"
          >
            <PlusIcon className="mr-2 h-4 w-4" /> New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 p-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {chats?.map((chat) => (
            <ChatRow key={chat._id} chat={chat} onDelete={handleDeleteChat} />
          ))}
        </div>
      </div>
    </>
  );
}