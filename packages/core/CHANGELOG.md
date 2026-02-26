# Changelog

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
