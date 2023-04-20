export const swcInlineConfig = {
    jsc: {
        parser: {
            syntax: 'typescript',
            tsx: true,
        },
        target: 'es2022',
        loose: false,
        minify: {
            compress: false,
            mangle: false,
        },
    },
    module: {
        type: 'es6',
    },
    minify: false,
    isModule: true,
    env: {
        targets: '',
    },
} as const;
