import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Clock, ExternalLink, AlertTriangle, Zap, ShieldCheck, Globe, WifiOff, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isMockData, setIsMockData] = useState(false);
  const [activeSource, setActiveSource] = useState('');
  
  const cacheRef = useRef(null);

  const formatContent = (htmlString) => {
    if (!htmlString) return "";
    const text = htmlString.replace(/<[^>]+>/g, '')
                 .replace(/【.*?】/g, '')
                 .replace(/\s+/g, ' ')
                 .trim();
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  const fetchNews = useCallback(async () => {
    setLoading(true);
    let success = false;

    // 严选权威新闻源
    const sources = [
      { name: '律动 BlockBeats', url: 'https://rsshub.app/blockbeats/flash' },
      { name: 'Odaily 星球日报', url: 'https://rsshub.app/odaily/newsflash' },
      { name: 'ChainCatcher', url: 'https://rsshub.app/chaincatcher/newsflash' }
    ];

    // 强化代理策略，增加多重中转
    const proxies = [
      (url) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
      (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    ];

    for (const proxyFn of proxies) {
      if (success) break;
      for (const source of sources) {
        try {
          const targetUrl = proxyFn(source.url);
          const response = await fetch(targetUrl, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) continue;

          let items = [];
          const data = await response.json();
          
          if (targetUrl.includes('rss2json')) {
            items = data.items || [];
          } else if (targetUrl.includes('allorigins')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.contents, "text/xml");
            items = Array.from(xmlDoc.querySelectorAll("item")).map(i => ({
              title: i.querySelector("title")?.textContent,
              description: i.querySelector("description")?.textContent,
              link: i.querySelector("link")?.textContent,
              pubDate: i.querySelector("pubDate")?.textContent
            }));
          }

          if (items.length > 0) {
            const formatted = items.slice(0, 15).map((item, idx) => ({
              id: item.guid || `n-${idx}-${Date.now()}`,
              sourceName: source.name,
              title: (item.title || "加密快讯").trim(),
              content: formatContent(item.description || item.content || ""),
              link: item.link || "#",
              time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '刚刚'
            }));
            setNews(formatted);
            cacheRef.current = formatted;
            setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setIsMockData(false);
            setActiveSource(source.name);
            success = true;
            break;
          }
        } catch (err) { continue; }
      }
    }

    if (!success) {
      if (cacheRef.current) {
        setNews(cacheRef.current);
        setIsMockData(true);
      } else {
        setIsMockData(true);
        setNews([{ id: 'e1', sourceName: '提示', title: '节点同步中', content: '由于全球访问量巨大，请点击刷新尝试连接备用节点。', link: '#', time: 'Wait' }]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-0 m-0">
      <div className="max-w-md mx-auto bg-slate-950 min-h-screen border-x border-slate-800/50 pb-24 shadow-2xl">
        <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20"><Zap className="w-5 h-5 text-white fill-white" /></div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">情报雷达</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isMockData ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                {isMockData ? '离线模式' : `来源: ${activeSource}`}
              </p>
            </div>
          </div>
          <button onClick={fetchNews} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center active:scale-90 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
          </button>
        </header>

        <main className="p-4 space-y-4">
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold px-1 uppercase tracking-tighter">
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Market Intelligence</span>
            <span>更新: {lastUpdated}</span>
          </div>

          {news.map((item) => (
            <div key={item.id} className="bg-slate-900/60 rounded-[24px] p-5 border border-slate-800/50 active:bg-slate-900 transition-colors shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-500/20">{item.sourceName}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {item.time}</span>
              </div>
              <h2 className="text-[16px] font-bold text-white leading-snug mb-2">{item.title}</h2>
              <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-4">{item.content}</p>
              <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-[10px] text-slate-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 严选源</span>
                {item.link !== '#' && <a href={item.link} target="_blank" className="text-xs font-bold text-blue-500">原文详情 →</a>}
              </div>
            </div>
          ))}

          {loading && news.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest">同步情报中...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
