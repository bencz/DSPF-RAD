# Releasing IronTerm Studio

Desktop releases are built by `.github/workflows/release.yml`. A release starts
when a tag matching `v*` is pushed. The workflow first runs the engine tests and
frontend build, then creates a draft GitHub release and builds each platform in
its native runner.

## Generated packages

| Platform | Architecture | Packages |
| --- | --- | --- |
| Linux | x86-64 | DEB, RPM, AppImage |
| Windows | x86-64 | NSIS EXE, MSI |
| macOS | Intel | DMG, PKG |
| macOS | Apple Silicon | DMG, PKG |

Tauri creates the native application bundles, installers, and disk images. The
macOS PKG is created from the resulting application bundle with `pkgbuild` and
uploaded to the same draft release.

## Version preparation

Before creating a tag, update the same semantic version in:

- `package.json` and `package-lock.json`;
- `src/product.js`;
- `src-tauri/Cargo.toml`;
- `src-tauri/tauri.conf.json`.

Run:

```sh
npm ci
npm test
npm run build
npm run desktop:check
```

Commit the version change, create a tag such as `v0.10.0`, and push the tag.
After every matrix job succeeds, review the generated draft and publish it from
GitHub Releases.

## Signing and notarization

Unsigned packages can be used for internal validation, but public releases
should be signed. Configure the applicable repository secrets without placing
their values in source control:

- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and
  `APPLE_SIGNING_IDENTITY` for macOS code signing;
- `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` for Apple notarization;
- `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for Tauri updater signatures when the
  updater is enabled in a future release;
- the Windows signing configuration required by the selected certificate
  provider when Windows signing is introduced.

The initial workflow deliberately keeps updater metadata disabled until an
updater endpoint and public-key distribution policy are implemented.

