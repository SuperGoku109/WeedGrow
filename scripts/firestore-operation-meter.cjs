// Emulator-only regression instrumentation. Counts SDK document/query results
// (including empty-query minimums), not an authoritative Cloud Billing meter.
exports.measureFirestoreOperations = async function measureFirestoreOperations(sdk, action) {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) throw new Error('Operation meter requires disposable emulators.');
  const metrics = { reads: 0, queries: 0, writes: 0, paths: [] };
  const restore = [];
  function patch(prototype, name, wrap) {
    const original = prototype[name];
    prototype[name] = wrap(original);
    restore.push(() => { prototype[name] = original; });
  }
  for (const Class of [sdk.Query, sdk.DocumentReference, sdk.Transaction]) {
    patch(Class.prototype, 'get', original => async function (...args) {
      const result = await original.apply(this, args);
      metrics.reads += Array.isArray(result.docs) ? Math.max(1, result.size) : 1;
      if (Array.isArray(result.docs)) metrics.queries++;
      const reference = args[0] || this;
      metrics.paths.push(reference.path || reference._queryOptions?.collectionId || 'query');
      return result;
    });
  }
  for (const Class of [sdk.DocumentReference, sdk.Transaction]) for (const name of ['set', 'update', 'delete', 'create']) {
    patch(Class.prototype, name, original => function (...args) { metrics.writes++; return original.apply(this, args); });
  }
  try { return { value: await action(), metrics }; }
  finally { restore.reverse().forEach(reset => reset()); }
};
