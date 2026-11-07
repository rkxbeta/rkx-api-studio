=== RKX API Studio ===
Contributors: rkxbeta, kyguney
Tags: rest-api, headless, api, endpoints
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 1.0.1
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build clean, read-only REST API endpoints for your content visually.

== Description ==
RKX API Studio lets administrators create and manage custom read-only (GET) REST API endpoints visually from the WordPress admin, returning only the response data that a headless front end, mobile app, or external integration needs.

= Free Capabilities =

* Visual endpoint builder with drag-and-drop field selection and a live JSON response preview.
* Data sources: posts, pages, and any public, REST-enabled custom post type or taxonomy.
* Configurable response fields: core post and term fields, author details, featured image URL, assigned taxonomy terms, and unprotected custom meta fields (post and term meta).
* Built-in field formatters including strip HTML tags, remove block comments, normalize whitespace, excerpt (55 words), truncate (200 characters), date formatting, uppercase, lowercase, slugify, and remove special characters.
* Query controls: items per page, offset, sort order and field, taxonomy term filters, or native WordPress REST query parameters.
* Optional response caching with configurable TTL and automatic invalidation when content changes.
* Optional API key authentication (`X-RKX-API-Studio-Key`) for individual endpoints.
* JSON export and import of endpoint configurations and cache settings.

All Free endpoints are served under the fixed REST namespace `rkx-api-studio/v1` (for example, `/wp-json/rkx-api-studio/v1/your-endpoint`). RKX API Studio works standalone and does not require an external account or license key.

= Extend RKX API Studio with Pro =

RKX API Studio Pro is a separately distributed add-on that extends the Free plugin with advanced capabilities for custom REST API development, integrations, and authentication:

* Custom REST API namespaces
* Write endpoints (`POST`, `PUT`, and `DELETE` operations)
* Advanced Custom Fields (ACF) and Secure Custom Fields (SCF) integration
* Structured Gutenberg block parsing
* Advanced multi-rule Regex formatters
* Named API keys with per-endpoint access assignment
* Single-item routes with a path parameter, such as `posts/{slug}` or `categories/{slug}`

Learn more on the [RKX API Studio product page](https://rkxbeta.com/plugins/rkx-api-studio).

= Video Tutorials =

* [RKX API Studio video tutorial on YouTube](https://www.youtube.com/watch?v=5KA5GXjbE60)

= Example project =

The Headless Journal is an open-source Astro front end published by RKXBeta to demonstrate RKX API Studio Free and Pro. Explore the published reference architecture, sample content, and three integration modes on [GitHub](https://github.com/rkxbeta/headless-wordpress-astro-demo).

== Security and data handling ==
* Only administrators (users with the manage_options capability) can create, change, import or delete endpoints and keys.
* Only post types and taxonomies that WordPress marks as public and REST-visible can be used as data sources. Only published, non-password-protected posts are returned.
* Protected custom fields (for example keys beginning with an underscore) are never exposed.
* Protected endpoints require the `X-RKX-API-Studio-Key` request header. The API key is shown once when generated and is stored only as a keyed hash.
* Endpoint configurations, settings, the key hash and the response cache are stored in your WordPress database. Deactivation keeps this data. Uninstalling deletes it only if you enable "Delete data on uninstall" in the settings; on Multisite data is always kept.
* Exports never contain API keys.

== External services ==
This plugin does not connect to any external service. It makes no remote requests for licensing, telemetry or updates, and loads no remote scripts, styles, fonts or images. Updates are provided through WordPress.org. Documentation and product information links in the admin interface open https://rkxbeta.com in your browser only when you click them.

== Source code ==
The plugin includes its unminified JavaScript, TypeScript and CSS sources and build instructions in the source/ directory (see source/BUILD.md). Third-party licenses and copyright notices are listed in THIRD-PARTY-NOTICES.txt.

== Documentation and support ==
[Documentation](https://rkxbeta.com/plugins/rkx-api-studio/docs) | [Contact and support](https://rkxbeta.com/contact)

== Installation ==
1. In your WordPress admin go to Plugins > Add New, search for "RKX API Studio", then install and activate it. Alternatively upload the plugin ZIP through Plugins > Add New > Upload Plugin.
2. Open RKX API Studio in the admin menu and create your first endpoint.
3. To protect endpoints, generate an API key under RKX API Studio > Settings > Security and enable "Require API Key" on the endpoint.

Requirements: WordPress 6.8 or later and PHP 8.0 or later.

== Frequently Asked Questions ==
= Which REST namespace do endpoints use? =
Every endpoint is available under `rkx-api-studio/v1`.

= Is data deleted during deactivation? =
No. Data is deleted only when you uninstall the plugin after enabling "Delete data on uninstall". If the RKX API Studio Pro add-on is still installed, or on Multisite, data is kept.

= Can endpoints write data? =
RKX API Studio Free provides read-only GET endpoints.

The separate RKX API Studio Pro add-on supports custom write endpoints (POST, PUT, and DELETE) that dispatch authenticated developer action hooks (`rkx_as_{method}_{slug}`). Write endpoints do not automatically create, update, or delete WordPress content; your application or custom plugin implements the action hooks, input validation, and database operations.

== Changelog ==
= 1.0.1 =
* Endpoint builder: when an installed extension serves an endpoint as a single-item route, pagination and ordering controls are hidden. Only taxonomy term filters remain, because they still decide which records match.
* JSON preview: single-item endpoints are previewed as one object, with a sample request URL built from a real record.
* The builder header and the endpoint list show the public route reported by an installed extension. "View API" is not offered for routes that need a slug or ID.
* Developers: new JavaScript filters `rkxAs.endpoint.routePath` and `rkxAs.endpoint.singleItem`.
* Readme: added a video tutorial link and the Headless Journal example project.
* No changes to REST responses, stored data or PHP code.

= 1.0.0 =
First public release.
