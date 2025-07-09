// tools/searchTools.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import puppeteer from 'puppeteer';

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
];

let currentUserAgentIndex = 0;

// Working search implementation using Puppeteer
const performWebSearch = async (query: string, maxResults: number = 8): Promise<any> => {
  let browser;
  try {
    console.log(`🔍 Starting web search for: "${query}"`);
    
    // Launch browser with minimal configuration
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    const userAgent = userAgents[currentUserAgentIndex % userAgents.length];
    currentUserAgentIndex++;
    await page.setUserAgent(userAgent);
    
    // Navigate to DuckDuckGo search
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait for results to load
    await page.waitForSelector('[data-testid="result"]', { timeout: 15000 });
    
    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll('[data-testid="result"]');
      const searchResults = [];
      
      for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
        const element = resultElements[i];
        
        const titleElement = element.querySelector('h2 a');
        const descriptionElement = element.querySelector('[data-result="snippet"]');
        const urlElement = element.querySelector('h2 a') as HTMLAnchorElement;
        
        if (titleElement && urlElement) {
          searchResults.push({
            title: titleElement.textContent?.trim() || 'No title',
            description: descriptionElement?.textContent?.trim() || 'No description available',
            url: urlElement.href || '#'
          });
        }
      }
      
      return searchResults;
    }, maxResults);
    
    await browser.close();
    
    console.log(`✅ Found ${results.length} search results`);
    return {
      results: results,
      query: query
    };
    
  } catch (error: any) {
    console.error(`❌ Web search failed:`, error.message);
    if (browser) {
      await browser.close();
    }
    return null;
  }
};

