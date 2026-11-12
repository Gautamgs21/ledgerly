# LEDGERLY (static front end)

Host this folder on GitHub Pages. It must be served over http(s), not opened as a file.

    index.html        shell: top bar, bottom bar, loading space, login modal
    css/app.css       shared styles
    js/config.js      set API_BASE_URL here (empty = demo mode with sample data)
    js/core.js        app state, events, toast, page router
    js/api.js         the ONLY place that talks to the backend
    js/auth.js        PIN login
    js/mock-api.js    demo backend (only used when API_BASE_URL is empty)
    pages/            dashboard.html, new-entry.html, history.html, settings.html

Each page file = its markup + its own <style> + one <script> that returns { onShow, onHide }.
To add a page: create pages/x.html, add it to PAGES in js/core.js, add a nav button in index.html.
