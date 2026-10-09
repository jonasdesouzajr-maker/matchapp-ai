
/* Scroll-safe mini avatar for Grok's Python companion; does not touch voice playback. */
(() => {
  "use strict";
  const hero = document.querySelector(".portrait-wrap");
  const face = document.getElementById("face");
  const dock = document.getElementById("mini-dock");
  const image = dock?.querySelector("img");
  const label = dock?.querySelector("strong");
  const hint = dock?.querySelector("small");
  if (!hero || !face || !dock || !image) return;

  function update() {
    const active = face.querySelector(".plate.is-on") || face.querySelector(".plate");
    const name = document.getElementById("name")?.textContent || "Companion";
    const status = document.getElementById("status")?.textContent || "Ready";
    const role = document.getElementById("role")?.textContent || "Your AI companion";
    hero.dataset.label = name + " · " + role;
    if (active?.getAttribute("src")) image.src = active.getAttribute("src");
    if (label) label.textContent = name;
    if (hint) hint.textContent = status;
    dock.classList.toggle("is-speaking", document.getElementById("stage")?.classList.contains("is-speaking") === true);
    dock.setAttribute("aria-label", "Talk to " + name + " (" + status + ")");
  }

  const observer = new IntersectionObserver((entries) => {
    dock.hidden = entries[0]?.isIntersecting !== false;
    if (!dock.hidden) update();
  }, { threshold: 0.12 });
  observer.observe(hero);

  const mutations = new MutationObserver(update);
  mutations.observe(face, { subtree: true, attributes: true, attributeFilter: ["src", "class"] });
  mutations.observe(document.getElementById("stage"), { attributes: true, attributeFilter: ["class"] });
  mutations.observe(document.getElementById("name"), { childList: true });
  mutations.observe(document.getElementById("status"), { childList: true });

  dock.addEventListener("click", () => {
    hero.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    face.focus({ preventScroll: true });
  });

  update();
})();
