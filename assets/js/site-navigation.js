(() => {
  const siteNav = document.querySelector('.site-nav');
  const main = document.querySelector('main');
  if (!siteNav || !main) return;

  const pageLinks = [...siteNav.querySelectorAll('a[href][data-page]')];
  const routesByPath = new Map(
    pageLinks.map((link) => [new URL(link.href).pathname, link.dataset.page]),
  );
  const isLocalFile = window.location.protocol === 'file:';
  const routeFromPath = (path) => routesByPath.get(path) || null;
  const routeFromLocation = () =>
    (isLocalFile && window.location.hash.slice(1)) ||
    routeFromPath(window.location.pathname);
  let currentRoute = routeFromPath(window.location.pathname);
  const localPageCache = new Map([[currentRoute, { html: main.innerHTML, title: document.title }]]);

  function setCurrentPage(route) {
    pageLinks.forEach((link) => {
      if (link.dataset.page === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function routeState(route, html, title) {
    return { page: route, html, title };
  }

  function renderLocalPage(route, { push = true } = {}) {
    // file:// blocks sibling-page fetches, so each destination is embedded as a template.
    const cached = localPageCache.get(route);
    const template = cached ? null : [...document.querySelectorAll('template[data-page]')]
      .find((candidate) => candidate.dataset.page === route);
    if (!cached && !template) return false;

    const html = cached?.html ?? template.innerHTML;
    const title = cached?.title ?? template.dataset.title ?? document.title;
    main.innerHTML = html;
    document.title = title;
    localPageCache.set(route, { html, title });
    currentRoute = route;
    setCurrentPage(route);
    if (push) {
      history.pushState(routeState(route, html, title), '', `#${encodeURIComponent(route)}`);
    }
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('portfolio:navigate'));
    return true;
  }

  async function showHttpPage(url, route, { push = true } = {}) {
    try {
      const response = await fetch(url.href, {
        headers: { Accept: 'text/html' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Navigation returned ${response.status}`);
      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = nextDocument.querySelector('main');
      if (!nextMain) throw new Error('The destination page has no main content.');

      main.replaceChildren(...nextMain.childNodes);
      document.title = nextDocument.title;
      currentRoute = route;
      setCurrentPage(route);
      if (push) history.pushState({ page: route }, '', url.href);
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('portfolio:navigate'));
    } catch (_) {
      // Preserve native links when a server-side route cannot be loaded.
      window.location.assign(url.href);
    }
  }

  siteNav.addEventListener('click', (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest('a[href][data-page]') : null;
    if (!link || !pageLinks.includes(link) || event.defaultPrevented ||
        event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.target || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.href);
    const route = link.dataset.page;
    if (url.origin !== window.location.origin || !routesByPath.has(url.pathname) ||
        route === currentRoute) return;

    event.preventDefault();
    if (isLocalFile) {
      if (!renderLocalPage(route)) window.location.assign(url.href);
    } else {
      void showHttpPage(url, route);
    }
  });

  window.addEventListener('popstate', (event) => {
    if (isLocalFile) {
      const state = event.state;
      if (state?.page && typeof state.html === 'string') {
        main.innerHTML = state.html;
        document.title = state.title || document.title;
        localPageCache.set(state.page, { html: state.html, title: document.title });
        currentRoute = state.page;
        setCurrentPage(currentRoute);
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event('portfolio:navigate'));
        return;
      }
      const route = routeFromLocation();
      if (route && route !== currentRoute) renderLocalPage(route, { push: false });
      return;
    }

    const url = new URL(window.location.href);
    const route = routeFromPath(url.pathname);
    if (route && route !== currentRoute) void showHttpPage(url, route, { push: false });
  });

  if (isLocalFile) {
    const initialRoute = routeFromLocation();
    if (initialRoute && initialRoute !== currentRoute) {
      renderLocalPage(initialRoute, { push: false });
    }
    history.replaceState(
      routeState(currentRoute, main.innerHTML, document.title),
      '',
      window.location.href,
    );
  }
})();
