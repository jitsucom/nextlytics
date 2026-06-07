# Changelog

## [0.7.1](https://github.com/jitsucom/nextlytics/compare/v0.7.0...v0.7.1) (2026-06-07)


### Bug Fixes

* **core:** count only GET (not HEAD) as a pageView on non-API routes ([7afa8c2](https://github.com/jitsucom/nextlytics/commit/7afa8c2ef330073777a12a371b069de199f5cd6f))

## [0.7.0](https://github.com/jitsucom/nextlytics/compare/v0.6.0...v0.7.0) (2026-06-06)


### ⚠ BREAKING CHANGES

* **core:** non-navigation requests are now tracked as pageViews by default. Use excludePaths to opt specific paths out.

### Features

* **core:** track non-navigation requests as pageViews ([45e097d](https://github.com/jitsucom/nextlytics/commit/45e097d5f7dd270abed8dd89b7790e4219fc2d55))

## [0.6.0](https://github.com/jitsucom/nextlytics/compare/v0.5.1...v0.6.0) (2026-06-05)


### Features

* per-event user override in analytics().sendEvent() ([#43](https://github.com/jitsucom/nextlytics/issues/43)) ([446c0ca](https://github.com/jitsucom/nextlytics/commit/446c0ca4215a119a30ef04bee13b4514e9cd1f4e))

## [0.5.1](https://github.com/jitsucom/nextlytics/compare/v0.5.0...v0.5.1) (2026-06-05)


### Bug Fixes

* await delivery in analytics().sendEvent() ([#41](https://github.com/jitsucom/nextlytics/issues/41)) ([70030dd](https://github.com/jitsucom/nextlytics/commit/70030dd2bf2b36c99a5d3d830ebe4612e726c4f2))

## [0.5.0](https://github.com/jitsucom/nextlytics/compare/v0.4.2...v0.5.0) (2026-06-05)


### Features

* support analytics().sendEvent() from pages router api routes ([#39](https://github.com/jitsucom/nextlytics/issues/39)) ([b70ec61](https://github.com/jitsucom/nextlytics/commit/b70ec610821307e4f9c75556915cb2fbc87c7757))

## [0.4.2](https://github.com/jitsucom/nextlytics/compare/v0.4.1...v0.4.2) (2026-06-04)


### Bug Fixes

* deliver client-side templates to Pages Router clients ([#37](https://github.com/jitsucom/nextlytics/issues/37)) ([b515be4](https://github.com/jitsucom/nextlytics/commit/b515be4cde41db4f78d51525a7ed1a46dbc4e915))

## [0.4.1](https://github.com/jitsucom/nextlytics/compare/v0.4.0...v0.4.1) (2026-03-05)


### Bug Fixes

* suppress false "middleware not added" warning on RSC navigations ([9515437](https://github.com/jitsucom/nextlytics/commit/951543739e5923f0a1951801f2f239e63330914b))

## [0.4.0](https://github.com/jitsucom/nextlytics/compare/v0.3.1...v0.4.0) (2026-02-26)


### Features

* add getProps callback and pathMatcher utility ([4427598](https://github.com/jitsucom/nextlytics/commit/4427598f757650e7683475712ea269f2f88ea66e))
* add getProps callback and pathMatcher utility ([d6bd8a4](https://github.com/jitsucom/nextlytics/commit/d6bd8a47327f03352e7f93689b19c8c7e13ae918))


### Bug Fixes

* return undefined for early-return middleware paths ([ab0ce27](https://github.com/jitsucom/nextlytics/commit/ab0ce277384cd4fcbdeae3526d22c4a47cdf8e75))

## [0.3.1](https://github.com/jitsucom/nextlytics/compare/v0.3.0...v0.3.1) (2026-02-25)


### Bug Fixes

* abort stale soft navigation requests and simplify event handling ([0615b93](https://github.com/jitsucom/nextlytics/commit/0615b93743bcd42f8bc16f7623c0270dd279f543))
* handle soft navigation in App Router ([11efd46](https://github.com/jitsucom/nextlytics/commit/11efd46cc92d5579c7020c4bf424fa58228dea7c))
* prevent duplicate scripts on soft navigation ([6394b1b](https://github.com/jitsucom/nextlytics/commit/6394b1ba367a89c31c72de465d60fa02fe379006))
* prevent duplicate scripts on soft navigation ([#29](https://github.com/jitsucom/nextlytics/issues/29)) ([455402a](https://github.com/jitsucom/nextlytics/commit/455402a40069ea2049ffc5ada705aa2892dd324b))
* remove pathname from client-init deps to enable soft navigation detection ([8193f8f](https://github.com/jitsucom/nextlytics/commit/8193f8f596e55a29238dd98f8d1070ef1a450e6b))
* track soft navigations via client /api/event instead of middleware ([d83bd2c](https://github.com/jitsucom/nextlytics/commit/d83bd2c403b51db783c7186cabc69c0013147b5c))

## [0.3.0](https://github.com/jitsucom/nextlytics/compare/v0.2.2...v0.3.0) (2026-02-10)


### Features

* **core:** add ingestPolicy for per-backend event timing control ([6f2f163](https://github.com/jitsucom/nextlytics/commit/6f2f163259da833ad54164dcf4799958aac3a49a))
* **core:** add ingestPolicy for per-backend event timing control ([b77e9f9](https://github.com/jitsucom/nextlytics/commit/b77e9f9b9c98eaefb10f10bb80f161b1ab97bcf8))

## [0.2.2](https://github.com/jitsucom/nextlytics/compare/v0.2.1...v0.2.2) (2026-02-10)


### Bug Fixes

* **segment:** use batch endpoint for Jitsu compatibility ([452102f](https://github.com/jitsucom/nextlytics/commit/452102fe71ac6f47f527776097c2c48100169ab4))
* **segment:** use batch endpoint with X-Write-Key header for Jitsu compatibility ([b7732c1](https://github.com/jitsucom/nextlytics/commit/b7732c1e8a833aa39c33f59567b3944e53fffb0d))

## [0.2.1](https://github.com/jitsucom/nextlytics/compare/v0.2.0...v0.2.1) (2026-02-10)


### Bug Fixes

* **neon:** use sql.query() for @neondatabase/serverless 1.x ([2121e90](https://github.com/jitsucom/nextlytics/commit/2121e908d3779eef8deecb62d08d5836c6e6a6e8))
* **neon:** use sql.query() for @neondatabase/serverless 1.x ([2610419](https://github.com/jitsucom/nextlytics/commit/26104190eb8126a9395a9ac360d1533bd18c90f7)), closes [#18](https://github.com/jitsucom/nextlytics/issues/18)
* release-please changelog path and add automerge workflow ([#16](https://github.com/jitsucom/nextlytics/issues/16)) ([a17dbaa](https://github.com/jitsucom/nextlytics/commit/a17dbaa7e91addb6c4d50d2f8a4872ef3653c411))
* use CJS-only build for Next.js 15 compatibility ([f0d4b47](https://github.com/jitsucom/nextlytics/commit/f0d4b474cc62c66ce200b417f937b581caf1a4cb))

## [0.2.0](https://github.com/jitsucom/nextlytics/compare/core-v0.1.0...core-v0.2.0) (2026-02-06)


### Features

* add e2e testing infrastructure ([6159cd9](https://github.com/jitsucom/nextlytics/commit/6159cd9a8cc7a61452621069e0b3d10466a64396))
* add e2e testing infrastructure ([#10](https://github.com/jitsucom/nextlytics/issues/10)) ([94ccf07](https://github.com/jitsucom/nextlytics/commit/94ccf072040cc2e3aa99780408c4ec13d925115b))
* add Pages Router support ([bfae81c](https://github.com/jitsucom/nextlytics/commit/bfae81ca940c82d0a2b85854d93d844459bacc6a))


### Bug Fixes

* improve RSC prefetch detection using next-url header ([0b14108](https://github.com/jitsucom/nextlytics/commit/0b14108296af3ad2c7bb21407e7083e804c0c378))
* prettier ([2322690](https://github.com/jitsucom/nextlytics/commit/2322690baa1c9dc863376af720523a2f446366e8))
