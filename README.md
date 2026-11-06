# RKX API Studio

Build clean, read-only REST API endpoints for your WordPress content visually.

RKX API Studio is a free WordPress plugin. You use it from the WordPress admin to create custom read-only (GET) REST API endpoints. Each endpoint returns only the fields a headless front end, mobile app or external integration needs.

- **Install:** [WordPress.org Plugin Directory](https://wordpress.org/plugins/rkx-api-studio/) (recommended; updates come from WordPress.org)
- **Documentation:** <https://rkxbeta.com/plugins/rkx-api-studio/docs>
- **Product page:** <https://rkxbeta.com/plugins/rkx-api-studio>

This repository holds the source code of the free plugin, published under the GPL. Please report bugs and suggest features here.

## Features

- Visual endpoint builder with drag-and-drop field selection and a live JSON preview.
- Data sources: posts, pages, and any public, REST-enabled custom post type or taxonomy.
- Core post and term fields, author details, featured image URL, taxonomy terms and unprotected custom meta fields.
- Built-in field formatters (strip HTML, remove block comments, excerpt, truncate, date formatting, case changes, slugify and more).
- Query controls: pagination, offset, ordering, taxonomy filters, or native WordPress REST query parameters.
- Optional response caching that is cleared automatically when content changes.
- Optional per-endpoint API key authentication (`X-RKX-API-Studio-Key`).
- JSON export and import of endpoint configurations.

All endpoints are served under the `rkx-api-studio/v1` REST namespace. The plugin makes no external requests and needs no account or licence key.

RKX API Studio Pro is a separate commercial add-on, sold and supported by [RKXBeta](https://rkxbeta.com/plugins/rkx-api-studio). Its code is not part of this repository. Please do not open issues here about Pro features, licences or purchases. Contact [RKXBeta support](https://rkxbeta.com/contact) for those.

## Requirements

| | Minimum | Tested up to |
|---|---|---|
| WordPress | 6.8 | 7.1 |
| PHP | 8.0 | 8.4 |

## Repository layout

```text
plugins/rkx-api-studio/        The plugin, exactly as distributed on WordPress.org
  rkx-api-studio.php           Plugin bootstrap
  uninstall.php                Uninstall routine
  includes/                    PHP runtime
  src/                         JavaScript/TypeScript/CSS source of the admin interface
  build/                       Compiled admin assets (generated from src/, committed)
  languages/                   Translation template
  readme.txt                   WordPress.org readme
package.json, package-lock.json, webpack.config.js   Build tooling (Node.js)
.wp-env.json                   Local WordPress environment for development
```

## Building from source

You need Node.js 24 and npm 11. Builds are reproducible: the committed `plugins/rkx-api-studio/build/` directory is exactly what `npm run build` produces from `src/` with the locked dependencies.

```sh
npm ci
npm run build
git diff --exit-code plugins/rkx-api-studio/build/   # no output means your build matches the committed one
```

During development, run `npm start` to rebuild automatically while you edit.

## Local development

The quickest way is [`wp-env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/), which needs Docker:

```sh
npm ci && npm run build
npm run env:start        # WordPress at http://localhost:8888 (admin / password)
```

To use an existing WordPress site instead, link the plugin directory into it:

```sh
ln -s "$(pwd)/plugins/rkx-api-studio" /path/to/wordpress/wp-content/plugins/rkx-api-studio
```

Then activate **RKX API Studio** under **Plugins**. If you only want to use the plugin, install it from WordPress.org instead.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.

## Security

Please do **not** report security issues in public issues. See [SECURITY.md](SECURITY.md).

## License

RKX API Studio is free software, licensed under the [GNU General Public License v2.0 or later](LICENSE).

Copyright (C) 2026 RKXBeta.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

Third-party components bundled in `build/` and their licences are listed in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
