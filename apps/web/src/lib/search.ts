type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchResponse = {
  results: SearchResult[];
  provider: string | null;
};

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], provider: null };

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: trimmed,
        search_depth: "basic",
        max_results: maxResults,
      }),
    });
    if (!response.ok) return { results: [], provider: "tavily" };
    const payload = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const results =
      payload.results?.map((item) => ({
        title: item.title ?? "Untitled",
        url: item.url ?? "",
        snippet: item.content ?? "",
      })) ?? [];
    return { results, provider: "tavily" };
  }

  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": serperKey,
      },
      body: JSON.stringify({ q: trimmed, num: maxResults }),
    });
    if (!response.ok) return { results: [], provider: "serper" };
    const payload = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    const results =
      payload.organic?.map((item) => ({
        title: item.title ?? "Untitled",
        url: item.link ?? "",
        snippet: item.snippet ?? "",
      })) ?? [];
    return { results, provider: "serper" };
  }

  return { results: [], provider: null };
}
