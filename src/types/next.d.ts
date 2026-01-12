import 'next/dist/server/config-shared';

declare module 'next/dist/server/config-shared' {
    interface ExperimentalConfig {
        after?: boolean;
    }
}
