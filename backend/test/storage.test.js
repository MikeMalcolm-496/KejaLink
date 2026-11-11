const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../src/config/env');
const { saveImage, deleteImages } = require('../src/utils/storage');

test('Supabase secret key is sent as the API key for uploads and deletes', async () => {
  const originalFetch = global.fetch;
  const originalConfig = {
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
    storageBucket: config.storageBucket,
  };
  const requests = [];
  config.supabaseUrl = 'https://project.supabase.co';
  config.supabaseServiceKey = 'sb_secret_test-key';
  config.storageBucket = 'property-images';
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response('', { status: 200 });
  };

  try {
    const imageUrl = await saveImage({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      originalname: 'home.jpg',
    });
    await deleteImages([imageUrl]);

    assert.equal(requests.length, 2);
    for (const { options } of requests) {
      assert.equal(options.headers.apikey, 'sb_secret_test-key');
      assert.equal(options.headers.Authorization, undefined);
    }
    assert.equal(requests[0].options.method, 'POST');
    assert.equal(requests[1].options.method, 'DELETE');
  } finally {
    global.fetch = originalFetch;
    Object.assign(config, originalConfig);
  }
});
