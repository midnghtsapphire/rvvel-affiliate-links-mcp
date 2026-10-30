# Changelog

## [Unreleased]

### Fixed
- Removed the auto-generated npm version/downloads/license and "Deployed 1.0.0" badges from README.md. The package `rvvel-affiliate-links-mcp` is not published on npm (registry returns 404), so the badges were false.
- Marked `package.json` as `"private": true` so badge generators (the auto-package-badges GitHub App) and `npm publish` don't treat it as a published package.

### Added
- `scripts/check-npm-badges.mjs` (`npm run check:badges`): fails if README.md links an npm package that the registry doesn't return.
