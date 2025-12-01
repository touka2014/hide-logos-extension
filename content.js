/* content.js - V2.0 Stable Version */
// 1. Transparent Icon
const transparentIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
// 2. Mask Title
const maskTitle = "New Tab"; 
// 3. In-page Logo Hiding Rules (Retained from previous version, excluding listener logic)
const styleRules = `
    /* YouTube */
    #logo, ytd-topbar-logo-renderer { opacity: 0 !important; pointer-events: none !important; }
    /* Google */
    .lnXdpd, img[alt="Google"], .logo, a[href^="/webhp"] { opacity: 0 !important; }
    /* X (Twitter) */
    h1[role="heading"] a, a[aria-label="X"], a[aria-label="Twitter"] { opacity: 0 !important; }
    /* Gmail */
    .gb_Kd, a.gb_ve, img.gb_Mc { opacity: 0 !important; }
`;
// Inject CSS (Much better performance than hiding logos via JS loops)
const styleChart = document.createElement('style');
styleChart.textContent = styleRules;
document.head.appendChild(styleChart);
// --- Core Fix: Safe Favicon & Title Replacement Logic ---
function obfuscateTab() {
    // A. Replace Icon
    // Find all icon-related links
    const links = document.head.querySelectorAll("link[rel*='icon']");
    let hasIcon = false;
    links.forEach(link => {
        hasIcon = true;
        // Critical Check: If it is already transparent, do NOT touch it to prevent infinite loops.
        if (link.href !== transparentIcon) {
            link.href = transparentIcon;
        }
    });
    // If no icon tag exists, create one to prevent the browser from loading the default favicon.ico.
    if (!hasIcon) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = transparentIcon;
        document.head.appendChild(link);
    }
    // B. Modify Title (Prevent others from seeing text that reveals you are watching YouTube)
    // Only modify if the title is not the mask title we want.
    if (document.title !== maskTitle) {
        document.title = maskTitle;
    }
}
// --- Execution Logic ---
// 1. Run immediately once
obfuscateTab();
// 2. Use a more elegant listener
// We only listen for changes in the <head> tag, as icons and titles are located there.
// Even if X/Gmail updates page content (body) frequently, it won't trigger here.
const observer = new MutationObserver((mutations) => {
    // Use debouncing or simple checks; avoid executing complex logic on every tiny change.
    // Here we only trigger when child nodes in head are added/removed or attributes change.
    obfuscateTab();
});
observer.observe(document.head, {
    childList: true, // Listen for new tags added to <head>
    attributes: true, // Listen for tag attribute changes in <head> (e.g. Gmail changing icons)
    subtree: true,    // Listen to descendants of <head> (icon tags are usually at the first level, but might be nested)
    attributeFilter: ['href', 'rel'] // Performance optimization: Only care about href and rel attribute changes
});
// 3. Special listener for Title (Some frameworks change title not via head DOM manipulation, but by direct property assignment)
const titleObserver = new MutationObserver(() => {
    if (document.title !== maskTitle) {
        document.title = maskTitle;
    }
});
// Handle cases where the title tag might not exist yet due to the framework not finishing rendering
const titleElement = document.querySelector('title');
if(titleElement) {
    titleObserver.observe(titleElement, { childList: true });
}