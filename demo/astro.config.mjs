import { defineConfig } from 'astro/config';
import astroFrontmatterJsx from 'astro-frontmatter-jsx';

// https://astro.build/config
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind(), astroFrontmatterJsx()],
});
