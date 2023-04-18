import { defineConfig } from 'astro/config';
import astroFrontmatterJsx from 'astro-frontmatter-jsx';

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
    integrations: [astroFrontmatterJsx()],
});
