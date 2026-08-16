# Yangliduo Lai — Personal Website

A lightweight academic portfolio built as a static site and deployed with GitHub
Pages. The supplied website informed the information structure; the visual system
is a quieter Apple-inspired interpretation with generous whitespace, neutral
surfaces, restrained purple/pink accents, and subtle motion.

## Preview locally

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765`.

## Replace the placeholder content

1. Open `index.html` and search for `EDIT-ME`.
2. Replace the biography, research themes, projects, publications, milestones,
   toolkit, contact details, and social links.
3. Put a portrait in `assets/`, then replace `.portrait-placeholder` with an
   `<img>` element.
4. Update the title, description, and social metadata in the `<head>`.
5. Update the animated hero labels in the `roles` array in `script.js`.

All links currently using `href="#"` are intentional placeholders.

## Deploy

The workflow in `.github/workflows/deploy-pages.yml` publishes on every push to
`main`. In GitHub, open **Settings → Pages** and choose **GitHub Actions** if it is
not already selected.

Expected URL: `https://yangliduo-lai.github.io/Yangliduo-Lai/`
