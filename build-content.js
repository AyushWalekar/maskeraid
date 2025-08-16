import * as esbuild from 'esbuild';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

const contentEntry = resolve(process.cwd(), 'src/content/index.tsx');
const outFile = resolve(process.cwd(), 'dist/content.js');

async function buildContentScript() {
  try {
    console.log('Building content script as IIFE...');
    console.log('Entry:', contentEntry);
    console.log('Output:', outFile);

    const result = await esbuild.build({
      entryPoints: [contentEntry],
      bundle: true,
      write: false,
      format: 'iife',
      minify: process.env.NODE_ENV === 'production',
      sourcemap: false,
      jsx: 'automatic',
      jsxImportSource: 'react',
      loader: {
        '.tsx': 'tsx',
      },
      define: {
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
      },
    });

    console.log('Build result keys:', Object.keys(result));
    console.log('Output files:', result.outputFiles?.map(f => f.path));

    if (result.outputFiles && result.outputFiles.length > 0) {
      const content = result.outputFiles[0].text;
      writeFileSync(outFile, content);
      console.log(`✓ Content script built (${content.length} bytes)`);
    } else {
      throw new Error('No output files generated');
    }
  } catch (error) {
    console.error('Failed to build content script:', error);
    throw error;
  }
}

buildContentScript().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
