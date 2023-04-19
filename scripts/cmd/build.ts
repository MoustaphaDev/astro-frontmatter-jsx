import { deleteAsync } from 'del';
import esbuild, { Plugin, type BuildOptions } from 'esbuild';
import { promises as fs } from 'fs';
import { dim, green, red, yellow } from 'kleur/colors';
import glob from 'tiny-glob';

const defaultConfig = {
    minify: false,
    format: 'esm',
    platform: 'node',
    target: 'node16',
    sourcemap: false,
    sourcesContent: false,
} satisfies BuildOptions;

const dt = new Intl.DateTimeFormat('en-us', {
    hour: '2-digit',
    minute: '2-digit',
});

export default async function build(...args: any[]) {
    const config = Object.assign({}, defaultConfig);
    const isDev = args.slice(-1)[0] === 'IS_DEV';
    const patterns = args
        .filter((f) => !!f) // remove empty args
        .map((f) => f.replace(/^'/, '').replace(/'$/, ''));
    const entryPoints = [
        await Promise.all(
            patterns.map((pattern) =>
                glob(pattern, { filesOnly: true, absolute: true })
            )
        ),
    ].flat(2);

    const noClean = args.includes('--no-clean-dist');
    const bundle = args.includes('--bundle');
    const forceCJS = args.includes('--force-cjs');

    const {
        type = 'module',
        // version,
        dependencies = {},
    } = await fs
        .readFile('./package.json')
        .then((res) => JSON.parse(res.toString()));
    // expose PACKAGE_VERSION on process.env for CLI utils
    // config.define = { 'process.env.PACKAGE_VERSION': JSON.stringify(version) };
    const format = type === 'module' && !forceCJS ? 'esm' : 'cjs';

    const outdir = 'dist';

    if (!noClean) {
        await clean(outdir);
    }

    if (!isDev) {
        await esbuild.build({
            ...config,
            bundle,
            external: bundle ? Object.keys(dependencies) : undefined,
            entryPoints,
            outdir,
            outExtension: forceCJS ? { '.js': '.cjs' } : { '.js': '.mjs' },
            format,
        });
        return;
    }

    const rebuildPlugin: Plugin = {
        name: 'script:rebuild',
        setup(build) {
            build.onEnd(async (result) => {
                const date = dt.format(new Date());
                if (result && result.errors.length) {
                    console.error(
                        dim(`[${date}] `) + result.errors
                            ? red(result.errors.join('\n'))
                            : ''
                    );
                } else {
                    if (result.warnings.length) {
                        console.log(
                            dim(`[${date}] `) +
                                yellow(
                                    '⚠ updated with warnings:\n' +
                                        result.warnings.join('\n')
                                )
                        );
                    }
                    console.log(dim(`[${date}] `) + green('✔ updated'));
                }
            });
        },
    };

    const builder = await esbuild.context({
        ...config,
        entryPoints,
        outdir,
        format,
        plugins: [rebuildPlugin],
    });

    await builder.watch();

    process.on('beforeExit', () => {
        builder?.dispose();
    });
}

async function clean(outdir: string) {
    return deleteAsync([`${outdir}/**`, `!${outdir}/**/*.d.ts`]);
}
