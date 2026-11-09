// Read-only audit. Uses the existing Firebase CLI login; never prints tokens,
// keys, configuration payloads, user records or billing account identifiers.
const cli = 'C:/Users/Zane/AppData/Roaming/npm/node_modules/firebase-tools/lib/';
(async () => {
  const auth = require(cli + 'auth');
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account) throw new Error('No existing CLI login');
  await require(cli + 'requireAuth').requireAuth({ ...account, cwd: process.cwd(), project: 'weed-grow', projectId: 'weed-grow', nonInteractive: true });
  const output = {};
  try { output.billingEnabled = await require(cli + 'gcp/cloudbilling').checkBillingEnabled('weed-grow'); }
  catch (error) { output.billingCheck = { status: error.status ?? error.statusCode ?? 'unavailable' }; }
  try {
    const response = await require(cli + 'gcp/firestore').getDocuments('weed-grow', ['careConfiguration/weather', 'careConfiguration/watering']);
    output.careConfiguration = ['weather', 'watering'].map(kind => {
      const doc = response.documents.find(document => document.name.endsWith('/careConfiguration/' + kind));
      return { kind, exists: !!doc, enabled: doc?.fields?.enabled?.booleanValue === true,
        profileCount: doc?.fields?.profiles?.arrayValue?.values?.length ?? 0 };
    });
  } catch (error) { output.configurationCheck = { status: error.status ?? error.statusCode ?? 'unavailable' }; }
  console.log(JSON.stringify(output, null, 2));
})().catch(() => { console.error('Read-only status audit could not authenticate.'); process.exitCode = 1; });
