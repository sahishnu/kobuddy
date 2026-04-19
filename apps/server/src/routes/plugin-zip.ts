import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import { Hono } from 'hono';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function pluginZipRouter() {
  const r = new Hono();

  r.get('/plugin.zip', async () => {
    const pluginDir = path.resolve(
      __dirname,
      '../../../../plugin/kobuddy.koplugin',
    );
    if (!fs.existsSync(pluginDir)) {
      return new Response(
        JSON.stringify({ error: 'Plugin bundle not found on server' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const pass = new PassThrough();
    archive.on('error', (err) => {
      pass.destroy(err);
    });
    archive.pipe(pass);
    archive.directory(pluginDir, 'kobuddy.koplugin');
    await archive.finalize();

    const web = Readable.toWeb(pass);
    return new Response(web, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=kobuddy.plugin.zip',
      },
    });
  });

  return r;
}
