export function generateHtml(spec: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocketDocs Explorer - ${spec.info.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    body { font-family: 'Inter', sans-serif; }
    pre, code { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-200">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-72 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 h-screen overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-10">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h1 class="font-bold text-xl tracking-tight text-white">SocketDocs</h1>
        </div>

        <div class="space-y-8">
          ${Object.entries(spec.namespaces).map(([name, ns]: [string, any]) => `
            <div>
              <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Namespace: ${name}</h2>
              <div class="space-y-1">
                ${Object.keys(ns.events).map(evtName => `
                  <a href="#${name}-${evtName}" class="block px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all truncate">
                    ${evtName}
                  </a>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 p-12 max-w-5xl mx-auto overflow-x-hidden">
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <span class="px-2 py-1 bg-blue-600/10 text-blue-400 text-xs font-mono font-bold rounded border border-blue-500/20">v${spec.info.version}</span>
          <span class="text-slate-600">/</span>
          <span class="text-slate-400 font-mono text-xs">spec v${spec.specVersion}</span>
        </div>
        <h1 class="text-5xl font-extrabold text-white mb-6 tracking-tight">${spec.info.name}</h1>
        <p class="text-xl text-slate-400 leading-relaxed max-w-3xl">${spec.info.description || "No description provided."}</p>
        
        ${spec.security && spec.security.length > 0 ? `
          <div class="mt-10 p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
            <h2 class="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Security & Authentication</h2>
            <div class="grid gap-4">
              ${spec.security.map((s: any) => `
                <div class="flex items-start gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                  <div class="p-2 bg-blue-600/10 rounded-lg text-blue-400">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-bold text-white">${s.name}</h3>
                      <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">${s.type}</span>
                      ${s.in ? `<span class="px-2 py-0.5 rounded bg-blue-500/10 text-[10px] font-bold text-blue-400 uppercase">In: ${s.in}</span>` : ""}
                    </div>
                    <p class="text-sm text-slate-400">${s.description || "No description provided."}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </header>

      <div class="space-y-24">
        ${Object.entries(spec.namespaces).map(([nsName, ns]: [string, any]) => `
          <section id="ns-${nsName}">
            <div class="flex items-center gap-4 mb-10 pb-4 border-b border-slate-800">
              <h2 class="text-2xl font-bold text-white uppercase tracking-tight">${nsName}</h2>
              <span class="text-slate-500 text-sm">Namespace</span>
            </div>
            
            <div class="grid gap-10">
              ${Object.entries(ns.events).map(([evtName, event]: [string, any]) => `
                <div id="${nsName}-${evtName}" class="group relative bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300 shadow-xl shadow-black/20">
                  <div class="p-8">
                    <div class="flex items-start justify-between mb-6">
                      <div>
                        <div class="flex items-center gap-3 mb-3">
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                            event.direction === 'client_to_server' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            event.direction === 'server_to_client' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }">
                            ${event.direction.replace(/_/g, " ")}
                          </span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
                            ${event.type.replace(/_/g, " ")}
                          </span>
                          ${event.authRequired ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">AUTH</span>' : ""}
                        </div>
                        <h3 class="text-2xl font-bold text-white tracking-tight">${evtName}</h3>
                      </div>
                      <a href="#${nsName}-${evtName}" class="p-2 text-slate-600 hover:text-blue-400 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                      </a>
                    </div>
                    
                    <p class="text-slate-400 text-lg mb-8">${event.summary || event.description || "No description provided."}</p>

                    ${event.errors && event.errors.length > 0 ? `
                      <div class="mb-8">
                        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-3">Possible Errors</h4>
                        <div class="grid gap-2">
                          ${event.errors.map((err: any) => `
                            <div class="flex items-center gap-3 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg">
                              <span class="font-mono text-xs font-bold text-red-400">${err.code}</span>
                              <span class="text-sm text-slate-400">${err.description}</span>
                            </div>
                          `).join("")}
                        </div>
                      </div>
                    ` : ""}

                    <div class="grid lg:grid-cols-2 gap-8">
                      ${event.payloadSchema ? `
                        <div class="space-y-3">
                          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Payload Schema</h4>
                          <div class="relative group">
                            <pre class="rounded-xl overflow-hidden text-xs"><code class="language-json">${JSON.stringify(event.payloadSchema, null, 2)}</code></pre>
                            <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)" class="absolute top-3 right-3 p-2 bg-slate-800 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                          </div>
                        </div>
                      ` : ""}
                      ${event.responseSchema ? `
                        <div class="space-y-3">
                          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Response Schema</h4>
                          <div class="relative group">
                            <pre class="rounded-xl overflow-hidden text-xs"><code class="language-json">${JSON.stringify(event.responseSchema, null, 2)}</code></pre>
                            <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)" class="absolute top-3 right-3 p-2 bg-slate-800 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                          </div>
                        </div>
                      ` : ""}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>

      <footer class="mt-32 pt-12 border-t border-slate-800 text-slate-600 text-sm flex items-center justify-between">
        <p>&copy; 2024 SocketDocs. Built for senior-grade WebSocket development.</p>
        <div class="flex items-center gap-6">
          <a href="#" class="hover:text-blue-400 transition-colors">Documentation</a>
          <a href="#" class="hover:text-blue-400 transition-colors">GitHub</a>
        </div>
      </footer>
    </main>
  </div>
  <script>hljs.highlightAll();</script>
</body>
</html>
  `;
}
