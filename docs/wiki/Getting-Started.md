# Getting Started

## Package status

Waylit is not currently published to npm. Build and pack it from the repository, then install the tarball into a consumer project:

```sh
git clone https://github.com/HimaniGaur/waylit.git
cd waylit
npm ci
npm run build:sdk
npm pack
mkdir ../waylit-consumer
cd ../waylit-consumer
npm init -y
npm install ../waylit/waylit-0.1.0.tgz
```

The package is ESM and includes TypeScript declarations. It has no runtime dependencies and targets ES2022. Use a JavaScript runtime with ES module and ES2022 support.

For the local React demo instead, run `npm ci && npm run dev` from the repository root and open the local URL Vite prints.

## Import

Import from the package name in a consumer project:

```ts
import { evaluateRoutes } from 'waylit'
```

The React demo and fixture data are not part of the published package. See [SDK Quickstart](SDK-Quickstart) for a complete call example.

