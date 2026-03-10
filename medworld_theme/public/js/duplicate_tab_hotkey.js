// Ctrl+Y (or Cmd+Y) opens the current tab in a new tab/window
(() => {
  if (window.__mwy_dup_tab_hotkey) return;
  window.__mwy_dup_tab_hotkey = true;

  const handler = (event) => {
    const key = event.key && event.key.toLowerCase();
    const hotkey = (event.ctrlKey || event.metaKey) && key === "y";
    if (!hotkey) return;

    event.preventDefault(); // avoid clashing with redo in some browsers
    window.open(window.location.href, "_blank");
  };

  document.addEventListener("keydown", handler, true);
})();
