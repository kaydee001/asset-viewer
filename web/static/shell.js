// the desktop shell around the page (src-tauri/). the page is embedded in the exe; the startup files and HDRIs
// come from its "av" protocol, which windows' WebView2 reaches at http://av.localhost
const tauri = window.__TAURI__;

export const BACKEND = "http://av.localhost";

// url of a bundled HDRI preset, by file name
export function hdriUrl(name){
    return `${BACKEND}/hdri/${encodeURIComponent(name)}`;
}

const win = tauri.window.getCurrentWindow();

// the native title bar follows the page's theme (body.dark, toggled in ui.js) and its <title>. body's class
// changes for many other reasons (loading, panels), so the window is only told when something it shows changed
let shownTheme = null;
let shownTitle = null;
const sync = ()=>{
    const theme = document.body.classList.contains("dark") ? "dark" : "light";
    if(theme !== shownTheme){
        shownTheme = theme;
        win.setTheme(theme).catch(console.error);
    }
    if(document.title !== shownTitle){
        shownTitle = document.title;
        win.setTitle(shownTitle).catch(console.error);
    }
};
new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ["class"]});
new MutationObserver(sync).observe(document.querySelector("title"), {childList: true, characterData: true, subtree: true});
sync();

// the window starts hidden (main.rs). every module has run by the first animation frame (settings.js has
// restored the theme by then); the second one comes after that state has been painted
requestAnimationFrame(()=> requestAnimationFrame(()=> win.show().catch(console.error)));
