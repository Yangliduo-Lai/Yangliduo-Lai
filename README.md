# Yangliduo Lai

## Blog

这个仓库包含一个纯静态博客：

- `blog.html`: 博客列表页
- `post.html`: 单篇文章页
- `data/posts/posts.json`: 文章索引
- `data/posts/`: Markdown 文章目录

### 添加一篇博客

1. 在 `data/posts/` 目录下创建一篇 Markdown 文件，例如：

```text
data/posts/2026-06-18-my-first-post.md
```

2. 在 `data/posts/posts.json` 中添加一条记录：

```json
{
  "slug": "my-first-post",
  "title": "我的第一篇博客",
  "date": "2026-06-18",
  "summary": "这是一段会显示在博客列表里的摘要。",
  "tags": ["note"],
  "file": "data/posts/2026-06-18-my-first-post.md"
}
```

3. 提交并推送：

```bash
git add data/posts/posts.json data/posts/2026-06-18-my-first-post.md
git commit -m "post: add my first blog"
git push origin main
```

GitHub Pages 更新后，文章会出现在 `blog.html`。

<!--
**Yangliduo-Lai/Yangliduo-Lai** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.

Here are some ideas to get you started:

- 🔭 I’m currently working on ...
- 🌱 I’m currently learning ...
- 👯 I’m looking to collaborate on ...
- 🤔 I’m looking for help with ...
- 💬 Ask me about ...
- 📫 How to reach me: ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
-->
