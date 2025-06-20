import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

const config = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      useTsconfigDeclarationDir: true,
      clean: true,
    }),
  ],
  external: [
    '@aztec/bb.js',
    '@aztec/foundation',
    '@noir-lang/noir_js',
    '@noir-lang/noir_wasm',
    '@noir-lang/types',
    'ethers'
  ],
};

export default config; 