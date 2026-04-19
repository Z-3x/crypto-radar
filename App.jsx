import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Clock, ExternalLink, AlertTriangle, Zap, Newspaper, ShieldCheck, Globe, WifiOff, Share2, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isMockData, setIsMockData] = useState(false);
  const [activeSource, setActiveSource] = useState('');
  const [statusMsg, setStatusMsg] = useState('正在初始化...');
  
  const cacheRef = useRef(null);

  // 清除HTML标签、精简内容，专门为移动端阅读优化
  const formatContent = (htmlString) => {
    if (!htmlString) return "";
    try {
      const doc = new DOMParser().parseFromString(htmlString, 'text/html');
      // 移除脚本和样式
      const scripts = doc.querySelectorAll('script, style');
      scripts.forEach(s => s.remove());
      
      let text = doc.body.textContent || "";
      // 过滤常见的垃圾字符和广告前缀
      text = text.replace(/【.*?】/g, '') // 移除媒体自有的标题标签
                 .replace(/律动.*?快讯/g, '')
                 .replace(/\s+/g, ' ')
                 .trim();
                 
      return text.length > 120 ? text.substring(0, 120) + '...' : text;
    } catch (e) {
      return htmlString.substring(0, 120);
    }
  };

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setStatusMsg('正在连接情报节点...');
    let success = false;

    // 严选权威新闻源，保证真实性
    const sources = [
      { name: '律动 BlockBeats', url: 'https://rsshub.app/blockbeats/flash' },
      { name: 'Odaily 星球日报', url: 'https://rsshub.app/odaily/newsflash' },
      { name: 'ChainCatcher', url: 'https://rsshub.app/chaincatcher/newsflash' }
    ];

    // 多重代理轮询机制，解决微信端跨域限制
    const proxies = [
      (url) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
      (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&ts=${Date.now()}`
    ];

    for (const proxyFn of proxies) {
      if (success) break;

      for (const source of sources) {
        try {
          const targetUrl = proxyFn(source.url);
          const response = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
          
          if (!response.ok) continue;

          let formattedNews = [];

          if (targetUrl.includes('rss2json')) {
            const data = await response.json();
            if (data.status === 'ok' && data.items?.length > 0) {
              formattedNews = data.items.slice(0, 15).map((item, idx) => ({
                id: item.guid || `news-${idx}-${Date.now()}`,
                sourceName: source.name,
                title: item.title?.replace(/<[^>]+>/g, '').trim() || "无题快讯",
                content: formatContent(item.description || item.content),
                link: item.link || "#",
                time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '刚刚'
              }));
            }
          } else {
            let xmlText = "";
            if (targetUrl.includes('allorigins')) {
              const data = await response.json();
              xmlText = data.contents;
            } else {
              xmlText = await response.text();
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            if (xmlDoc.getElementsByTagName("parsererror").length === 0) {
              const items = xmlDoc.querySelectorAll("item");
              formattedNews = Array.from(items).slice(0, 15).map((item, idx) => ({
                id: `xml-${idx}-${Date.now()}`,
                sourceName: source.name,
                title: (item.querySelector("title")?.textContent || "无题快讯").replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                content: formatContent((item.querySelector("description")?.textContent || "").replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')),
                link: item.querySelector("link")?.textContent || "#",
                time: item.querySelector("pubDate")?.textContent ? new Date(item.querySelector("pubDate").textContent).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '刚刚'
              }));
            }
          }

          if (formattedNews.length > 0) {
            setNews(formattedNews);
            cacheRef.current = formattedNews;
            setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setIsMockData(false);
            setActiveSource(source.name);
            success = true;
            break;
          }
        } catch (err) {
          console.warn(`代理请求失败，正在切换下一节点...`);
        }
      }
    }

    if (!success) {
      if (cacheRef.current) {
        setNews(cacheRef.current);
        setIsMockData(true);
      } else {
        setIsMockData(true);
        setActiveSource('离线监控');
        setNews([
          {
            id: 'err-1',
            sourceName: '情报中心',
            title: '数据链路连接受阻',
            content: '由于当前访问频率较高，实时快讯连接暂时断开。系统已为您自动排队重连，请保持页面开启或尝试手动刷新。',
            link: '#',
            time: '连接中'
          },
          {
            id: 'err-2',
            sourceName: '风控提示',
            title: '炒币用户风险管理建议',
            content: '在资讯恢复前，请勿进行大额杠杆操作。行情剧烈波动时，请以交易软件实时价格为准。',
            link: '#',
            time: '置顶'
          }
        ]);
        setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // 1分钟高频刷新，适合炒币用户
    return () => clearInterval(interval);
  }, [fetchNews]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans antialiased">
      <div className="max-w-md mx-auto relative bg-[#020617] min-h-screen border-x border-slate-800/40 pb-20">
        
        {/* Header - 适配微信顶部样式 */}
        <header className="sticky top-0 z-30 bg-[#020617]/95 backdrop-blur-xl border-b border-slate-800/60 px-5 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  情报雷达 <span className="bg-blue-500/10 text-blue-500 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-500/20">LIVE</span>
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isMockData ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                  {activeSource || '系统就绪'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
               <button onClick={fetchNews} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center active:scale-90 transition-all">
                <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 space-y-4">
          
          {/* Market Status Summary */}
          <div className="grid grid-cols-2 gap-3 px-1 mb-2">
            <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800/50">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">监控状态</span>
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 实时加密
                </span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800/50">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">同步时间</span>
                <span className="text-xs font-mono text-slate-300">{lastUpdated || '--:--'}</span>
            </div>
          </div>

          {isMockData && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-200/60 leading-relaxed">
                <span className="font-bold text-amber-500 block mb-1">网络连接受限</span>
                预览环境 IP 受限，已尝试自动切换代理。若长时间不更新，请尝试通过移动网络刷新。
              </div>
            </div>
          )}

          {/* 精简新闻流 */}
          <div className="space-y-4">
            {news.map((item, idx) => (
              <div 
                key={item.id} 
                className="group relative bg-[#0f172a] rounded-[28px] p-5 border border-slate-800/50 hover:border-blue-500/40 transition-all duration-300 active:bg-slate-900"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600/10 text-blue-500 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-500/20">
                      {item.sourceName}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.time}
                    </span>
                  </div>
                  {!isMockData && <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />}
                </div>

                <h2 className="text-[16px] font-bold text-white leading-snug mb-2.5 group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h2>
                
                <p className="text-[13.5px] text-slate-400 leading-relaxed line-clamp-4 font-normal">
                  {item.content}
                </p>
                
                <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                  <div className="flex items-center gap-1 text-[11px] text-slate-600">
                    <Zap className="w-3 h-3" />
                    实证推送
                  </div>
                  {item.link !== '#' && (
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 py-1"
                    >
                      阅读原文 <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {loading && news.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-xs text-slate-500 tracking-widest font-bold uppercase">{statusMsg}</p>
            </div>
          )}
          
          <footer className="text-center py-10 opacity-30">
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em]">
              Smart Intelligence Hub • Powered by NewsRadar
            </p>
          </footer>
        </main>

        {/* 底部微信分享引导 */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none">
            <div className="bg-blue-600/90 backdrop-blur-md p-3 rounded-2xl flex items-center justify-between text-white pointer-events-auto shadow-xl shadow-blue-500/20">
                <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs font-bold">微信内点击右上角可收藏此页</span>
                </div>
                <button onClick={() => fetchNews()} className="bg-white text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-lg active:scale-95">
                    立即更新
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
