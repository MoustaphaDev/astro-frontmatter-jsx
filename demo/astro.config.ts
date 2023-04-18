import { defineConfig } from 'astro/config';
import astroFrontmatterJsx from 'astro-frontmatter-jsx';

// https://astro.build/config
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
    integrations: [astroFrontmatterJsx()],
    output: 'server',
    adapter: node({
        mode: 'standalone',
    }),
});
