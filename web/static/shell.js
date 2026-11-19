// the desktop shell around the page. two exist while the move to Tauri is in progress:
// - python (main.py + server.py): flask serves the page, and the startup files and HDRIs from the same origin
// - tauri (src-tauri/): the page is embedded in the exe, the startup files and HDRIs come from its "av" protocol,
//   which windows' WebView2 reaches at http://av.localhost
// everything here is a no-op under the python shell, where window.__TAURI__ does not exist
const tauri = window.__TAURI__;

export const BACKEND = tauri ? "http://av.localhost" : "";

// url of a bundled HDRI preset, by file name
export function hdriUrl(name){
    return `${BACKEND}/hdri/${encodeURIComponent(name)}`;
}

if(tauri){
    const win = tauri.window.getCurrentWindow();

    // the native title bar follows the page's theme (body.dark, toggled in ui.js) and its <title>
    const sync = ()=>{
        win.setTheme(document.body.classList.contains("dark") ? "dark" : "light").catch(console.error);
        win.setTitle(document.title).catch(console.error);
    };
    new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ["class"]});
    new MutationObserver(sync).observe(document.querySelector("title"), {childList: true, characterData: true, subtree: true});
    sync();

    // the window starts hidden (main.rs). every module has run by the first animation frame (settings.js has
    // restored the theme by then); the second one comes after that state has been painted
    requestAnimationFrame(()=> requestAnimationFrame(()=> win.show().catch(console.error)));
}
