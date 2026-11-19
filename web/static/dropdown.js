// dropdown menus drawn in the app's own style. the native <select> popup can't be styled (it is the OS list
// with its blue highlight), so every <select> on the page gets a button and a menu that stand in for it.
// the <select> itself stays in the page, hidden, and stays the source of truth: the rest of the app keeps
// reading select.value, adding options and listening for "change" exactly as before.
// must be imported before settings.js, which sets select values on startup.

const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
const indexProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// one menu element, reused by every dropdown
const menu = document.createElement("div");
menu.className = "dropdown-menu";
menu.setAttribute("role", "listbox");
menu.tabIndex = -1;
menu.hidden = true;
document.body.append(menu);

let current = null; // {select, button} of the open menu
let active = -1;    // highlighted item (mouse or arrow keys)

function enhance(select){
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dropdown";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    const name = select.getAttribute("aria-label");
    if(name) button.setAttribute("aria-label", name);
    const label = document.createElement("span");
    label.className = "dropdown-label";
    button.append(label);
    select.classList.add("native-select");
    select.after(button);

    // the button shows the selected option; kept in step however the select changes
    const refresh = () => {
        const option = select.options[indexProp.get.call(select)];
        label.textContent = option ? option.textContent : "";
        button.disabled = select.disabled;
    };
    Object.defineProperty(select, "value", {
        configurable: true,
        get(){ return valueProp.get.call(this); },
        set(value){ valueProp.set.call(this, value); refresh(); }
    });
    Object.defineProperty(select, "selectedIndex", {
        configurable: true,
        get(){ return indexProp.get.call(this); },
        set(index){ indexProp.set.call(this, index); refresh(); }
    });
    select.addEventListener("change", refresh);
    new MutationObserver(refresh).observe(select, {childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"]});
    refresh();

    button.addEventListener("click", () => {
        if(current && current.select === select) close();
        else open(select, button);
    });
    button.addEventListener("keydown", (event) => {
        if(event.key === "ArrowDown" || event.key === "ArrowUp"){
            event.preventDefault();
            event.stopPropagation();
            open(select, button);
        }
    });
}

function setActive(index){
    const items = menu.children;
    if(!items.length) return;
    active = (index + items.length) % items.length;
    for(let i = 0; i < items.length; i++) items[i].classList.toggle("active", i === active);
    items[active].scrollIntoView({block: "nearest"});
}

function open(select, button){
    close();
    if(!select.options.length) return;
    menu.textContent = "";
    [...select.options].forEach((option, i) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.setAttribute("role", "option");
        const selected = i === select.selectedIndex;
        item.setAttribute("aria-selected", selected);
        if(selected) item.classList.add("selected");
        const text = document.createElement("span");
        text.textContent = option.textContent;
        item.append(text);
        item.insertAdjacentHTML("beforeend", CHECK);
        item.addEventListener("click", () => choose(i));
        item.addEventListener("mousemove", () => { if(active !== i) setActive(i); });
        menu.append(item);
    });
    menu.hidden = false;
    current = {select, button};
    button.classList.add("open");
    button.setAttribute("aria-expanded", "true");

    // below the button, or above it when there is no room (the transport bar sits at the bottom)
    const rect = button.getBoundingClientRect();
    menu.style.minWidth = `${rect.width}px`;
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;
    const below = rect.bottom + 4 + height <= window.innerHeight - 8;
    menu.style.top = `${below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height)}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    menu.classList.toggle("above", !below);
    setActive(Math.max(0, select.selectedIndex));
    menu.focus();
}

function close(){
    if(!current) return;
    menu.hidden = true;
    current.button.classList.remove("open");
    current.button.setAttribute("aria-expanded", "false");
    current = null;
    active = -1;
}

function choose(index){
    const {select, button} = current;
    const changed = index !== select.selectedIndex;
    close();
    button.focus();
    if(!changed) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", {bubbles: true}));
}

// keys while the menu is open; stopPropagation keeps them away from the app shortcuts (shortcuts.js)
menu.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if(event.key === "ArrowDown") setActive(active + 1);
    else if(event.key === "ArrowUp") setActive(active - 1);
    else if(event.key === "Home") setActive(0);
    else if(event.key === "End") setActive(menu.children.length - 1);
    else if(event.key === "Enter" || event.key === " ") choose(active);
    else if(event.key === "Escape"){
        const button = current.button;
        close();
        button.focus();
    } else if(event.key === "Tab") close();
    else return;
    event.preventDefault();
});

// a press anywhere else, a resize or a scrolling panel closes it
window.addEventListener("pointerdown", (event) => {
    if(current && !menu.contains(event.target) && !current.button.contains(event.target)) close();
}, true);
window.addEventListener("resize", close);
window.addEventListener("scroll", (event) => { if(event.target !== menu) close(); }, true);

document.querySelectorAll("select").forEach(enhance);
