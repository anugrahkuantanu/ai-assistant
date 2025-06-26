import React, { createContext, useContext, useState } from "react";

const defaultConfig = {
  model: "gpt-4.1-nano-2025-04-14",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.5,
  maxTokens: 4096,
};

const ModelConfigContext = createContext({
  config: defaultConfig,
  setConfig: (cfg: typeof defaultConfig) => {},
});

export function useModelConfig() {
  return useContext(ModelConfigContext);
}

export function ModelConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(defaultConfig);
  return (
    <ModelConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ModelConfigContext.Provider>
  );
}