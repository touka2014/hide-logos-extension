const hideConfig = [
    {
        domain: 'youtube.com',
        selectors: ['#logo', 'ytd-topbar-logo-renderer']
    },
    {
        domain: 'x.com',
        selectors: ['h1[role="heading"]']
    }
    // ... 添加更多
];

function hideLogos() {
    const currentDomain = window.location.hostname;
    
    const rules = hideConfig.filter(rule => currentDomain.includes(rule.domain));
    
    if (rules.length === 0) return;

    rules.forEach(rule => {
        rule.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                // 设置样式隐藏，比 remove() 更安全，不容易报错
                el.style.display = 'none';
                el.style.setProperty('display', 'none', 'important');
            });
        });
    });
}

// 1. 初始运行
hideLogos();

// 2. 监听 DOM 变化 (针对 SPA 动态加载)
const observer = new MutationObserver((mutations) => {
    hideLogos();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});