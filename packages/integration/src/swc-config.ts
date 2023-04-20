import type { Options } from '@swc/core';

export const swcInlineConfig: Options = {
    jsc: {
        parser: {
            syntax: 'typescript',
            tsx: true,
        },
        target: 'esnext',
    },
    module: {
        type: 'commonjs',
    },
} as const;
