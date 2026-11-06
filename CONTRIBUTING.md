# Contributing to RKX API Studio

Thank you for helping improve RKX API Studio. This guide explains how contributions are reviewed and released.

## How releases are made

This repository is the public source of the free RKX API Studio plugin. Releases are prepared by the RKXBeta team and published to the [WordPress.org Plugin Directory](https://wordpress.org/plugins/rkx-api-studio/).

When we accept a pull request, we apply the change to our release source and test it together with the RKX API Studio Pro add-on. It is then published in this repository as part of the next sync. Your pull request is then merged or closed with a link to the commit that contains your change. Either way, you stay credited as the author through a `Co-authored-by` trailer and in the changelog.

Because of this, the `main` branch is updated by maintainers only. Please always open a pull request instead of asking for direct push access.

## Before you start

- **Bugs:** open an issue using the bug report form. Include your WordPress and PHP versions and steps to reproduce.
- **Features:** open a feature request first, so we can agree on the approach before you write code.
- **Security issues:** do not open an issue. Follow [SECURITY.md](SECURITY.md).
- **Pro add-on:** questions about Pro features, licences or purchases go to [RKXBeta support](https://rkxbeta.com/contact), not to this repository.

## Pull request checklist

1. Keep each pull request focused on one change.
2. Follow the [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/) for PHP and JavaScript.
3. Make all user-facing text translatable with the `rkx-api-studio` text domain.
4. Escape output, sanitise input, and check capabilities and nonces for every admin or REST action.
5. Do not add external requests, tracking or remote assets. The plugin must keep working without any external service.
6. Do not change the public PHP functions, hooks or REST routes without discussing it first. Other code, including the Pro add-on, depends on them.
7. If you change files in `plugins/rkx-api-studio/src/`, run `npm ci && npm run build` and commit the updated `plugins/rkx-api-studio/build/` files.
8. Do not change the plugin version number or `Stable tag`. Maintainers do that at release time.
9. Sign off your commits (see below).

## Developer Certificate of Origin

By contributing, you certify that you wrote the contribution or otherwise have the right to submit it under the GPL-2.0-or-later licence, as described in the [Developer Certificate of Origin 1.1](https://developercertificate.org/).

Add a sign-off line to every commit:

```sh
git commit -s -m "Fix the endpoint preview for empty taxonomies"
```

This adds `Signed-off-by: Your Name <your@email>` to the commit message.

## Licence

All contributions are distributed under the [GNU General Public License v2.0 or later](LICENSE), the same licence as the plugin.
