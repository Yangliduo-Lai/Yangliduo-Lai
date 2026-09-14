#!/usr/bin/env python3
"""Serve this site locally and save edits to any blog article body."""

from __future__ import annotations

import argparse
import base64
import binascii
import html
import json
import os
import re
import tempfile
import threading
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


PROJECT_ROOT = Path(__file__).resolve().parent
BLOGS_ROOT = PROJECT_ROOT / "blogs"
START_MARKER = "<!-- LOCAL_EDITOR_START -->"
END_MARKER = "<!-- LOCAL_EDITOR_END -->"
MAX_REQUEST_BYTES = 2 * 1024 * 1024
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_REQUEST_BYTES = 14 * 1024 * 1024
SAVE_LOCK = threading.Lock()
EDITOR_ASSETS = (
    '  <link rel="stylesheet" href="/blogs/local-editor.css?v=3">\n'
    '  <script src="/blogs/local-editor.js?v=3" defer></script>\n'
)


class ArticleBodyLocator(HTMLParser):
    """Locate the source range of a possibly nested .article-body div."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_offsets = [0]
        for match in re.finditer("\n", source):
            self.line_offsets.append(match.end())
        self.start: int | None = None
        self.end: int | None = None
        self.depth = 0
        self.matches = 0

    def absolute_offset(self) -> int:
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "div":
            return
        classes = dict(attrs).get("class", "") or ""
        is_article_body = "article-body" in classes.split()
        if self.start is None and is_article_body:
            self.start = self.absolute_offset()
            self.depth = 1
            self.matches += 1
        elif self.start is not None and self.end is None:
            self.depth += 1
            if is_article_body:
                self.matches += 1
        elif is_article_body:
            self.matches += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "div" or self.start is None or self.end is not None:
            return
        self.depth -= 1
        if self.depth:
            return
        closing = re.match(r"</div\s*>", self.source[self.absolute_offset() :], re.IGNORECASE)
        if closing:
            self.end = self.absolute_offset() + closing.end()


def find_article_bounds(source: str) -> tuple[int, int]:
    locator = ArticleBodyLocator(source)
    locator.feed(source)
    locator.close()
    if locator.start is None or locator.end is None or locator.matches != 1:
        raise ValueError("页面必须包含且只能包含一个 article-body")
    return locator.start, locator.end


def resolve_article_path(page_path: object) -> Path:
    if not isinstance(page_path, str):
        raise ValueError("缺少当前文章地址")
    url_path = unquote(urlparse(page_path).path)
    relative = Path(url_path.lstrip("/"))
    if not relative.parts or ".." in relative.parts or relative.suffix.lower() != ".html":
        raise ValueError("文章地址无效")
    candidate = (PROJECT_ROOT / relative).resolve()
    try:
        candidate.relative_to(BLOGS_ROOT.resolve())
    except ValueError as error:
        raise ValueError("只能保存 blogs 目录中的文章") from error
    if not candidate.is_file():
        raise ValueError("找不到对应的文章文件")
    return candidate


def inject_editor_assets(source: str) -> str:
    try:
        find_article_bounds(source)
    except ValueError:
        return source
    if "local-editor.js" in source:
        return source
    closing_head = re.search(r"</head\s*>", source, re.IGNORECASE)
    if not closing_head:
        return source
    return source[: closing_head.start()] + EDITOR_ASSETS + source[closing_head.start() :]


def replace_article_title(source: str, title: str) -> str:
    article_start, _ = find_article_bounds(source)
    before_article = source[:article_start]
    post_header = re.search(
        r'<header\b[^>]*\bclass="[^"]*\bpost-header\b[^"]*"[^>]*>.*?</header\s*>',
        before_article,
        re.IGNORECASE | re.DOTALL,
    )
    if not post_header:
        raise ValueError("找不到文章标题区域")

    escaped_text = html.escape(title, quote=False)
    header_html = post_header.group(0)
    header_html, heading_count = re.subn(
        r'(<h1\b[^>]*>).*?(</h1\s*>)',
        lambda match: match.group(1) + escaped_text + match.group(2),
        header_html,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if heading_count != 1:
        raise ValueError("找不到文章主标题")
    updated = source[: post_header.start()] + header_html + source[post_header.end() :]
    updated, document_title_count = re.subn(
        r'(<title\b[^>]*>).*?(</title\s*>)',
        lambda match: match.group(1) + escaped_text + match.group(2),
        updated,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if document_title_count != 1:
        raise ValueError("找不到浏览器标题")
    return updated


def update_index_card(source: str, index_path: Path, article_path: Path, title: str) -> str:
    escaped_text = html.escape(title, quote=False)
    escaped_attribute = html.escape(title, quote=True)
    card_pattern = re.compile(
        r'(?P<open><a\b(?=[^>]*\bclass="[^"]*\bpost-card\b)[^>]*>)'
        r'(?P<body>.*?)(?P<close></a\s*>)',
        re.IGNORECASE | re.DOTALL,
    )

    def replace_card(match: re.Match[str]) -> str:
        opening = match.group("open")
        href = re.search(r'\bhref="([^"]+)"', opening, re.IGNORECASE)
        if not href:
            return match.group(0)
        destination = (index_path.parent / unquote(urlparse(href.group(1)).path)).resolve()
        if destination != article_path.resolve():
            return match.group(0)

        if re.search(r'\bdata-title="[^"]*"', opening, re.IGNORECASE):
            opening = re.sub(
                r'\bdata-title="[^"]*"',
                lambda _: f'data-title="{escaped_attribute}"',
                opening,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            opening = opening[:-1] + f' data-title="{escaped_attribute}">'
        body = re.sub(
            r'(<h2\b[^>]*>).*?(</h2\s*>)',
            lambda heading: heading.group(1) + escaped_text + heading.group(2),
            match.group("body"),
            count=1,
            flags=re.IGNORECASE | re.DOTALL,
        )
        return opening + body + match.group("close")

    return card_pattern.sub(replace_card, source)


def write_text_atomic(path: Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=".blog-edit-",
        suffix=".tmp",
        delete=False,
    ) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.chmod(path.stat().st_mode)
    os.replace(temporary_path, path)


def detect_image_extension(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


class EditorHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        request_path = urlparse(self.path).path
        if request_path == "/__local_editor/status":
            if self.headers.get("X-Local-Editor") != "1":
                self.send_json(403, {"error": "缺少本地编辑器标记"})
                return
            self.send_json(200, {"ok": True})
            return

        try:
            article_path = resolve_article_path(request_path)
            source = article_path.read_text(encoding="utf-8")
            rendered = inject_editor_assets(source)
        except (OSError, UnicodeError, ValueError):
            super().do_GET()
            return

        body = rendered.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        request_path = urlparse(self.path).path
        if request_path not in {"/__local_editor/save", "/__local_editor/upload-image"}:
            self.send_json(404, {"error": "未知的保存地址"})
            return
        if self.client_address[0] not in {"127.0.0.1", "::1"}:
            self.send_json(403, {"error": "只允许本机保存"})
            return
        if self.headers.get("X-Local-Editor") != "1":
            self.send_json(403, {"error": "缺少本地编辑器标记"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Content-Length 无效"})
            return
        request_limit = MAX_IMAGE_REQUEST_BYTES if request_path.endswith("upload-image") else MAX_REQUEST_BYTES
        if not 0 < content_length <= request_limit:
            self.send_json(413, {"error": "保存内容为空或过大"})
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise TypeError
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
            self.send_json(400, {"error": "保存数据格式无效"})
            return

        if request_path.endswith("upload-image"):
            self.save_image(payload)
        else:
            self.save_article(payload)

    def save_article(self, payload: dict[str, object]) -> None:
        try:
            article_html_value = payload["article_html"]
            title_value = payload["article_title"]
            if not isinstance(article_html_value, str) or not isinstance(title_value, str):
                raise TypeError
            article_html = article_html_value.strip()
            article_title = title_value.strip()
            article_path = resolve_article_path(payload.get("page_path"))
        except (KeyError, AttributeError, TypeError):
            self.send_json(400, {"error": "保存数据格式无效"})
            return
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        if not 1 <= len(article_title) <= 200 or any(ord(character) < 32 for character in article_title):
            self.send_json(400, {"error": "标题必须是 1–200 个字符的单行文本"})
            return

        valid_root = re.match(
            r'^<div\b(?=[^>]*\bclass="[^"]*\barticle-body\b)[^>]*>',
            article_html,
        )
        forbidden = ("<script", "</body", "</html", START_MARKER.lower(), END_MARKER.lower())
        try:
            submitted_bounds = find_article_bounds(article_html)
        except ValueError:
            submitted_bounds = None
        if (
            not valid_root
            or submitted_bounds != (0, len(article_html))
            or any(token in article_html.lower() for token in forbidden)
        ):
            self.send_json(400, {"error": "正文 HTML 未通过安全检查"})
            return

        try:
            with SAVE_LOCK:
                source = article_path.read_text(encoding="utf-8")
                start, end = find_article_bounds(source)
                updated = source[:start] + article_html + source[end:]
                updated = replace_article_title(updated, article_title)

                index_updates: list[tuple[Path, str]] = []
                for index_path in sorted(BLOGS_ROOT.glob("index*.html")):
                    index_source = index_path.read_text(encoding="utf-8")
                    index_updated = update_index_card(index_source, index_path, article_path, article_title)
                    if index_updated != index_source:
                        index_updates.append((index_path, index_updated))

                write_text_atomic(article_path, updated)
                for index_path, index_updated in index_updates:
                    write_text_atomic(index_path, index_updated)
        except (OSError, ValueError) as error:
            self.send_json(500, {"error": f"无法写入文章：{error}"})
            return

        self.send_json(200, {"ok": True})

    def save_image(self, payload: dict[str, object]) -> None:
        try:
            article_path = resolve_article_path(payload.get("page_path"))
            filename = payload["filename"]
            image_data = payload["image_data"]
            if not isinstance(filename, str) or not isinstance(image_data, str):
                raise TypeError
            source = article_path.read_text(encoding="utf-8")
            find_article_bounds(source)
        except (KeyError, OSError, TypeError, ValueError) as error:
            self.send_json(400, {"error": f"图片目标无效：{error}"})
            return

        encoded = re.fullmatch(
            r"data:(image/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\r\n]+)",
            image_data,
            re.IGNORECASE,
        )
        if not encoded:
            self.send_json(400, {"error": "仅支持 PNG、JPEG、GIF 和 WebP 图片"})
            return
        try:
            raw_image = base64.b64decode(encoded.group(2), validate=True)
        except (binascii.Error, ValueError):
            self.send_json(400, {"error": "图片数据损坏"})
            return
        if not raw_image or len(raw_image) > MAX_IMAGE_BYTES:
            self.send_json(413, {"error": "图片为空或超过 10 MB"})
            return

        extension = detect_image_extension(raw_image)
        expected_mime = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}
        if extension is None or encoded.group(1).lower() != expected_mime[extension]:
            self.send_json(400, {"error": "图片格式与文件内容不匹配"})
            return

        safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(filename).stem).strip("-_")[:60] or "image"
        asset_root = (PROJECT_ROOT / "assets" / "blog-images").resolve()
        asset_directory = (asset_root / article_path.stem).resolve()
        try:
            asset_directory.relative_to(asset_root)
        except ValueError:
            self.send_json(400, {"error": "图片保存目录无效"})
            return

        try:
            with SAVE_LOCK:
                asset_directory.mkdir(parents=True, exist_ok=True)
                image_path = asset_directory / f"{safe_stem}.{extension}"
                suffix = 2
                while image_path.exists():
                    image_path = asset_directory / f"{safe_stem}-{suffix}.{extension}"
                    suffix += 1
                with tempfile.NamedTemporaryFile(
                    mode="wb",
                    dir=asset_directory,
                    prefix=".image-upload-",
                    suffix=".tmp",
                    delete=False,
                ) as temporary:
                    temporary.write(raw_image)
                    temporary_path = Path(temporary.name)
                os.replace(temporary_path, image_path)
        except OSError as error:
            self.send_json(500, {"error": f"无法保存图片：{error}"})
            return

        relative_source = os.path.relpath(image_path, article_path.parent).replace(os.sep, "/")
        self.send_json(200, {"ok": True, "src": relative_source})


def main() -> None:
    parser = argparse.ArgumentParser(description="在浏览器中编辑并保存所有博客正文")
    parser.add_argument("--port", type=int, default=8787, help="本地端口，默认 8787")
    args = parser.parse_args()

    handler = partial(EditorHandler, directory=str(PROJECT_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    blog_url = f"http://127.0.0.1:{args.port}/blogs/index-zh.html"
    print(f"本地博客编辑器已启动：{blog_url}")
    print("从列表打开任意文章即可直接编辑并保存正文。")
    print("按 Ctrl+C 停止服务器。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n本地编辑器已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
