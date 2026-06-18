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

  const getBlogUrl = ({ tag, page, q } = {}) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
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

  const renderTagGraph = (posts, currentTag, currentQuery) => {
    const { nodes, edges } = getTagNetwork(posts);
    if (!nodes.length) {
      return '<div class="empty-state">还没有可以展示的 tag。</div>';
    }

    const width = 960;
    const height = 420;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = nodes.length <= 2 ? 280 : 390;
    const radiusY = nodes.length <= 2 ? 104 : 156;
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
            data-count="${edge.count}"
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
          <a class="tag-node-link" href="${getBlogUrl({ tag: node.tag, q: currentQuery })}" data-tag="${escapeHtml(node.tag)}">
            <g
              class="tag-node${active ? " is-active" : ""}"
              data-tag="${escapeHtml(node.tag)}"
              data-count="${node.count}"
              data-radius="${point.size.toFixed(2)}"
              transform="translate(${point.x} ${point.y})"
            >
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
        <rect class="tag-pan-layer" x="0" y="0" width="${width}" height="${height}"></rect>
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
      const currentQuery = (params.get("q") || "").trim();
      const normalizedQuery = currentQuery.toLowerCase();
      const requestedPage = Math.max(1, Number(params.get("page")) || 1);
      const tagMount = document.querySelector("[data-tag-graph]");
      const statusMount = document.querySelector("[data-filter-status]");
      const paginationMount = document.querySelector("[data-pagination]");
      const searchForm = document.querySelector("[data-blog-search]");
      const searchInput = document.querySelector("[data-blog-search-input]");
      const countMount = document.querySelector("[data-blog-count]");
      const statsMount = document.querySelector("[data-blog-stats]");
      const frequencyMount = document.querySelector("[data-blog-frequency]");
      const filteredPosts = posts.filter((post) => {
        const matchesTag = !currentTag || (post.tags || []).includes(currentTag);
        const haystack = [post.title, post.summary, post.slug, ...(post.tags || [])].join(" ").toLowerCase();
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
        return matchesTag && matchesQuery;
      });
      const pageCount = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
      const currentPage = Math.min(requestedPage, pageCount);
      const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
      const visiblePosts = filteredPosts.slice(pageStart, pageStart + POSTS_PER_PAGE);

      if (searchInput) {
        searchInput.value = currentQuery;
      }

      if (searchForm && searchInput && searchForm.dataset.bound !== "true") {
        searchForm.dataset.bound = "true";
        searchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          window.location.href = getBlogUrl({
            tag: currentTag,
            q: searchInput.value.trim()
          });
        });
      }

      if (countMount) {
        countMount.textContent = `${filteredPosts.length} / ${posts.length}`;
      }

      if (statsMount) {
        statsMount.innerHTML = renderBlogStats(posts);
      }

      if (frequencyMount) {
        frequencyMount.innerHTML = renderBlogFrequency(posts);
      }

      if (tagMount) {
        try {
          tagMount.innerHTML = renderTagGraph(posts, currentTag, currentQuery);
          enableTagDragging(tagMount);
        } catch (error) {
          tagMount.innerHTML = '<div class="empty-state">Tag Map 暂时无法加载。</div>';
        }
      }

      if (statusMount) {
        const activeFilters = [];
        if (currentTag) activeFilters.push(`tag：<strong>${escapeHtml(currentTag)}</strong>`);
        if (currentQuery) activeFilters.push(`搜索：<strong>${escapeHtml(currentQuery)}</strong>`);
        statusMount.innerHTML = activeFilters.length
          ? `${activeFilters.join(" · ")} · ${filteredPosts.length} 篇文章 · 第 ${currentPage} / ${pageCount} 页 · <a href="blog.html">清除筛选</a>`
          : `全部文章 · ${posts.length} 篇 · 第 ${currentPage} / ${pageCount} 页`;
      }

      if (!posts.length) {
        mount.innerHTML = '<div class="empty-state">这里会放我的博客。第一篇文章准备好之后，会显示在这里。</div>';
        return;
      }

      if (!filteredPosts.length) {
        mount.innerHTML = '<div class="empty-state">暂时没有匹配的文章。</div>';
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
                <a class="tag-pill" href="${getBlogUrl({ tag, q: currentQuery })}">
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
        paginationMount.innerHTML = renderPagination(currentTag, currentQuery, currentPage, pageCount);
      }
    } catch (error) {
      mount.innerHTML = '<div class="empty-state">博客列表暂时无法加载。</div>';
    }
  };

  const renderBlogStats = (posts) => {
    const latest = posts[0];

    return `
      <div class="blog-stat">
        <strong>${posts.length}</strong>
        <span>Total posts</span>
      </div>
      ${latest ? `
        <a class="blog-stat" href="post.html?slug=${encodeURIComponent(latest.slug)}">
          <strong>${formatDate(latest.date)}</strong>
          <span>Latest</span>
        </a>
      ` : ""}
    `;
  };

  const renderBlogFrequency = (posts) => {
    const counts = new Map();
    posts.forEach((post) => {
      if (!post.date) return;
      counts.set(post.date, (counts.get(post.date) || 0) + 1);
    });

    const entries = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));

    if (!entries.length) {
      return '<div class="empty-state">No post dates yet.</div>';
    }

    const sortedDates = entries.map(([date]) => date);
    const latestDate = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00`);
    const startDate = new Date(latestDate);
    startDate.setDate(startDate.getDate() - 69);
    const maxCount = Math.max(...entries.map(([, count]) => count));
    const cells = [];

    for (let offset = 0; offset < 70; offset += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      const iso = date.toISOString().slice(0, 10);
      const count = counts.get(iso) || 0;
      const level = count === 0 ? 0 : Math.max(1, Math.ceil((count / maxCount) * 4));
      cells.push(`
        <span
          class="frequency-cell level-${level}"
          title="${escapeHtml(iso)} · ${count} posts"
          aria-label="${escapeHtml(iso)} · ${count} posts"
        ></span>
      `);
    }

    return `
      <div class="frequency-heatmap" role="img" aria-label="Post frequency heatmap">
        ${cells.join("")}
      </div>
    `;
  };

  const renderPagination = (tag, q, currentPage, pageCount) => {
    if (pageCount <= 1) return "";

    const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
      .map((page) => {
        const current = page === currentPage ? ' aria-current="page"' : "";
        return `<a href="${getBlogUrl({ tag, q, page })}"${current}>${page}</a>`;
      })
      .join("");

    const previous =
      currentPage > 1
        ? `<a class="pagination-step" href="${getBlogUrl({ tag, q, page: currentPage - 1 })}">Prev</a>`
        : '<span class="pagination-step is-disabled">Prev</span>';
    const next =
      currentPage < pageCount
        ? `<a class="pagination-step" href="${getBlogUrl({ tag, q, page: currentPage + 1 })}">Next</a>`
        : '<span class="pagination-step is-disabled">Next</span>';

    return `${previous}<div class="pagination-pages">${pages}</div>${next}`;
  };

  const enableTagDragging = (mount) => {
    const svg = mount.querySelector(".tag-network");
    if (!svg) return;

    enableTagPhysics(svg);
  };

  const enableTagPhysics = (svg) => {
    const initialBox = svg.viewBox.baseVal;
    const bounds = {
      height: initialBox.height,
      width: initialBox.width,
      x: initialBox.x,
      y: initialBox.y
    };
    const view = { ...bounds };
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const nodeElements = new Map();
    const labelElements = new Map();
    let draggedNode = null;
    let panning = null;
    let suppressClickUntil = 0;
    let frameId = null;

    const setViewBox = () => {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    };

    const nodes = Array.from(svg.querySelectorAll(".tag-node")).map((node) => {
      const transform = node.getAttribute("transform") || "translate(0 0)";
      const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      const data = {
        id: node.dataset.tag,
        count: Number(node.dataset.count || 1),
        radius: Number(node.dataset.radius || 24),
        vx: 0,
        vy: 0,
        x: match ? Number(match[1]) : centerX,
        y: match ? Number(match[2]) : centerY
      };
      nodeElements.set(data.id, node);
      return data;
    });

    svg.querySelectorAll(".tag-node-label").forEach((label) => {
      labelElements.set(label.dataset.tag, label);
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const links = Array.from(svg.querySelectorAll(".tag-edge"))
      .map((edge) => ({
        element: edge,
        source: nodeById.get(edge.dataset.source),
        target: nodeById.get(edge.dataset.target),
        count: Number(edge.dataset.count || 1)
      }))
      .filter((link) => link.source && link.target);

    const clamp = (node) => {
      node.x = Math.max(bounds.x + node.radius + 12, Math.min(bounds.x + bounds.width - node.radius - 12, node.x));
      node.y = Math.max(bounds.y + node.radius + 12, Math.min(bounds.y + bounds.height - node.radius - 30, node.y));
    };

    const render = () => {
      nodes.forEach(clamp);

      links.forEach((link) => {
        link.element.setAttribute("x1", link.source.x);
        link.element.setAttribute("y1", link.source.y);
        link.element.setAttribute("x2", link.target.x);
        link.element.setAttribute("y2", link.target.y);
      });

      nodes.forEach((node) => {
        const nodeElement = nodeElements.get(node.id);
        const labelElement = labelElements.get(node.id);
        if (nodeElement) {
          nodeElement.setAttribute("transform", `translate(${node.x} ${node.y})`);
        }
        if (labelElement) {
          labelElement.setAttribute("x", node.x);
          labelElement.setAttribute("y", node.y + node.radius + 18);
        }
      });
    };

    const step = () => {
      links.forEach((link) => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const desired = Math.max(135, 210 - link.count * 12);
        const strength = 0.0022 + link.count * 0.001;
        const force = (distance - desired) * strength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (link.source !== draggedNode) {
          link.source.vx += fx;
          link.source.vy += fy;
        }
        if (link.target !== draggedNode) {
          link.target.vx -= fx;
          link.target.vy -= fy;
        }
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const minimum = a.radius + b.radius + 52;
          const push = Math.max(0, minimum - distance) * 0.026 + 86 / (distance * distance);
          const fx = (dx / distance) * push;
          const fy = (dy / distance) * push;

          if (a !== draggedNode) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (b !== draggedNode) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      nodes.forEach((node) => {
        if (node !== draggedNode) {
          node.vx += (centerX - node.x) * 0.0013;
          node.vy += (centerY - node.y) * 0.0014;
          node.vx *= 0.9;
          node.vy *= 0.9;
          node.x += node.vx;
          node.y += node.vy;
        }
        clamp(node);
      });

      render();
      frameId = window.requestAnimationFrame(step);
    };

    const getPoint = (event) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse());
    };

    const start = () => {
      if (!frameId) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    svg.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const point = getPoint(event);
        const factor = event.deltaY < 0 ? 0.88 : 1.12;
        const nextWidth = Math.max(bounds.width * 0.45, Math.min(bounds.width * 1.75, view.width * factor));
        const nextHeight = Math.max(bounds.height * 0.45, Math.min(bounds.height * 1.75, view.height * factor));
        const ratioX = (point.x - view.x) / view.width;
        const ratioY = (point.y - view.y) / view.height;
        view.x = point.x - nextWidth * ratioX;
        view.y = point.y - nextHeight * ratioY;
        view.width = nextWidth;
        view.height = nextHeight;
        setViewBox();
      },
      { passive: false }
    );

    svg.addEventListener("pointerdown", (event) => {
      if (!event.target.classList.contains("tag-pan-layer")) return;
      panning = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewHeight: view.height,
        viewWidth: view.width,
        viewX: view.x,
        viewY: view.y
      };
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener("pointermove", (event) => {
      if (!panning) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const dx = ((event.clientX - panning.clientX) / rect.width) * panning.viewWidth;
      const dy = ((event.clientY - panning.clientY) / rect.height) * panning.viewHeight;
      view.x = panning.viewX - dx;
      view.y = panning.viewY - dy;
      setViewBox();
    });

    svg.addEventListener("pointerup", () => {
      panning = null;
    });

    svg.addEventListener("pointercancel", () => {
      panning = null;
    });

    svg.querySelectorAll(".tag-node-link").forEach((link) => {
      const node = nodeById.get(link.dataset.tag);
      if (!node) return;

      link.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const point = getPoint(event);
        draggedNode = node;
        node.dragStartX = point.x;
        node.dragStartY = point.y;
        node.dragOffsetX = point.x - node.x;
        node.dragOffsetY = point.y - node.y;
        node.vx = 0;
        node.vy = 0;
        link.setPointerCapture(event.pointerId);
        start();
      });

      link.addEventListener("pointermove", (event) => {
        if (draggedNode !== node) return;
        event.preventDefault();
        const point = getPoint(event);
        node.x = point.x - node.dragOffsetX;
        node.y = point.y - node.dragOffsetY;
        clamp(node);
        node.vx = 0;
        node.vy = 0;
        if (Math.hypot(point.x - node.dragStartX, point.y - node.dragStartY) > 4) {
          suppressClickUntil = Date.now() + 220;
        }
        render();
      });

      link.addEventListener("pointerup", () => {
        draggedNode = null;
      });

      link.addEventListener("pointercancel", () => {
        draggedNode = null;
      });

      link.addEventListener("click", (event) => {
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
        }
      });
    });

    render();
    start();
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
