// DOM Elements - Cache for performance
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const proxyFrame = document.getElementById('proxyFrame');
const devToolsBtn = document.getElementById('devToolsBtn');
const consolePanel = document.getElementById('consolePanel');
const closeConsole = document.getElementById('closeConsole');
const clearConsole = document.getElementById('clearConsole');
const consoleOutput = document.getElementById('consoleOutput');
const consoleInput = document.getElementById('consoleInput');
const executeBtn = document.getElementById('executeBtn');
const pingValue = document.getElementById('pingValue');

// State
let consoleOpen = false;
let currentUrl = '';
let pingInterval = null;
let messageQueue = [];
let isProcessingQueue = false;

// Performance optimization: Batch DOM updates
function processMesageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    
    isProcessingQueue = true;
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        
        while (messageQueue.length > 0) {
            const msg = messageQueue.shift();
            fragment.appendChild(msg);
        }
        
        consoleOutput.appendChild(fragment);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        isProcessingQueue = false;
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners with passive option for better scrolling performance
    goBtn.addEventListener('click', loadUrl, false);
    urlInput.addEventListener('keypress', handleUrlKeypress, false);
    devToolsBtn.addEventListener('click', toggleConsole, false);
    closeConsole.addEventListener('click', toggleConsole, false);
    clearConsole.addEventListener('click', clearConsoleOutput, false);
    executeBtn.addEventListener('click', executeCode, false);
    consoleInput.addEventListener('keypress', handleConsoleKeypress, false);
    
    // Frame events
    proxyFrame.addEventListener('load', handleFrameLoad, false);
    proxyFrame.addEventListener('error', handleFrameError, false);
    
    // Start ping monitoring
    startPingMonitor();
    
    // Prefetch DNS for common sites
    prefetchDNS();
    
    // Focus on input
    urlInput.focus();
});

// Handle URL input keypress
function handleUrlKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        loadUrl();
    }
}

// Handle console keypress
function handleConsoleKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        executeCode();
    }
}

// Load URL function - Ultra Optimized
function loadUrl() {
    let url = urlInput.value.trim();
    
    if (!url) {
        addConsoleMessage('⚠️ Please enter a URL', 'error');
        return;
    }
    
    const startTime = performance.now();
    
    // Check if it's a search query or URL
    if (!url.includes('.') || url.includes(' ')) {
        // DuckDuckGo search
        url = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
        addConsoleMessage(`🔍 Searching: "${urlInput.value}"`, 'info');
    } else {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        addConsoleMessage(`⚡ Loading: ${url}`, 'info');
    }
    
    currentUrl = url;
    
    // Store start time for load measurement
    proxyFrame.dataset.startTime = startTime;
    
    // Load through proxy
    const proxyUrl = `/proxy?url=${encodeURIComponent(url)}`;
    proxyFrame.src = proxyUrl;
}

// Handle frame load
function handleFrameLoad() {
    const startTime = parseFloat(proxyFrame.dataset.startTime);
    if (startTime) {
        const loadTime = Math.round(performance.now() - startTime);
        addConsoleMessage(`✅ Loaded in ${loadTime}ms`, 'success');
        updatePing(loadTime);
        delete proxyFrame.dataset.startTime;
    }
}

// Handle frame error
function handleFrameError() {
    addConsoleMessage('❌ Failed to load page', 'error');
    updatePing(0);
}

// Toggle console
function toggleConsole() {
    consoleOpen = !consoleOpen;
    
    if (consoleOpen) {
        consolePanel.classList.add('open');
        consoleInput.focus();
        addConsoleMessage('🔧 DevTools opened', 'info');
    } else {
        consolePanel.classList.remove('open');
    }
}

// Clear console output
function clearConsoleOutput() {
    consoleOutput.innerHTML = '';
    addConsoleMessage('🗑️ Console cleared', 'info');
}

// Execute JavaScript code - Ultra Fast
function executeCode() {
    const code = consoleInput.value.trim();
    
    if (!code) return;
    
    addConsoleMessage(`> ${code}`, 'info');
    
    const startTime = performance.now();
    
    try {
        let result;
        
        // Try to execute in iframe context first
        try {
            const iframeWindow = proxyFrame.contentWindow;
            if (iframeWindow && typeof iframeWindow.eval === 'function') {
                result = iframeWindow.eval(code);
            } else {
                throw new Error('Iframe context not accessible');
            }
        } catch (iframeError) {
            // Fallback to local context
            result = eval(code);
        }
        
        const execTime = (performance.now() - startTime).toFixed(2);
        const resultStr = result !== undefined ? String(result) : 'undefined';
        addConsoleMessage(`← ${resultStr} (${execTime}ms)`, 'success');
        
    } catch (error) {
        const execTime = (performance.now() - startTime).toFixed(2);
        addConsoleMessage(`❌ Error: ${error.message} (${execTime}ms)`, 'error');
    }
    
    // Clear input
    consoleInput.value = '';
}

