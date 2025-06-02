import typescript from 'rollup-plugin-typescript2';

const config = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'DarkSwapSDK',
      sourcemap: true,
      globals: {
        '@aztec/bb.js': 'AztecBB',
        '@aztec/foundation': 'AztecFoundation',
        '@noir-lang/noir_js': 'NoirJS',
        '@noir-lang/noir_wasm': 'NoirWasm',
        '@noir-lang/types': 'NoirTypes',
        'ethers': 'ethers'
      },
    },
  ],
  plugins: [
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