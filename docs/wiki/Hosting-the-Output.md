# Hosting the Output

After ADT Studio has packaged a textbook, you have a self-contained web bundle — a `.zip` file containing HTML, CSS, JavaScript, images, and audio. This page covers your options for making that bundle available to learners.

---

## What the Output Is

The packaged output is a **static web application** — a folder of plain files that any web server can serve and any modern browser can run. It requires no back-end server, no database, and no runtime environment beyond a standard web server or CDN.

Key properties:

- **Works offline** — once downloaded, learners can use it without an internet connection (the bundle includes an offline manifest)
- **No installation required** — opens in any browser on any device
- **Self-contained** — all images, audio, and translation data are embedded in the bundle

---

## Hosting Options

### Option 1 — Direct file access (simplest, no server needed)

Unzip the bundle and open `index.html` directly in a browser. This works for individual use or review but is impractical for distributing to many learners.

```
Unzip → Open index.html in Chrome, Firefox, Edge, or Safari
```

> **Note**: Some browser security policies block certain features (such as audio) when a file is opened directly from the filesystem using `file://` URLs. Use a local web server for full functionality.

---

### Option 2 — USB drive or offline distribution

Copy the unzipped bundle to a USB drive. Learners plug in the drive and open `index.html` from the drive in their browser. This is well-suited to environments with no internet connectivity.

For better reliability, pair the USB distribution with a lightweight local web server that runs directly from the drive (such as [Servez](https://greggman.github.io/servez/) on Windows or a bundled Python server on Linux/macOS):

```bash
# Python 3 — run from inside the unzipped book folder
python3 -m http.server 8000
# Then open http://localhost:8000 in a browser
```

---

### Option 3 — Static file hosting services (recommended for online access)

These services are designed for hosting static HTML/JS/CSS sites. Most have a generous free tier.

| Service | Free tier | Custom domain | Notes |
|---------|-----------|---------------|-------|
| [GitHub Pages](https://pages.github.com/) | ✅ Yes | ✅ Yes | Ideal for open-access content; public repos are free |
| [Netlify](https://www.netlify.com/) | ✅ Yes | ✅ Yes | Drag-and-drop deploy; instant CDN |
| [Cloudflare Pages](https://pages.cloudflare.com/) | ✅ Yes | ✅ Yes | Global CDN, very fast |
| [Vercel](https://vercel.com/) | ✅ Yes | ✅ Yes | Simple drag-and-drop or CLI deploy |
| [AWS S3 + CloudFront](https://aws.amazon.com/cloudfront/) | ⚠️ Pay-as-you-go | ✅ Yes | Scalable; cost is low for typical textbook traffic |
| [Google Cloud Storage](https://cloud.google.com/storage) | ⚠️ Pay-as-you-go | ✅ Yes | Similar to S3 |
| [Azure Static Web Apps](https://azure.microsoft.com/en-us/products/app-service/static) | ✅ Free tier | ✅ Yes | Good choice if your organisation already uses Azure |

#### Deploy to Netlify (example)

1. Log in at [netlify.com](https://www.netlify.com/).
2. Go to **Sites → Add new site → Deploy manually**.
3. Drag and drop the unzipped book folder into the deploy area.
4. Netlify provides a public URL immediately (e.g. `https://your-book.netlify.app`).
5. Optionally configure a custom domain in **Site settings → Domain management**.

#### Deploy to GitHub Pages (example)

1. Create a new repository on GitHub (or use an existing one).
2. Unzip the bundle and push the contents to the repository's `main` branch.
3. Go to **Settings → Pages** and set the source to the `main` branch, root folder.
4. GitHub will publish the site at `https://<username>.github.io/<repo-name>/`.

---

### Option 4 — Your own server or VPS

If you manage your own server (Linux VPS, on-premises server, Raspberry Pi), serve the unzipped bundle using any web server:

**nginx** (recommended):
```nginx
server {
    listen 80;
    root /var/www/your-book;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Apache**:
```apache
<VirtualHost *:80>
    DocumentRoot /var/www/your-book
    <Directory /var/www/your-book>
        Options -Indexes
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>
</VirtualHost>
```

**Caddy** (automatic HTTPS):
```
your-domain.org {
    root * /var/www/your-book
    file_server
    try_files {path} /index.html
}
```

---

### Option 5 — Learning Management Systems (LMS)

The ADT bundle can be embedded in or linked from an LMS:

- **Moodle / Open edX / Canvas** — upload the zip and link to the unzipped folder, or use an iframe to embed the hosted URL
- **SCORM**: The current output is not SCORM-packaged. For SCORM integration, wrap the bundle in a SCORM manifest or use an LMS that supports linking to external URLs
- **Direct link** — the simplest approach is to host the bundle (using any option above) and paste the URL into your LMS as an external resource

---

### Option 6 — Government / Ministry digital content platforms

Many national education ministries operate their own digital content delivery platforms (e.g. national e-learning portals, educational intranets). Because the ADT output is plain HTML/CSS/JS with no server-side dependencies, it can be uploaded directly to any file hosting component of these platforms.

Contact your platform administrator to understand the upload and serving mechanism — the ADT bundle makes no assumptions beyond a standard web server.

---

## Distributing to Learners Without Internet

For learners in areas with limited or no internet connectivity:

1. **Pre-load devices** — copy the unzipped bundle onto school tablets or laptops before distribution; learners open `index.html` directly
2. **Local school server** — a Raspberry Pi or similar low-cost device running nginx can serve the bundle over a local Wi-Fi network to an entire classroom simultaneously
3. **USB sticks** — see [Option 2](#option-2--usb-drive-or-offline-distribution) above

The offline manifest built into the bundle means that once a learner has loaded the ADT in a browser while connected, subsequent access is served from the browser cache — no server connection required.

---

## Considerations Before Publishing

### Licensing
Ensure you have the rights to distribute the textbook content digitally. The ADT conversion process does not change the copyright status of the original work.

### Privacy
The ADT bundle is fully static — it collects no user data, sets no cookies, and makes no external network requests once loaded. There is nothing to configure from a privacy perspective.

### Accessibility review
Run a final accessibility check before publishing:
- Test with a screen reader (NVDA on Windows, VoiceOver on macOS/iOS, TalkBack on Android)
- Check colour contrast with a tool such as the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Validate HTML structure with the [W3C Nu HTML Checker](https://validator.w3.org/nu/)
- Run [axe](https://www.deque.com/axe/) or [WAVE](https://wave.webaim.org/) on several representative pages

### Large files
Audio files can make the bundle large. If bandwidth is a concern:
- Reduce the number of target languages (each language adds a full set of audio files)
- Use a CDN (Netlify, Cloudflare Pages, or CloudFront) to serve large assets efficiently

---

## Next Steps

- [Home](Home) — return to the wiki home page
- [Using ADT Studio](Using-ADT-Studio) — review how to produce the output bundle
