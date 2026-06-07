/* ============================================================
   CHARIOT — shared behaviour (nav, mobile menu, scroll reveal)
   ============================================================ */
(function () {
  "use strict";

  /* ---- Nav: transparent over hero -> solid on scroll ---- */
  function initNav() {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var solidImmediately = nav.hasAttribute("data-nav-solid"); // pages without a dark hero
    var trigger = document.getElementById("top");

    if (solidImmediately) {
      nav.classList.add("is-scrolled"); // always solid (no dark hero behind it)
    } else {
      var onScroll = function () {
        var past = trigger ? window.scrollY > trigger.offsetHeight * 0.58 : window.scrollY > 90;
        nav.classList.toggle("is-scrolled", past);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    /* mobile overlay menu */
    var burger = nav.querySelector("[data-burger]");
    if (burger) {
      burger.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.style.overflow = open ? "hidden" : "";
      });
      nav.querySelectorAll(".nav__overlaylink").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        });
      });
    }
  }

  /* ---- Scroll reveal (honours reduced motion + no-JS) ---- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
    // fail-safe: never leave content hidden
    setTimeout(function () { els.forEach(function (el) { el.classList.add("is-in"); }); }, 1800);
  }

  /* ---- Footer year ---- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function init() { initNav(); initAcct(); initProgress(); initReveal(); initYear(); }

  /* ---- Scroll progress bar in the nav ---- */
  function initProgress() {
    var fill = document.querySelector("[data-progress]");
    if (!fill) return;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop || window.scrollY) / max : 0;
      fill.style.width = Math.max(0, Math.min(1, pct)) * 100 + "%";
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---- Account dropdown ---- */
  function initAcct() {
    var acct = document.querySelector("[data-acct]");
    if (!acct) return;
    var btn = acct.querySelector("[data-acct-btn]");
    function close() { acct.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
    function open() { acct.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      acct.classList.contains("is-open") ? close() : open();
    });
    document.addEventListener("click", function (e) { if (!acct.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    // hover affordance on desktop (pointer: fine)
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      acct.addEventListener("mouseenter", open);
      acct.addEventListener("mouseleave", close);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
