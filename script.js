const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeToggle?.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  themeColor?.setAttribute("content", theme === "dark" ? "#1c1c1d" : "#ffffff");
}

let initialTheme = "light";
try {
  if (sessionStorage.getItem("portfolio-theme") === "dark") initialTheme = "dark";
} catch {}
applyTheme(initialTheme);
themeToggle?.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try { sessionStorage.setItem("portfolio-theme", theme); } catch {}
});

const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
function updateNavigation() {
  const current = navLinks.some(link => link.hash === location.hash) ? location.hash : "#home";
  navLinks.forEach(link => {
    const active = link.hash === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
addEventListener("hashchange", updateNavigation);
updateNavigation();

const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();
