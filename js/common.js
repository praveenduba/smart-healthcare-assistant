/* =====================================================================
   Smart Healthcare Assistant | js/common.js
   Shared helpers used by every page (all live on the global "SHA" object):
     SHA.toast(msg, type)            pop-up messages
     SHA.confirm({...})              "Are you sure?" dialog (returns a Promise)
     SHA.setLoading(btn, bool)       disable a button + show spinner
     SHA.validate.email/password/... form validation
     SHA.setFieldError / clearErrors show validation errors under inputs
     SHA.friendlyError(err)          turn technical errors into plain English
     SHA.formatDate / formatTime / escapeHtml / debounce / icon
     Theme toggle, mobile menu, scroll animations, config warning banner
   ===================================================================== */
(function () {
  "use strict";

  var SHA = (window.SHA = window.SHA || {});

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  SHA.$ = function (sel, root) { return (root || document).querySelector(sel); };
  SHA.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Always escape text before putting it inside innerHTML (stops XSS attacks).
  SHA.escapeHtml = function (value) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return map[c]; });
  };

  SHA.debounce = function (fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
    };
  };

  SHA.param = function (name) { return new URLSearchParams(window.location.search).get(name); };

  // localStorage can be blocked (private mode), so always use try/catch.
  function store(action, k, v) {
    try {
      if (action === "get") return window.localStorage.getItem(k);
      window.localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------
  // Icons (inline SVG, no downloads needed). Use in HTML like:
  //   <span data-icon="calendar"></span>
  // ------------------------------------------------------------------
  var ICONS = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>'
  };

  SHA.icon = function (name, extraClass) {
    return '<svg class="icon ' + (extraClass || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (ICONS[name] || ICONS.info) + "</svg>";
  };

  SHA.hydrateIcons = function (root) {
    SHA.$$("[data-icon]", root).forEach(function (el) {
      if (!el.querySelector("svg")) el.innerHTML = SHA.icon(el.getAttribute("data-icon"));
    });
  };

  // ------------------------------------------------------------------
  // Light / dark theme
  // ------------------------------------------------------------------
  SHA.getTheme = function () {
    var saved = store("get", "sha-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  SHA.applyTheme = function (theme) {
    document.documentElement.setAttribute("data-theme", theme);
    SHA.$$("[data-theme-toggle]").forEach(function (btn) {
      btn.innerHTML = SHA.icon(theme === "dark" ? "sun" : "moon");
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  };

  SHA.toggleTheme = function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store("set", "sha-theme", next);
    SHA.applyTheme(next);
  };

  // Apply immediately so there is no white flash.
  document.documentElement.setAttribute("data-theme", SHA.getTheme());

  // ------------------------------------------------------------------
  // Toast notifications
  // ------------------------------------------------------------------
  SHA.toast = function (message, type, duration) {
    type = type || "info";
    var region = SHA.$(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }

    var toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    var iconName = type === "success" ? "check" : type === "error" || type === "warning" ? "alert" : "info";
    toast.innerHTML = SHA.icon(iconName) + '<div class="toast-msg"></div>' +
      '<button type="button" aria-label="Dismiss message">' + SHA.icon("x") + "</button>";
    toast.querySelector(".toast-msg").textContent = message;   // textContent = safe

    function remove() {
      toast.classList.add("leaving");
      setTimeout(function () { toast.remove(); }, 260);
    }
    toast.querySelector("button").addEventListener("click", remove);
    region.appendChild(toast);
    setTimeout(remove, duration || 4500);
  };

  // ------------------------------------------------------------------
  // Confirmation dialog:  if (await SHA.confirm({title:"Delete?"})) { ... }
  // ------------------------------------------------------------------
  SHA.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var dlg = document.createElement("dialog");
      dlg.className = "modal";
      dlg.setAttribute("aria-labelledby", "confirm-title");

      var h = document.createElement("h3");
      h.id = "confirm-title";
      h.textContent = opts.title || "Are you sure?";
      var p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = opts.message || "";

      var form = document.createElement("form");
      form.method = "dialog";
      form.className = "modal-actions";

      var cancel = document.createElement("button");
      cancel.type = "submit"; cancel.value = "cancel";
      cancel.className = "btn btn-ghost";
      cancel.textContent = opts.cancelText || "Cancel";

      var ok = document.createElement("button");
      ok.type = "submit"; ok.value = "confirm";
      ok.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
      ok.textContent = opts.confirmText || "Confirm";

      form.appendChild(cancel);
      form.appendChild(ok);
      dlg.appendChild(h); dlg.appendChild(p); dlg.appendChild(form);
      document.body.appendChild(dlg);

      dlg.addEventListener("close", function () {
        var result = dlg.returnValue === "confirm";
        dlg.remove();
        resolve(result);
      });
      dlg.showModal();
      cancel.focus();   // safest default for destructive actions
    });
  };

  // ------------------------------------------------------------------
  // Button loading state
  // ------------------------------------------------------------------
  SHA.setLoading = function (btn, loading, text) {
    if (!btn) return;
    if (loading) {
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + SHA.escapeHtml(text || "Please wait...") + "</span>";
    } else {
      if (btn.dataset.label) { btn.innerHTML = btn.dataset.label; delete btn.dataset.label; }
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  };

  // ------------------------------------------------------------------
  // Form validation (each returns "" when OK, or an error message)
  // ------------------------------------------------------------------
  SHA.validate = {
    required: function (v, label) {
      return String(v || "").trim() ? "" : (label || "This field") + " is required.";
    },
    email: function (v) {
      v = String(v || "").trim();
      if (!v) return "Email is required.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter a valid email address.";
    },
    password: function (v) {
      v = String(v || "");
      if (!v) return "Password is required.";
      if (v.length < 8) return "Password must be at least 8 characters.";
      if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return "Use at least one letter and one number.";
      return "";
    },
    phone: function (v, optional) {
      v = String(v || "").trim();
      if (!v) return optional ? "" : "Phone number is required.";
      return /^[0-9+() -]{7,20}$/.test(v) ? "" : "Enter a valid phone number (digits, spaces, + - ( ) only).";
    },
    name: function (v) {
      v = String(v || "").trim();
      if (v.length < 2) return "Please enter your full name.";
      return v.length > 100 ? "Name is too long." : "";
    }
  };

  // Show an error under an input (and tell screen readers about it).
  SHA.setFieldError = function (input, message) {
    if (!input) return;
    var field = input.closest(".field") || input.parentElement;
    var err = field.querySelector(".field-error");
    if (!message) {
      if (err) err.remove();
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      return;
    }
    if (!err) {
      err = document.createElement("div");
      err.className = "field-error";
      err.id = (input.id || input.name || "field") + "-error";
      field.appendChild(err);
    }
    err.textContent = message;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", err.id);
  };

  SHA.clearErrors = function (form) {
    SHA.$$("input, select, textarea", form).forEach(function (el) { SHA.setFieldError(el, ""); });
    var alertBox = SHA.$(".form-alert", form);
    if (alertBox) alertBox.remove();
  };

  // A banner at the top of a form for general errors.
  SHA.showFormError = function (form, message) {
    var box = SHA.$(".form-alert", form);
    if (!box) {
      box = document.createElement("div");
      box.className = "form-alert";
      box.setAttribute("role", "alert");
      form.insertBefore(box, form.firstChild);
    }
    box.textContent = message;
  };

  // ------------------------------------------------------------------
  // Friendly error messages
  // ------------------------------------------------------------------
  SHA.friendlyError = function (err) {
    if (!err) return "Something went wrong. Please try again.";
    var msg = String(err.message || err.error_description || err);
    var code = String(err.code || "");
    var low = msg.toLowerCase();

    if (low.indexOf("invalid login credentials") !== -1) return "Incorrect email or password.";
    if (low.indexOf("email not confirmed") !== -1) return "Please confirm your email first. Check your inbox for the confirmation link.";
    if (low.indexOf("user already registered") !== -1) return "An account with this email already exists. Try logging in instead.";
    if (low.indexOf("rate limit") !== -1 || low.indexOf("too many") !== -1 || code === "over_email_send_rate_limit") return "Too many attempts. Please wait a few minutes and try again.";
    if (low.indexOf("failed to fetch") !== -1 || low.indexOf("networkerror") !== -1) return "Network problem. Check your internet connection and try again.";
    if (low.indexOf("jwt expired") !== -1 || low.indexOf("session") !== -1 && low.indexOf("missing") !== -1) return "Your session expired. Please log in again.";
    if (code === "42501" || low.indexOf("row-level security") !== -1 || low.indexOf("permission denied") !== -1) return "You do not have permission to do that.";
    if (code === "23505" || low.indexOf("duplicate key") !== -1) return "That already exists. If you were booking, someone may have just taken that time slot.";
    if (code === "23503") return "That item is linked to other records, so the action could not be completed.";
    if (code === "23514") return "One of the values you entered is not allowed. Please check the form.";
    if (code === "P0001") return msg;   // our own friendly messages from database triggers
    if (low.indexOf("password") !== -1 && low.indexOf("character") !== -1) return "That password is too short or too weak.";
    return "Something went wrong. Please try again. (" + msg.slice(0, 120) + ")";
  };

  // ------------------------------------------------------------------
  // Date / time formatting
  // ------------------------------------------------------------------
  // "2026-10-15" -> "15 Oct 2026" (no timezone shifting)
  SHA.formatDate = function (value) {
    if (!value) return "";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // "14:30:00" -> "2:30 PM"
  SHA.formatTime = function (value) {
    if (!value) return "";
    var parts = String(value).split(":");
    var h = parseInt(parts[0], 10), m = parts[1] || "00";
    if (isNaN(h)) return "";
    return (h % 12 || 12) + ":" + m + " " + (h >= 12 ? "PM" : "AM");
  };

  SHA.formatDateTime = function (value) {
    var d = new Date(value);
    if (isNaN(d)) return "";
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // Today as "YYYY-MM-DD" in the user's own time zone.
  SHA.todayISO = function () {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  };

  // ------------------------------------------------------------------
  // Page setup (runs automatically on every page)
  // ------------------------------------------------------------------
  function initMobileNav() {
    var toggle = SHA.$("[data-nav-toggle]");
    var menu = SHA.$("#nav-menu");
    if (!toggle || !menu) return;
    toggle.innerHTML = SHA.icon("menu");
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.innerHTML = SHA.icon(open ? "x" : "menu");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = SHA.icon("menu");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) toggle.click();
    });
  }

  function initReveal() {
    var items = SHA.$$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  // Animated numbers:  <span data-count="1200" data-suffix="+">0</span>
  function initCounters() {
    var els = SHA.$$("[data-count]");
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduce) { el.textContent = target.toLocaleString("en-IN") + suffix; return; }
      var start = null, dur = 1200;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("en-IN") + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  function showConfigBanner() {
    if (SHA.configOk || SHA.configOk === undefined) return;
    var banner = document.createElement("div");
    banner.className = "config-banner";
    banner.setAttribute("role", "alert");
    banner.textContent = SHA.configError || "Supabase is not configured.";
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function init() {
    SHA.applyTheme(SHA.getTheme());
    SHA.hydrateIcons();
    SHA.$$("[data-theme-toggle]").forEach(function (btn) { btn.addEventListener("click", SHA.toggleTheme); });
    SHA.$$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    initMobileNav();
    initReveal();
    initCounters();
    showConfigBanner();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
