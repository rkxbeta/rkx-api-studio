# Contributing to RKX API Studio

Thank you for helping improve RKX API Studio. This guide explains how contributions are reviewed and released. Everyone taking part is expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How contributions flow

1. **Fork** this repository and create a branch for your change.
2. **Open a pull request** against `main`. Fill in the template.
3. **CI runs automatically**: a reproducible build check and PHP syntax checks on PHP 8.0 and 8.4. For first-time and outside contributors, a maintainer approves the workflow run first. CI never receives secrets or write access.
4. **Review.** A maintainer reviews the change. All review conversations must be resolved before merging.
5. **Integration testing.** Before merging, maintainers also test the change against the RKX API Studio Pro add-on, which depends on the free plugin's public functions, hooks and REST routes.
6. **Merge.** Accepted pull requests are **squash-merged** with you as the commit author, so you appear in the repository's contributors list. Co-authors listed with `Co-authored-by:` trailers are kept too.
7. **Release.** The change ships in the next version published on the [WordPress.org Plugin Directory](https://wordpress.org/plugins/rkx-api-studio/) and in [GitHub Releases](https://github.com/rkxbeta/rkx-api-studio/releases). Contributors are credited in the changelog.

Nobody pushes directly to `main`, maintainers included: every change goes through a pull request with passing checks.

## Before you start

- **Questions and ideas:** use [GitHub Discussions](https://github.com/rkxbeta/rkx-api-studio/discussions).

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
9. Do not update npm dependencies in a feature pull request. The committed `build/` must reproduce exactly from `package-lock.json`, so dependency updates are handled separately by maintainers.
10. Sign off your commits (see below).

## Developer Certificate of Origin

By contributing, you certify that you wrote the contribution or otherwise have the right to submit it under the GPL-2.0-or-later licence, as described in the [Developer Certificate of Origin 1.1](https://developercertificate.org/).

Add a sign-off line to every commit:

```sh
git commit -s -m "Fix the endpoint preview for empty taxonomies"
```

This adds `Signed-off-by: Your Name <your@email>` to the commit message.

## Licence

All contributions are distributed under the [GNU General Public License v2.0 or later](LICENSE), the same licence as the plugin.
