import type { AstroIntegration } from 'astro';
import type { Plugin } from 'vite';
import { parse as compilerParse } from '@astrojs/compiler';
import { walk as compilerWalk, is, serialize } from '@astrojs/compiler/utils';
import kleur from 'kleur';
import { transform } from 'esbuild';
import { print } from 'recast';
import { parseModule } from 'esprima';
import { walk as jsTreeWalker } from 'estree-walker';

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

                compilerWalk(ast, async (node) => {
                    if (foundFrontmatter) return;
                    if (is.frontmatter(node)) {
                        log('info', 'Found frontmatter', opts.silenceLogs);
                        foundFrontmatter = true;
                        // implement jsx transpilation here
                        // node.value is the frontmatter
                        const { code: frontmatter } = await transform(
                            node.value,
                            {
                                loader: 'tsx',
                                target: 'esnext',
                            }
                        );

                        const preprocessedFM =
                            transformCreateElementToH(frontmatter);
                        node.value = preprocessedFM;
                        console.log({ preprocessedFM });
                        log('info', 'Processed frontmatter');
                        didChange = true;
                    }
                });

                // TODO: make a PR to add a `asyncWalk` utility function so
                // that we can await it instead of using a timeout
                // to wait for the "walk" call to complete
                await wait(1000);
                if (!didChange) return;

                const result = serialize(ast);

                return result;
            },
        };
    }
}

// alternatively use magic string
const H_IMPORT = `import { Fragment, jsx as h } from 'astro/jsx-runtime';\n`;
function transformCreateElementToH(frontmatter: string) {
    // Parse the code using Esprima
    console.log({ frontmatter });

    const ast = parseModule(frontmatter);

    // Traverse the AST and transform the relevant nodes
    let hasReactJsx = false;
    jsTreeWalker(ast, {
        enter(node) {
            if (
                node.type === 'CallExpression' &&
                node.callee.type === 'MemberExpression' &&
                // @ts-expect-error types are wrong
                node.callee.object.name === 'React' &&
                // @ts-expect-error types are wrong
                node.callee.property.name === 'createElement' &&
                node.arguments.length >= 2
            ) {
                hasReactJsx = true;
                // Replace the React.createElement call with a call to h
                node.callee = { type: 'Identifier', name: 'h' };

                // Collect the children into an array and remove them from the argument list
                const children = [];
                node.arguments.splice(2).forEach((arg) => {
                    if (arg.type === 'Literal') {
                        // @ts-expect-error types are wrong
                        children.push({ type: 'Literal', value: arg.value });
                    } else if (arg.type === 'Identifier') {
                        // @ts-expect-error types are wrong
                        children.push({
                            type: 'Identifier',
                            name: arg.name,
                        });
                    } else {
                        // @ts-expect-error types are wrong
                        children.push(arg);
                    }
                });

                // Add a childrenF property to the props object that contains the children array
                const propsArg = node.arguments[1];
                if (propsArg && propsArg.type === 'ObjectExpression') {
                    // @ts-expect-error types are wrong
                    propsArg.properties.push({
                        type: 'Property',
                        key: { type: 'Identifier', name: 'children' },
                        value: {
                            type: 'ArrayExpression',
                            elements: children,
                        },
                        kind: 'init',
                    });
                } else {
                    node.arguments.splice(1, 0, {
                        type: 'ObjectExpression',
                        properties: [
                            // @ts-expect-error types are wrong
                            {
                                type: 'Property',
                                key: {
                                    type: 'Identifier',
                                    name: 'children',
                                },
                                value: {
                                    type: 'ArrayExpression',
                                    elements: children,
                                },
                                kind: 'init',
                            },
                        ],
                    });
                }
            }
        },
    });
    if (hasReactJsx) {
        // Generate the transformed code by serializing the AST
        console.log('has react jsx');
        const transformedCode = print(ast).code.trim();
        console.log('has end react jsx');
        return H_IMPORT + transformedCode;
    }
    return frontmatter;
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
