from __future__ import annotations

import json
import re
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from playwright.sync_api import Browser, Page, Playwright, Route, sync_playwright

DEFAULT_TARGET = "http://127.0.0.1:3000"
DEFAULT_VIEWPORT = {"width": 1280, "height": 800}
HOP_BY_HOP_HEADERS = {
    "connection",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}
REQUEST_HEADERS_TO_DROP = {
    "accept-encoding",
    "connection",
    "content-length",
    "host",
    "origin",
    "referer",
}


class ChatGPTBrowser:
    """ChromiumのURL制限を迂回せず、Vite応答をPlaywright経由で描画する検証用ブラウザ。"""

    def __init__(
        self,
        *,
        path: str = "/",
        target: str = DEFAULT_TARGET,
        viewport: dict[str, int] | None = None,
    ) -> None:
        if not path.startswith("/"):
            raise ValueError(f"path must start with '/': {path}")

        self.path = path
        self.target = target.rstrip("/")
        self.viewport = dict(viewport or DEFAULT_VIEWPORT)
        self.console_errors: list[str] = []
        self.page_errors: list[str] = []
        self.failed_requests: list[str] = []
        self.page: Page
        self.browser: Browser
        self._playwright: Playwright

    def __enter__(self) -> ChatGPTBrowser:
        self._playwright = sync_playwright().start()
        self.browser = self._playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/chromium",
        )
        self.page = self.browser.new_page(viewport=self.viewport)
        self.page.on(
            "console",
            lambda message: (
                self.console_errors.append(message.text)
                if message.type == "error"
                else None
            ),
        )
        self.page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        self.page.on(
            "requestfailed",
            lambda request: self.failed_requests.append(
                f"{request.url}: {request.failure}"
            ),
        )
        self.page.route(f"{self.target}/**", self._proxy)
        self.page.set_content(
            self._entry_html(),
            wait_until="domcontentloaded",
            timeout=15_000,
        )
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.browser.close()
        self._playwright.stop()

    def assert_no_browser_errors(self) -> None:
        errors = []
        if self.console_errors:
            errors.append(f"console.error: {self.console_errors}")
        if self.page_errors:
            errors.append(f"pageerror: {self.page_errors}")
        if self.failed_requests:
            errors.append(f"requestfailed: {self.failed_requests}")
        if errors:
            raise AssertionError("\n".join(errors))

    def _fetch(
        self,
        path: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: bytes | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        request = Request(
            self.target + path,
            data=data,
            headers=headers or {},
            method=method,
        )
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error

        response_headers = {
            key: value
            for key, value in response.headers.items()
            if key.lower() not in HOP_BY_HOP_HEADERS
        }
        return response.status, response_headers, response.read()

    def _entry_html(self) -> str:
        status, _, body = self._fetch("/")
        if status != 200:
            raise RuntimeError(f"Vite entry returned {status}")

        bootstrap = (
            f'<base href="{self.target}/">'
            f"<script>window.__PLAYWRIGHT_PATH__={json.dumps(self.path)}</script>"
        )
        return body.decode().replace("<head>", "<head>" + bootstrap, 1)

    def _proxy(self, route: Route) -> None:
        request = route.request
        url = urlsplit(request.url)
        path = url.path + (("?" + url.query) if url.query else "")
        headers = {
            key: value
            for key, value in request.headers.items()
            if key.lower() not in REQUEST_HEADERS_TO_DROP
        }
        status, response_headers, body = self._fetch(
            path,
            method=request.method,
            headers=headers,
            data=request.post_data_buffer,
        )

        if "@generouted_react-router.js" in url.path:
            body = self._patch_generouted(body)
            response_headers = {
                key: value
                for key, value in response_headers.items()
                if key.lower() != "content-length"
            }

        route.fulfill(status=status, headers=response_headers, body=body)

    def _patch_generouted(self, body: bytes) -> bytes:
        text = body.decode()
        browser_router_call = "createBrowserRouter(routes)"
        if browser_router_call not in text:
            raise RuntimeError("Generouted browser router call was not found")

        router_import = re.search(
            r'import \{([^\n]+createBrowserRouter[^\n]+)\} from "([^"]+)";',
            text,
        )
        if router_import is None:
            raise RuntimeError("Generouted browser router import was not found")

        bindings, router_chunk_path = router_import.groups()
        browser_binding = re.search(
            r"([A-Za-z_$][\w$]*) as createBrowserRouter",
            bindings,
        )
        if browser_binding is None:
            raise RuntimeError("createBrowserRouter binding was not found")

        _, _, router_chunk = self._fetch(router_chunk_path)
        memory_binding = re.search(
            r"createMemoryRouter as ([A-Za-z_$][\w$]*)",
            router_chunk.decode(),
        )
        if memory_binding is None:
            raise RuntimeError("createMemoryRouter export was not found")

        text = text.replace(
            f"{browser_binding.group(1)} as createBrowserRouter",
            f"{memory_binding.group(1)} as createMemoryRouter",
            1,
        )
        text = text.replace(
            browser_router_call,
            'createMemoryRouter(routes, { initialEntries: [window.__PLAYWRIGHT_PATH__ || "/"] })',
            1,
        )
        return text.encode()
