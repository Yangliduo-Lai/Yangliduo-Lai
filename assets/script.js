(function () {
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

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  };

  const escapeHtml = (value) =>
    value.replace(/[&<>"']/g, (char) => {
      const chars = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return chars[char];
    });

  const renderInline = (value) => {
    let output = escapeHtml(value);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s]+)\)/g, '<a href="$2">$1</a>');
    return output;
  };

  const markdownToHtml = (source) => {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let inList = false;
    let inCode = false;
    let codeLines = [];

    const closeList = () => {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
    };

    lines.forEach((line) => {
      const codeMatch = line.match(/^```/);
      if (codeMatch) {
        if (inCode) {
          html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        closeList();
        return;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        return;
      }

      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${renderInline(item[1])}</li>`);
        return;
      }

      const quote = line.match(/^>\s?(.+)$/);
      if (quote) {
        closeList();
        html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        return;
      }

      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    });

    closeList();
    if (inCode) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }

    return html.join("\n");
  };

  const loadPosts = async () => {
    const response = await fetch("data/posts/posts.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to load posts.json");
    }
    const posts = await response.json();
    return posts
      .filter((post) => !post.draft)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  const renderBlogList = async () => {
    const mount = document.querySelector("[data-blog-list]");
    if (!mount) return;

    try {
      const posts = await loadPosts();
      if (!posts.length) {
        mount.innerHTML = '<div class="empty-state">这里会放我的博客。第一篇文章准备好之后，会显示在这里。</div>';
        return;
      }

      mount.innerHTML = posts
        .map((post) => {
          const tags = (post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
          return `
            <a class="post-card" href="post.html?slug=${encodeURIComponent(post.slug)}">
              <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(post.summary || "")}</p>
              ${tags ? `<div class="tag-row">${tags}</div>` : ""}
            </a>
          `;
        })
        .join("");
    } catch (error) {
      mount.innerHTML = '<div class="empty-state">博客列表暂时无法加载。</div>';
    }
  };

  const renderPost = async () => {
    const mount = document.querySelector("[data-post]");
    if (!mount) return;

    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      mount.innerHTML = '<div class="empty-state">没有找到这篇文章。</div>';
      return;
    }

    try {
      const posts = await loadPosts();
      const post = posts.find((item) => item.slug === slug);
      if (!post) {
        mount.innerHTML = '<div class="empty-state">没有找到这篇文章。</div>';
        return;
      }

      document.title = `${post.title} | Yangliduo Lai`;
      const response = await fetch(post.file, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load post markdown");
      }
      const markdown = await response.text();
      const tags = (post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

      mount.innerHTML = `
        <a class="text-link" href="blog.html">Back to blog</a>
        <article class="article-shell">
          <header class="article-header">
            <p class="post-meta">${formatDate(post.date)}</p>
            <h1>${escapeHtml(post.title)}</h1>
            ${post.summary ? `<p class="post-meta">${escapeHtml(post.summary)}</p>` : ""}
            ${tags ? `<div class="tag-row">${tags}</div>` : ""}
          </header>
          <div class="article-body">${markdownToHtml(markdown)}</div>
        </article>
      `;
    } catch (error) {
      mount.innerHTML = '<div class="empty-state">文章暂时无法加载。</div>';
    }
  };

  renderBlogList();
  renderPost();
})();
