(function () {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = savedTheme || (prefersDark ? "dark" : "light");

  const year = document.querySelector("[data-year]");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const refreshIcons = () => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const themeButton = document.querySelector("[data-theme-toggle]");
  const setThemeIcon = () => {
    if (!themeButton) return;
    themeButton.innerHTML = root.dataset.theme === "dark" ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
    refreshIcons();
  };

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("theme", root.dataset.theme);
      setThemeIcon();
    });
  }

  const header = document.querySelector("[data-header]");
  const syncHeader = () => {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    }
  };
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const active = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!active) return;

      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${active.target.id}`);
      });
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] }
  );

  sections.forEach((section) => observer.observe(section));

  const canvas = document.querySelector("[data-graph-canvas]");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (canvas && ctx) {
    const nodes = [
      { x: 0.14, y: 0.24, r: 3.8, tone: "teal", speed: 0.28 },
      { x: 0.28, y: 0.66, r: 4.8, tone: "gold", speed: 0.2 },
      { x: 0.43, y: 0.38, r: 3.5, tone: "blue", speed: 0.24 },
      { x: 0.58, y: 0.72, r: 5.2, tone: "coral", speed: 0.18 },
      { x: 0.72, y: 0.31, r: 4.4, tone: "teal", speed: 0.22 },
      { x: 0.86, y: 0.58, r: 3.8, tone: "blue", speed: 0.26 },
      { x: 0.36, y: 0.18, r: 3.2, tone: "coral", speed: 0.21 },
      { x: 0.78, y: 0.82, r: 3.6, tone: "gold", speed: 0.19 }
    ];

    const colors = {
      teal: "#0f766e",
      gold: "#b88420",
      blue: "#315f8a",
      coral: "#c4513d"
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      const points = nodes.map((node, index) => {
        const drift = Math.sin(time * 0.001 * node.speed + index) * 18;
        const lift = Math.cos(time * 0.001 * node.speed + index * 1.7) * 14;
        return {
          x: node.x * width + drift,
          y: node.y * height + lift,
          r: node.r,
          color: colors[node.tone]
        };
      });

      points.forEach((point, index) => {
        points.slice(index + 1).forEach((other) => {
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance > 430) return;
          const alpha = Math.max(0.05, 0.22 - distance / 2200);
          ctx.strokeStyle = `rgba(48, 60, 70, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        });
      });

      points.forEach((point) => {
        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 253, 248, 0.74)";
        ctx.lineWidth = 4;
        ctx.stroke();
      });

      requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(draw);
  }

  setThemeIcon();
  window.addEventListener("load", refreshIcons);
})();
