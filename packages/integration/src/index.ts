import type { AstroIntegration } from 'astro';
import type { Plugin } from 'vite';
import { parse as compilerParse } from '@astrojs/compiler';
import { walk as compilerWalk, is, serialize } from '@astrojs/compiler/utils';
import kleur from 'kleur';
import { transform } from 'esbuild';
// import { print } from 'recast';
import { parse as parseModule } from 'acorn';
import { walk as jsTreeWalker } from 'estree-walker';
import MagicString from 'magic-string';

type IntegrationOptions = {
    silenceLogs?: boolean;
};
const defaultOptions: IntegrationOptions = {
    silenceLogs: false,
};
export default function integration({
    silenceLogs = false,
}: IntegrationOptions = defaultOptions): AstroIntegration {
    const {
        //  setAstroConfig,
        getVitePluginInjector,
    } = createVitePluginInjector({
        silenceLogs,
    });
    return {
        name: 'astro-frontmatter-jsx',
        hooks: {
            'astro:config:setup': async ({ updateConfig }) => {
                updateConfig({
                    vite: {
                        plugins: [getVitePluginInjector()],
                    },
                });
            },
            'astro:config:done': ({ config }) => {
                // setAstroConfig(config);
            },
        },
    };
}

function createVitePluginInjector(opts: IntegrationOptions) {
    // let resolver: (value: AstroConfig) => void;
    // let astroConfigPromise = new Promise<AstroConfig>((resolve) => {
    //     resolver = resolve;
    // });

    return {
        // setAstroConfig,
        getVitePluginInjector,
    };

    // function setAstroConfig(config: AstroConfig) {
    //     resolver(config);
    // }

    async function getVitePluginInjector(): Promise<Plugin | null> {
        return {
            name: 'vite-plugin-astro-frontmatter-jsx-injector',
            configResolved(resolved) {
                // TODO: limit this to only run once
                (resolved.plugins as Plugin[]).unshift(getVitePlugin());
            },
        };
    }

    function getVitePlugin(): Plugin {
        return {
            name: 'vite-plugin-astro-frontmatter-jsx',
            async transform(code, id) {
                if (!id.endsWith('.astro')) return;

                const { ast } = await compilerParse(code);
                let foundFrontmatter = false;
                let didChange = false;

                let s: MagicString;
                let walkedResolve: (value: any) => void;
                let walkedPromise = new Promise((resolve) => {
                    walkedResolve = resolve;
                });

                compilerWalk(ast, async (node) => {
                    if (foundFrontmatter) return;
                    if (is.frontmatter(node)) {
                        foundFrontmatter = true;
                        // implement jsx transpilation here
                        // node.value is the frontmatter
                        const { code: frontmatter } = await transform(
                            node.value,
                            {
                                loader: 'tsx',
                                target: 'esnext',
                                pure: [],
                            }
                        );

                        s = transformCreateElementToH(frontmatter);
                        const preprocessedFM = s.toString();
                        node.value = preprocessedFM;
                        didChange = true;
                        walkedResolve(true);
                    }
                });

                // TODO: make a PR to add a `asyncWalk` utility function so
                // that we can await it instead doing this trick
                await walkedPromise;
                if (!didChange || !foundFrontmatter) return;

                const result = serialize(ast);
                return {
                    code: result,
                    map: s!.generateMap({
                        hires: true,
                    }),
                };
            },
        };
    }
}

// alternatively use magic string
const H_IMPORT = `import { Fragment, jsx as h } from 'astro/jsx-runtime';\n`;
function transformCreateElementToH(frontmatter: string) {
    // Parse the code using Esprima
    console.log({ frontmatter });

    const ast = parseModule(frontmatter, {
        ecmaVersion: 'latest',
        sourceType: 'module',
    });

    let s = new MagicString(frontmatter);
    // Traverse the AST and transform the relevant nodes
    let hasReactJsx = false;
    jsTreeWalker(ast, {
        enter(node) {
            if (
                node.type === 'CallExpression' &&
                node.callee.type === 'MemberExpression' &&
                node.callee.object.name === 'React' &&
                node.callee.property.name === 'createElement' &&
                node.arguments.length >= 2
            ) {
                // could go safer and modify the ast and then print it back
                // instead of modifying the string directly based on the ast
                // but this is just a POC

                // mark that we have found jsx in the frontmatter
                hasReactJsx = true;

                // Replace the React.createElement call with astro jsx's h function
                s.overwrite(
                    node.callee.object.start,
                    node.callee.property.end,
                    'async () => h'
                );

                // Replace the second argument with a children property
                const children = node.arguments
                    .slice(2)
                    .map(
                        (arg) => `${frontmatter.substring(arg.start, arg.end)}`
                    );
                const secondArgEnd = node.arguments[1].end;
                const propsString = frontmatter.substring(
                    node.arguments[1].start,
                    secondArgEnd
                );
                const childrenArg = `, { ...${propsString}, children: [${children.join(
                    ', '
                )}] }`;

                s.overwrite(
                    node.arguments[1].start - 2,
                    secondArgEnd,
                    childrenArg
                );

                // Remove the third and following arguments
                console.log(JSON.stringify(node, null, 2));
                s.remove(
                    node.arguments[2].start,
                    node.arguments[node.arguments.length - 1].end
                );
            }
        },
    });

    if (hasReactJsx) {
        s.prepend(H_IMPORT);
    }

    return s;
}

async function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, ms);
    });
}

const dateTimeFormat = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function log(
    type: 'info' | 'warn' | 'error',
    message: string,
    /**
     * If true, don't log anything. Errors should not be silenced.
     */
    silent: boolean = false
) {
    if (silent) return;
    const date = dateTimeFormat.format(new Date());
    const messageColor =
        type === 'error'
            ? kleur.red
            : type === 'warn'
            ? kleur.yellow
            : kleur.cyan;
    console.log(
        `${kleur.gray(date)} ${messageColor(
            kleur.bold('[astro-frontmatter-jsx]')
        )} ${messageColor(message)}`
    );
}
