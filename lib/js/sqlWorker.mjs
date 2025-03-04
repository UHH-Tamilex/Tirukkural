import { createDbWorker } from '../debugging/sqljs-httpvfs.mjs';

const sqlWorker = async (url) => {
    const workerUrl = new URL('../debugging/sqlite.worker.js',import.meta.url);
    const wasmUrl = new URL('../debugging/sql-wasm.wasm',import.meta.url);
    const sqlConfig = {
        from: 'inline',
        config: {
            serverMode: 'full',
            requestChunkSize: 4096,
            url: url
        }
    };
    const worker = await createDbWorker(
        [sqlConfig],
        workerUrl.toString(),
        wasmUrl.toString(),
        100 * 1024 * 1024
    );

    return worker;
};

export default sqlWorker;
