// small status message shown at the bottom of the screen
const toast = document.getElementById("toast");
let hideTimer = null;

// sticky = stays until hideToast() and shows the loading bar along the top (the "busy" class on body)
export function showToast(message, {error = false, sticky = false} = {}){
    clearTimeout(hideTimer);
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.style.display = "block";
    document.body.classList.toggle("busy", sticky);
    if(!sticky){
        hideTimer = setTimeout(hideToast, error ? 6000 : 2500);
    }
}

export function hideToast(){
    clearTimeout(hideTimer);
    toast.style.display = "none";
    document.body.classList.remove("busy");
}
