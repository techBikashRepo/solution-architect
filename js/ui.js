/* ================================================================
   UI UTILITIES — Toasts, Modal, Loading, Reading Progress,
                  Mobile Drawer, Scroll helpers
================================================================ */

/* ================================================================
   UI UTILITIES — Toasts, Modal, Loading, Reading Progress,
                  Mobile Drawer, Scroll helpers
================================================================ */

/* ── TOAST ───────────────────────────────────────────── */
const toastContainer = document.getElementById("toast-container");

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration  ms (default 3200)
 */
function toast(message, type = "info", duration = 3200) {
  if (!toastContainer) return;

  const icons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };

  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", "alert");
  el.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;

  toastContainer.appendChild(el);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(el), duration);
  el.addEventListener("click", () => {
    clearTimeout(timer);
    dismissToast(el);
  });
}

function dismissToast(el) {
  el.classList.add("is-leaving");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  // Fallback in case animationend doesn't fire
  setTimeout(() => el.remove(), 600);
}

/* ── MODAL ──────────────────────────────────────────────── */
const modal = document.getElementById("shortcuts-modal");
const modalBackdrop = document.getElementById("modal-backdrop");

function openModal() {
  if (!modal) return;
  modal.classList.add("is-open");
  if (modalBackdrop) modalBackdrop.classList.add("is-open");
  modal.setAttribute("open", "");
  // Trap focus
  const firstFocusable = modal.querySelector(
    'button, [href], input, [tabindex]:not([tabindex="-1"])',
  );
  if (firstFocusable) firstFocusable.focus();
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("is-open");
  if (modalBackdrop) modalBackdrop.classList.remove("is-open");
  modal.removeAttribute("open");
  document.body.style.overflow = "";
}

function initModal() {
  const openBtns = [
    document.getElementById("btn-shortcuts"),
    document.getElementById("btn-shortcuts-hero"),
  ];
  openBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", openModal);
  });

  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      closeModal();
    }
  });
}

/* ── LOADING OVERLAY ────────────────────────────────────── */
const loadingOverlay = document.getElementById("loading-overlay");

function showLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.hidden = false;
  loadingOverlay.removeAttribute("aria-hidden");
}

function hideLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.hidden = true;
  loadingOverlay.setAttribute("aria-hidden", "true");
}

/* ── READING PROGRESS BAR ───────────────────────────────── */
const progressFill = document.getElementById("reading-progress-fill");

function updateReadingProgress() {
  if (!progressFill) return;
  const article = document.getElementById("content-article");
  if (!article) {
    progressFill.style.width = "0%";
    return;
  }

  const scrollTop =
    document.documentElement.scrollTop || document.body.scrollTop;
  const headerH =
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
    ) || 64;
  const articleTop =
    article.getBoundingClientRect().top + scrollTop - headerH - 32;
  const articleHeight = article.scrollHeight;
  const scrolled = Math.max(0, scrollTop - articleTop);
  const pct = Math.min(100, (scrolled / articleHeight) * 100);
  progressFill.style.width = pct + "%";
}

function initReadingProgress() {
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
}

function resetReadingProgress() {
  if (progressFill) progressFill.style.width = "0%";
}

/* ── MOBILE DRAWER ──────────────────────────────────────── */
const drawer = document.getElementById("mobile-drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const hamburger = document.getElementById("hamburger");
const drawerClose = document.getElementById("drawer-close");

function openDrawer() {
  if (!drawer) return;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  if (drawerOverlay) drawerOverlay.classList.add("is-visible");
  if (hamburger) {
    hamburger.classList.add("is-open");
    hamburger.setAttribute("aria-expanded", "true");
  }
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  if (!drawer) return;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  if (drawerOverlay) drawerOverlay.classList.remove("is-visible");
  if (hamburger) {
    hamburger.classList.remove("is-open");
    hamburger.setAttribute("aria-expanded", "false");
  }
  document.body.style.overflow = "";
}

function initDrawer() {
  if (hamburger) hamburger.addEventListener("click", openDrawer);
  if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);
}

/* ── SCROLL TO TOP ──────────────────────────────────────── */
function scrollToTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
}

/* ── HERO GREETING ──────────────────────────────────────── */
function setGreeting() {
  const el = document.getElementById("hero-greeting");
  if (!el) return;
  const h = new Date().getHours();
  let greeting;
  if (h < 5) greeting = "Burning the midnight oil 🌙";
  else if (h < 12) greeting = "Good morning 👋";
  else if (h < 17) greeting = "Good afternoon ☀️";
  else if (h < 21) greeting = "Good evening 🌆";
  else greeting = "Good night 🌙";
  el.textContent = greeting;
}

/* ── SMOOTH SCROLL TO ELEMENT ───────────────────────────── */
function scrollToElement(selector, offset = 0) {
  const el = document.querySelector(selector);
  if (!el) return;
  const headerH =
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
    ) || 64;
  const top =
    el.getBoundingClientRect().top + window.scrollY - headerH - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ── INIT ALL ────────────────────────────────────────────── */
function init() {
  initModal();
  initDrawer();
  initReadingProgress();
  setGreeting();
}

export const UI = {
  toast,
  openModal,
  closeModal,
  showLoading,
  hideLoading,
  updateReadingProgress,
  resetReadingProgress,
  openDrawer,
  closeDrawer,
  scrollToTop,
  scrollToElement,
  setGreeting,
  init,
};