// Add message to console - Optimized
function addConsoleMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `console-message ${type}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = `[${getTimestamp()}]`;
    
    const messageText = document.createElement('span');
    messageText.className = 'message';
    messageText.textContent = message;
    
    messageDiv.appendChild(timestamp);
    messageDiv.appendChild(messageText);
    
    // Add to queue for batch processing
    messageQueue.push(messageDiv);
    processMesageQueue();
    
    // Limit console messages to prevent memory issues
    if (consoleOutput.children.length > 100) {
        consoleOutput.removeChild(consoleOutput.firstChild);
    }
}

// Get formatted timestamp
function getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Update ping display
function updatePing(ms) {
    if (pingValue) {
        pingValue.textContent = `${ms}ms`;
        
        // Color code based on latency
        const pingIndicator = pingValue.parentElement;
        if (ms < 100) {
            pingIndicator.style.borderColor = 'var(--success-green)';
            pingIndicator.style.color = 'var(--success-green)';
        } else if (ms < 300) {
            pingIndicator.style.borderColor = 'var(--neon-blue)';
            pingIndicator.style.color = 'var(--neon-blue)';
        } else {
            pingIndicator.style.borderColor = '#ff3366';
            pingIndicator.style.color = '#ff3366';
        }
    }
}

// Start ping monitor
function startPingMonitor() {
    // Initial ping
    measurePing();
    
    // Monitor every 5 seconds
    pingInterval = setInterval(measurePing, 5000);
}

// Measure ping to proxy
function measurePing() {
    const startTime = performance.now();
    
    fetch('/proxy?url=https://duckduckgo.com', {
        method: 'HEAD',
        cache: 'no-cache'
    })
    .then(() => {
        const pingTime = Math.round(performance.now() - startTime);
        updatePing(pingTime);
    })
    .catch(() => {
        updatePing(999);
    });
}

// Prefetch DNS for faster initial loads
function prefetchDNS() {
    const domains = [
        'duckduckgo.com',
        'www.google.com',
        'www.wikipedia.org',
        'github.com'
    ];
    
    domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = `//${domain}`;
        document.head.appendChild(link);
    });
}

// Intercept iframe console (if possible)
function interceptIframeConsole() {
    try {
        const iframeWindow = proxyFrame.contentWindow;
        
        if (iframeWindow && iframeWindow.console) {
            const originalLog = iframeWindow.console.log;
            const originalError = iframeWindow.console.error;
            const originalWarn = iframeWindow.console.warn;
            const originalInfo = iframeWindow.console.info;
            
            iframeWindow.console.log = function(...args) {
                addConsoleMessage(`[Page] ${args.join(' ')}`, 'info');
                return originalLog.apply(this, args);
            };
            
            iframeWindow.console.error = function(...args) {
                addConsoleMessage(`[Page Error] ${args.join(' ')}`, 'error');
                return originalError.apply(this, args);
            };
            
            iframeWindow.console.warn = function(...args) {
                addConsoleMessage(`[Page Warning] ${args.join(' ')}`, 'info');
                return originalWarn.apply(this, args);
            };
            
            iframeWindow.console.info = function(...args) {
                addConsoleMessage(`[Page Info] ${args.join(' ')}`, 'info');
                return originalInfo.apply(this, args);
            };
        }
    } catch (e) {
        // Cross-origin restrictions prevent console interception
        // This is expected for most external sites
    }
}

// Try to intercept console when frame loads
proxyFrame.addEventListener('load', () => {
    setTimeout(interceptIframeConsole, 100);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus URL bar
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        urlInput.focus();
        urlInput.select();
    }
    
    // Ctrl/Cmd + Shift + I to toggle DevTools
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        toggleConsole();
    }
    
    // Ctrl/Cmd + L to clear console
    if ((e.ctrlKey || e.metaKey) && e.key === 'l' && consoleOpen) {
        e.preventDefault();
        clearConsoleOutput();
    }
    
    // Escape to close console
    if (e.key === 'Escape' && consoleOpen) {
        toggleConsole();
    }
});

// Add initial welcome message
addConsoleMessage('⚡ Tuff Proxy Ultra - Low Latency Mode Active', 'success');
addConsoleMessage('💡 Shortcuts: Ctrl+K (Focus URL), Ctrl+Shift+I (DevTools), Ctrl+L (Clear)', 'info');

// Performance monitoring
if (window.performance && window.performance.memory) {
    setInterval(() => {
        const memory = window.performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
        const totalMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
        
        // Log memory usage every 30 seconds if DevTools is open
        if (consoleOpen && usedMB > 100) {
            addConsoleMessage(`📊 Memory: ${usedMB}MB / ${totalMB}MB`, 'info');
        }
    }, 30000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (pingInterval) {
        clearInterval(pingInterval);
    }
});

// Service Worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
    // Uncomment to enable service worker
    // navigator.serviceWorker.register('/sw.js')
    //     .then(() => addConsoleMessage('✅ Service Worker registered', 'success'))
    //     .catch(() => addConsoleMessage('⚠️ Service Worker failed', 'error'));
}

// Connection status monitoring
window.addEventListener('online', () => {
    addConsoleMessage('🌐 Connection restored', 'success');
});

window.addEventListener('offline', () => {
    addConsoleMessage('📡 Connection lost', 'error');
});

// Visibility change detection for performance optimization
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Reduce ping frequency when tab is hidden
        if (pingInterval) {
            clearInterval(pingInterval);
        }
    } else {
        // Resume normal ping frequency when tab is visible
        startPingMonitor();
    }
});
