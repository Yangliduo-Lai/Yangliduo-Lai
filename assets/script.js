(function () {
  const POSTS_PER_PAGE = 6;
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
    String(value ?? "").replace(/[&<>"']/g, (char) => {
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
      throw new Error("Unable to load posts index");
    }
    const posts = await response.json();

    if (!Array.isArray(posts)) {
      throw new Error("Posts index must be an array");
    }

    return posts
      .filter((post) => !post.draft)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  const getBlogUrl = ({ tag, page } = {}) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (page && page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `blog.html?${query}` : "blog.html";
  };

  const getTagNetwork = (posts) => {
    const counts = new Map();
    const edges = new Map();

    posts.forEach((post) => {
      const uniqueTags = Array.from(new Set(post.tags || [])).sort();
      uniqueTags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });

      uniqueTags.forEach((source, sourceIndex) => {
        uniqueTags.slice(sourceIndex + 1).forEach((target) => {
          const key = `${source}|||${target}`;
          edges.set(key, (edges.get(key) || 0) + 1);
        });
      });
    });

    return {
      nodes: Array.from(counts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      edges: Array.from(edges.entries()).map(([key, count]) => {
        const [source, target] = key.split("|||");
        return { source, target, count };
      })
    };
  };

  const renderTagGraph = (posts, currentTag) => {
    const { nodes, edges } = getTagNetwork(posts);
    if (!nodes.length) {
      return '<div class="empty-state">还没有可以展示的 tag。</div>';
    }

    const width = 960;
    const height = 360;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = nodes.length <= 2 ? 240 : 340;
    const radiusY = nodes.length <= 2 ? 82 : 126;
    const maxCount = Math.max(...nodes.map((node) => node.count));
    const maxEdgeCount = Math.max(1, ...edges.map((edge) => edge.count));
    const positions = new Map();

    nodes.forEach((node, index) => {
      const angle = nodes.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
      const x = nodes.length === 1 ? centerX : centerX + Math.cos(angle) * radiusX;
      const y = nodes.length === 1 ? centerY : centerY + Math.sin(angle) * radiusY;
      const size = 20 + (node.count / maxCount) * 24;
      positions.set(node.tag, { ...node, x, y, size });
    });

    const edgeSvg = edges
      .map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) return "";
        const active = currentTag && (edge.source === currentTag || edge.target === currentTag);
        const widthValue = 1.2 + (edge.count / maxEdgeCount) * 5;
        return `
          <line
            class="tag-edge${active ? " is-active" : ""}"
            data-source="${escapeHtml(edge.source)}"
            data-target="${escapeHtml(edge.target)}"
            x1="${source.x}"
            y1="${source.y}"
            x2="${target.x}"
            y2="${target.y}"
            stroke-width="${widthValue.toFixed(2)}"
          />
        `;
      })
      .join("");

    const nodeSvg = nodes
      .map((node) => {
        const point = positions.get(node.tag);
        const active = node.tag === currentTag;
        const labelY = point.y + point.size + 18;
        return `
          <a class="tag-node-link" href="${getBlogUrl({ tag: node.tag })}" data-tag="${escapeHtml(node.tag)}">
            <g class="tag-node${active ? " is-active" : ""}" data-tag="${escapeHtml(node.tag)}" transform="translate(${point.x} ${point.y})">
              <circle r="${point.size.toFixed(2)}"></circle>
              <text class="tag-node-count" y="5">${node.count}</text>
            </g>
            <text class="tag-node-label" data-tag="${escapeHtml(node.tag)}" x="${point.x}" y="${labelY}">${escapeHtml(node.tag)}</text>
          </a>
        `;
      })
      .join("");

    return `
      <div class="tag-graph-actions">
        <a class="text-link" href="blog.html">All posts</a>
      </div>
      <svg class="tag-network" viewBox="0 0 ${width} ${height}" role="img" aria-label="Blog tag relationship graph">
        <g>${edgeSvg}</g>
        <g>${nodeSvg}</g>
      </svg>
    `;
  };

  const renderBlogList = async () => {
    const mount = document.querySelector("[data-blog-list]");
    if (!mount) return;

    try {
      const posts = await loadPosts();
      const params = new URLSearchParams(window.location.search);
      const currentTag = params.get("tag");
      const requestedPage = Math.max(1, Number(params.get("page")) || 1);
      const tagMount = document.querySelector("[data-tag-graph]");
      const statusMount = document.querySelector("[data-filter-status]");
      const paginationMount = document.querySelector("[data-pagination]");
      const filteredPosts = currentTag
        ? posts.filter((post) => (post.tags || []).includes(currentTag))
        : posts;
      const pageCount = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
      const currentPage = Math.min(requestedPage, pageCount);
      const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
      const visiblePosts = filteredPosts.slice(pageStart, pageStart + POSTS_PER_PAGE);

      if (tagMount) {
        tagMount.innerHTML = renderTagGraph(posts, currentTag);
        enableTagDragging(tagMount);
      }

      if (statusMount) {
        statusMount.innerHTML = currentTag
          ? `当前筛选：<strong>${escapeHtml(currentTag)}</strong> · ${filteredPosts.length} 篇文章 · 第 ${currentPage} / ${pageCount} 页 · <a href="blog.html">清除筛选</a>`
          : `全部文章 · ${posts.length} 篇 · 第 ${currentPage} / ${pageCount} 页`;
      }

      if (!posts.length) {
        mount.innerHTML = '<div class="empty-state">这里会放我的博客。第一篇文章准备好之后，会显示在这里。</div>';
        return;
      }

      if (!filteredPosts.length) {
        mount.innerHTML = '<div class="empty-state">这个标签下暂时没有文章。</div>';
        if (paginationMount) {
          paginationMount.innerHTML = "";
        }
        return;
      }

      mount.innerHTML = visiblePosts
        .map((post) => {
          const postTags = (post.tags || [])
            .map(
              (tag) => `
                <a class="tag-pill" href="${getBlogUrl({ tag })}">
                  ${escapeHtml(tag)}
                </a>
              `
            )
            .join("");
          return `
            <article class="post-card">
              <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
              <h3><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
              <p>${escapeHtml(post.summary || "")}</p>
              ${postTags ? `<div class="tag-row">${postTags}</div>` : ""}
            </article>
          `;
        })
        .join("");

      if (paginationMount) {
        paginationMount.innerHTML = renderPagination(currentTag, currentPage, pageCount);
      }
    } catch (error) {
      mount.innerHTML = '<div class="empty-state">博客列表暂时无法加载。</div>';
    }
  };

  const renderPagination = (tag, currentPage, pageCount) => {
    if (pageCount <= 1) return "";

    const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
      .map((page) => {
        const current = page === currentPage ? ' aria-current="page"' : "";
        return `<a href="${getBlogUrl({ tag, page })}"${current}>${page}</a>`;
      })
      .join("");

    const previous =
      currentPage > 1
        ? `<a class="pagination-step" href="${getBlogUrl({ tag, page: currentPage - 1 })}">Prev</a>`
        : '<span class="pagination-step is-disabled">Prev</span>';
    const next =
      currentPage < pageCount
        ? `<a class="pagination-step" href="${getBlogUrl({ tag, page: currentPage + 1 })}">Next</a>`
        : '<span class="pagination-step is-disabled">Next</span>';

    return `${previous}<div class="pagination-pages">${pages}</div>${next}`;
  };

  const enableTagDragging = (mount) => {
    const svg = mount.querySelector(".tag-network");
    if (!svg) return;

    let active = null;
    const positions = new Map();

    const getNode = (tag) => Array.from(svg.querySelectorAll(".tag-node")).find((item) => item.dataset.tag === tag);
    const getLabel = (tag) =>
      Array.from(svg.querySelectorAll(".tag-node-label")).find((item) => item.dataset.tag === tag);

    const getPoint = (event) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse());
    };

    const readPosition = (tag) => {
      if (positions.has(tag)) return positions.get(tag);
      const node = getNode(tag);
      const transform = node ? node.getAttribute("transform") || "translate(0 0)" : "translate(0 0)";
      const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      const position = match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
      positions.set(tag, position);
      return position;
    };

    svg.querySelectorAll(".tag-node").forEach((node) => {
      readPosition(node.dataset.tag);
    });

    const clampPosition = (x, y) => {
      const box = svg.viewBox.baseVal;
      return {
        x: Math.max(box.x + 56, Math.min(box.x + box.width - 56, x)),
        y: Math.max(box.y + 56, Math.min(box.y + box.height - 72, y))
      };
    };

    const updateNode = (tag, x, y) => {
      const node = getNode(tag);
      const label = getLabel(tag);
      if (!node || !label) return;

      const position = clampPosition(x, y);
      const circle = node.querySelector("circle");
      const nodeRadius = circle ? Number(circle.getAttribute("r")) : 24;
      positions.set(tag, position);
      node.setAttribute("transform", `translate(${position.x} ${position.y})`);
      label.setAttribute("x", position.x);
      label.setAttribute("y", position.y + nodeRadius + 18);

      svg.querySelectorAll(".tag-edge").forEach((edge) => {
        if (edge.dataset.source === tag) {
          edge.setAttribute("x1", position.x);
          edge.setAttribute("y1", position.y);
        }
        if (edge.dataset.target === tag) {
          edge.setAttribute("x2", position.x);
          edge.setAttribute("y2", position.y);
        }
      });
    };

    const nudgeNeighbors = (tag, dx, dy) => {
      svg.querySelectorAll(".tag-edge").forEach((edge) => {
        let neighbor = null;
        if (edge.dataset.source === tag) neighbor = edge.dataset.target;
        if (edge.dataset.target === tag) neighbor = edge.dataset.source;
        if (!neighbor) return;

        const width = Number(edge.getAttribute("stroke-width")) || 1;
        const influence = Math.min(0.36, 0.08 + width / 28);
        const current = readPosition(neighbor);
        updateNode(neighbor, current.x + dx * influence, current.y + dy * influence);
      });
    };

    svg.querySelectorAll(".tag-node-link").forEach((link) => {
      link.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const tag = link.dataset.tag;
        const node = getNode(tag);
        if (!tag || !node) return;

        const current = readPosition(tag);
        const pointer = getPoint(event);
        active = {
          dragged: false,
          lastX: current.x,
          lastY: current.y,
          offsetX: pointer.x - current.x,
          offsetY: pointer.y - current.y,
          tag
        };

        link.setPointerCapture(event.pointerId);
      });

      link.addEventListener("pointermove", (event) => {
        if (!active || active.tag !== link.dataset.tag) return;
        event.preventDefault();
        const pointer = getPoint(event);
        active.dragged = true;
        const next = clampPosition(pointer.x - active.offsetX, pointer.y - active.offsetY);
        const dx = next.x - active.lastX;
        const dy = next.y - active.lastY;
        updateNode(active.tag, next.x, next.y);
        nudgeNeighbors(active.tag, dx, dy);
        active.lastX = next.x;
        active.lastY = next.y;
      });

      link.addEventListener("pointerup", (event) => {
        if (!active || active.tag !== link.dataset.tag) return;
        if (active.dragged) {
          event.preventDefault();
          link.dataset.dragged = "true";
          window.setTimeout(() => {
            delete link.dataset.dragged;
          }, 200);
        }
        active = null;
      });

      link.addEventListener("pointercancel", () => {
        active = null;
      });

      link.addEventListener("click", (event) => {
        if (link.dataset.dragged === "true") {
          event.preventDefault();
        }
      });
    });
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
      const tags = (post.tags || [])
        .map(
          (tag) => `
            <a class="tag-pill" href="blog.html?tag=${encodeURIComponent(tag)}">
              ${escapeHtml(tag)}
            </a>
          `
        )
        .join("");

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
