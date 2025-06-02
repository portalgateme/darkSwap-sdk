# DarkSwap SDK


## Installation

```bash
npm install darkswap-sdk
```

## Usage

### Browser

```html
<script src="path/to/darkswap-sdk.umd.js"></script>
<script>
  const sdk = new DarkSwapSDK();
  console.log(sdk.getVersion());
</script>
```

### Node.js env

```typescript
import DarkSwapSDK from 'darkswap-sdk';

const sdk = new DarkSwapSDK();
console.log(sdk.getVersion());
```

## Dev

```bash
npm install

npm run dev

npm run build

npm test

npm run format

npm run lint
```

## Build

- `dist/index.js` - CommonJS Format
- `dist/index.esm.js` - ES Module Format
- `dist/index.umd.js` - UMD Format
- `dist/index.d.ts` - TypeScript types