// Working news search implementation
const performNewsSearch = async (query: string, maxResults: number = 6): Promise<any> => {
  let browser;
  try {
    console.log(`📰 Starting news search for: "${query}"`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    const userAgent = userAgents[currentUserAgentIndex % userAgents.length];
    currentUserAgentIndex++;
    await page.setUserAgent(userAgent);
    
    // Search DuckDuckGo news
    const newsUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=news`;
    await page.goto(newsUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait for news results
    await page.waitForSelector('[data-testid="result"]', { timeout: 15000 });
    
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll('[data-testid="result"]');
      const newsResults = [];
      
      for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
        const element = resultElements[i];
        
        const titleElement = element.querySelector('h2 a');
        const descriptionElement = element.querySelector('[data-result="snippet"]');
        const urlElement = element.querySelector('h2 a') as HTMLAnchorElement;
        const dateElement = element.querySelector('[data-testid="result-extras-url-with-date"]');
        
        if (titleElement && urlElement) {
          newsResults.push({
            title: titleElement.textContent?.trim() || 'No title',
            description: descriptionElement?.textContent?.trim() || 'No description available',
            url: urlElement.href || '#',
            date: dateElement?.textContent?.trim() || null,
            source: 'DuckDuckGo News'
          });
        }
      }
      
      return newsResults;
    }, maxResults);
    
    await browser.close();
    
    console.log(`✅ Found ${results.length} news results`);
    return {
      results: results,
      query: query
    };
    
  } catch (error: any) {
    console.error(`❌ News search failed:`, error.message);
    if (browser) {
      await browser.close();
    }
    return null;
  }
};

// Helper function to generate query variations for retry attempts
const generateQueryVariations = (originalQuery: string): string[] => {
  const variations = [
    originalQuery,
    originalQuery.replace(/\b(how|what|when|where|why|who)\b/gi, '').trim(),
    originalQuery.split(' ').slice(0, -1).join(' '), // Remove last word
    originalQuery.split(' ').slice(1).join(' '), // Remove first word
    originalQuery.replace(/[^\w\s]/g, '').trim(), // Remove special characters
  ].filter(q => q.length > 2); // Filter out very short queries
  
  return [...new Set(variations)]; // Remove duplicates
};

// Helper function to format search results
const formatSearchResults = (results: any, query: string, searchType: string = 'web'): string => {
  if (!results || !results.results || results.results.length === 0) {
    return `No ${searchType} results found for "${query}". Try rephrasing your search query.`;
  }

  const { results: searchResults } = results;
  const maxResults = Math.min(searchResults.length, 8); // Limit to top 8 results
  
  let formattedOutput = `🔍 **${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Search Results for "${query}"**\n\n`;
  
  for (let i = 0; i < maxResults; i++) {
    const result = searchResults[i];
    formattedOutput += `**${i + 1}. ${result.title}**\n`;
    formattedOutput += `${result.description || 'No description available'}\n`;
    formattedOutput += `🔗 ${result.url}\n\n`;
  }
  
  if (searchResults.length > maxResults) {
    formattedOutput += `... and ${searchResults.length - maxResults} more results\n`;
  }
  
  return formattedOutput;
};

// Helper function to format news results
const formatNewsResults = (results: any, query: string): string => {
  if (!results || !results.results || results.results.length === 0) {
    return `No news results found for "${query}". Try searching for current events or recent news.`;
  }

  const { results: newsResults } = results;
  const maxResults = Math.min(newsResults.length, 6); // Limit to top 6 news results
  
  let formattedOutput = `📰 **Latest News for "${query}"**\n\n`;
  
  for (let i = 0; i < maxResults; i++) {
    const result = newsResults[i];
    formattedOutput += `**${i + 1}. ${result.title}**\n`;
    
    if (result.date) {
      formattedOutput += `📅 ${result.date}\n`;
    }
    
    if (result.source) {
      formattedOutput += `📰 Source: ${result.source}\n`;
    }
    
    formattedOutput += `${result.excerpt || result.description || 'No description available'}\n`;
    formattedOutput += `🔗 ${result.url}\n\n`;
  }
  
  return formattedOutput;
};

// Working web search tool
export const webSearchTool = tool(
  async ({ query, maxRetries = 2, safeSearch = true }) => {
    console.log(`🔍 Starting web search for: "${query}"`);
    
    try {
      // Try main search
      const result = await performWebSearch(query, 8);
      
      if (result && result.results && result.results.length > 0) {
        return formatSearchResults(result, query, 'web');
      }
      
      // If no results, try with query variations
      const queryVariations = generateQueryVariations(query);
      
      for (let i = 0; i < Math.min(maxRetries, queryVariations.length); i++) {
        const currentQuery = queryVariations[i];
        console.log(`🔄 Trying query variation: "${currentQuery}"`);
        
        const variationResult = await performWebSearch(currentQuery, 8);
        if (variationResult && variationResult.results && variationResult.results.length > 0) {
          return formatSearchResults(variationResult, query, 'web');
        }
        
        // Add delay between retries
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // If all attempts failed
      return `❌ **Search Temporarily Unavailable**\n\nI'm unable to search for "${query}" right now. This could be due to:\n- Network connectivity issues\n- DuckDuckGo blocking automated requests\n- Service temporarily unavailable\n\n**Alternative:** Search directly at https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      
    } catch (error: any) {
      console.error(`❌ Web search completely failed:`, error.message || error);
      return `❌ **Search Error**\n\nUnexpected error while searching for "${query}": ${error.message || 'Unknown error'}\n\nPlease try again in a few moments.`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for information using DuckDuckGo with Puppeteer scraping. Returns real search results.",
    schema: z.object({
      query: z.string().describe("The search query to look for"),
      maxRetries: z.number().optional().default(2).describe("Maximum number of retry attempts"),
      safeSearch: z.boolean().optional().default(true).describe("Enable safe search filtering")
    }),
  }
);

// Working news search tool
export const newsSearchTool = tool(
  async ({ query, maxRetries = 2, timeframe = 'recent' }) => {
    console.log(`📰 Starting news search for: "${query}"`);
    
    try {
      const result = await performNewsSearch(query, 6);
      
      if (result && result.results && result.results.length > 0) {
        return formatNewsResults(result, query);
      }
      
      // Try with enhanced queries
      const enhancedQueries = [
        `${query} news`,
        `latest ${query}`,
        `${query} today`
      ];
      
      for (let i = 0; i < Math.min(maxRetries, enhancedQueries.length); i++) {
        const currentQuery = enhancedQueries[i];
        console.log(`🔄 Trying enhanced news query: "${currentQuery}"`);
        
        const result = await performNewsSearch(currentQuery, 6);
        if (result && result.results && result.results.length > 0) {
          return formatNewsResults(result, query);
        }
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      return `❌ **News Search Temporarily Unavailable**\n\nI'm unable to find news about "${query}" right now.\n\n**Alternative:** Visit https://duckduckgo.com/?q=${encodeURIComponent(query + ' news')}&iar=news`;
      
    } catch (error: any) {
      console.error(`❌ News search completely failed:`, error.message || error);
      return `❌ **News Search Error**\n\nUnexpected error while searching for news about "${query}": ${error.message || 'Unknown error'}`;
    }
  },
  {
    name: "news_search",
    description: "Search for recent news articles using DuckDuckGo News with Puppeteer scraping. Returns real news results.",
    schema: z.object({
      query: z.string().describe("The news topic to search for"),
      maxRetries: z.number().optional().default(2).describe("Maximum number of retry attempts"),
      timeframe: z.enum(['recent', 'all']).optional().default('recent').describe("Search recent news (past day) or all time")
    }),
  }
);

// Working quick search tool
export const quickSearchTool = tool(
  async ({ query }) => {
    console.log(`⚡ Quick search for: "${query}"`);
    
    try {
      const result = await performWebSearch(query, 3);
      
      if (result && result.results && result.results.length > 0) {
        // Return only top 3 results for quick search
        const topResults = result.results.slice(0, 3);
        let quickOutput = `⚡ **Quick Results for "${query}"**\n\n`;
        
        topResults.forEach((result: any, index: number) => {
          quickOutput += `**${index + 1}. ${result.title}**\n`;
          quickOutput += `${(result.description || '').substring(0, 150)}${result.description && result.description.length > 150 ? '...' : ''}\n`;
          quickOutput += `🔗 ${result.url}\n\n`;
        });
        
        return quickOutput;
      }
      
      return `⚡ **Quick Search Unavailable**\n\nNo quick results found for "${query}". Try the main web search tool instead.`;
      
    } catch (error: any) {
      console.error(`❌ Quick search failed:`, error.message || error);
      return `⚡ **Quick Search Error**\n\nQuick search failed for "${query}": ${error.message || 'Service temporarily unavailable'}`;}
  },
  {
    name: "quick_search",
    description: "Perform a fast search with top 3 results only using Puppeteer scraping. Good for simple factual queries.",
    schema: z.object({
      query: z.string().describe("The search query (keep it simple for best results)")
    }),
  }
);

// Working connection test tool
export const testSearchConnectionTool = tool(
  async () => {
    try {
      console.log("🧪 Testing search connection...");
      
      const testQuery = "test search";
      const result = await performWebSearch(testQuery, 3);
      
      if (result && result.results && result.results.length > 0) {
        console.log("✅ Search connection test successful");
        return `✅ **Search Connection Working**\n\nPuppeteer-based search is working properly.\n- Found ${result.results.length} test results\n- All search tools should function normally\n- Using DuckDuckGo via web scraping`;
      } else {
        console.log("⚠️ Search connection limited");
        return `⚠️ **Search Connection Limited**\n\nSearch test completed but no results returned:\n- DuckDuckGo may be blocking requests\n- Network connectivity issues possible\n- Service may be rate-limited\n\n**Recommendation:** Try again in a few minutes.`;
      }
      
    } catch (error: any) {
      console.error("❌ Search connection test failed:", error.message || error);
      return `❌ **Search Connection Failed**\n\nUnable to perform test search:\n- Error: ${error.message || 'Unknown error'}\n- Puppeteer may not be working properly\n- Network or browser issues possible\n\n**Try:** Checking internet connection and trying again.`;
    }
  },
  {
    name: "test_search_connection",
    description: "Test if the Puppeteer-based search functionality is working properly",
    schema: z.object({}),
  }
);
