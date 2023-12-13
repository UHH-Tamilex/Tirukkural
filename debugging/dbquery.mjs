import { createDbWorker } from './sqljs-httpvfs.mjs';

const workerUrl = new URL('./sqlite.worker.js',import.meta.url);
const wasmUrl = new URL('./sql-wasm.wasm',import.meta.url);

const config = {
    from: 'inline',
    config: {
        serverMode: 'full',
        requestChunkSize: 4096,
        url: './index.db'
    }
};

var worker; 
const query = async (str) => {
    if(!worker) 
        worker = await createDbWorker(
            [config],
            workerUrl.toString(),
            wasmUrl.toString()
        );

    const res = await worker.db.exec('select [features] from [dictionary] where word = ?',[str]);

    return await res[0]?.values[0][0];
};

export default query;
