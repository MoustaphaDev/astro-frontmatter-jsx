#!/usr/bin/env tsx
export default async function run() {
    const [cmd, ...args] = process.argv.slice(2);
    switch (cmd) {
        case 'dev':
        case 'build': {
            const { default: build } = await import('./cmd/build');
            await build(...args, cmd === 'dev' ? 'IS_DEV' : undefined);
            break;
        }
    }
}

run();

/*
This is a fork of astro-scripts (https://github.com/withastro/astro/tree/main/scripts), all credit to the Astro Organization.
*/
