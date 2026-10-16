// Carrusel de fotografías del inicio: flechas, puntos, teclado y deslizar con el dedo.
// Usa desplazamiento nativo con "scroll-snap", así que en móvil se desliza de forma natural.
function initCarousel(root) {
  const track = root.querySelector("[data-carousel-track]");
  const slides = [...root.querySelectorAll(".hero-slide")];
  const prev = root.querySelector("[data-carousel-prev]");
  const next = root.querySelector("[data-carousel-next]");
  const dotsBox = root.querySelector("[data-carousel-dots]");
  if (!track || slides.length < 2) {
    root.classList.add("is-single"); // con una sola foto no se muestran controles
    return;
  }

  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let current = 0;

  slides.forEach((slide, i) => {
    slide.setAttribute("aria-label", `Fotografía ${i + 1} de ${slides.length}`);
    if (i > 0) slide.querySelector("img")?.setAttribute("loading", "lazy");
  });

  dotsBox.innerHTML = slides.map((_, i) =>
    `<button type="button" class="carousel-dot" data-i="${i}" aria-label="Ir a la fotografía ${i + 1}"></button>`
  ).join("");
  const dots = [...dotsBox.querySelectorAll(".carousel-dot")];

  function paint(i) {
    current = i;
    dots.forEach((d, k) => {
      d.classList.toggle("active", k === i);
      if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
  }

  function goTo(i) {
    const target = (i + slides.length) % slides.length; // da la vuelta al llegar al final
    track.scrollTo({ left: target * track.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" });
    paint(target);
  }

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== current && i >= 0 && i < slides.length) paint(i);
    });
  }, { passive: true });

  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));
  dotsBox.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-i]");
    if (dot) goTo(Number(dot.dataset.i));
  });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
  });
  window.addEventListener("resize", () => { track.scrollLeft = current * track.clientWidth; });

  paint(0);
}

document.querySelectorAll("[data-carousel]").forEach(initCarousel);
