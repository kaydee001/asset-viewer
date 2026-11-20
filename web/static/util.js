// small helpers shared across modules. no imports, so any module can use them without creating a cycle

// on/off switches are buttons: the "active" class styles them as on (style.css), aria-checked tells screen readers
export function setSwitch(button, on){
    button.classList.toggle("active", on);
    button.setAttribute("aria-checked", on);
}

export function isOn(button){
    return button.classList.contains("active");
}

// whether a <select> offers this value (a saved setting may name an option that no longer exists)
export function hasOption(select, value){
    return [...select.options].some(option => option.value === value);
}

// "Car.GLB" -> "glb", "" when there is none
export function extensionOf(name){
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// 1234567 -> "1,234,567"
export function formatCount(value){
    return Math.round(value).toLocaleString("en-US");
}
