import { whatsappTemplateService } from '../src/integrations/whatsapp/whatsappTemplate.service.js';
import { env, maskSecret } from '../src/config/env.js';

async function checkStatus() {
  console.log('================================================================');
  console.log('EK DUJE KE LIYE — META WHATSAPP TEMPLATE STATUS AUDIT');
  console.log('================================================================');
  console.log(`WHATSAPP MODE: ${env.WHATSAPP_MODE.toUpperCase()}`);
  console.log(`WABA ID: ${env.WHATSAPP_WABA_ID || '(configured)'}`);
  console.log(`PHONE NUMBER ID: ${env.WHATSAPP_PHONE_NUMBER_ID || '(configured)'}`);
  console.log(`TOKEN: ${maskSecret(env.WHATSAPP_ACCESS_TOKEN)}`);
  console.log(`GRAPH API VERSION: ${env.META_GRAPH_API_VERSION}`);
  console.log('================================================================\n');

  const result = await whatsappTemplateService.syncTemplateStatuses();

  if (!result.success) {
    console.error(`❌ Meta Query Failed: ${result.error}`);
    return;
  }

  console.log('-----------------------------------------------------------------------------------------');
  console.log(
    'NAME'.padEnd(35) +
    'LANGUAGE'.padEnd(12) +
    'CATEGORY'.padEnd(14) +
    'STATUS'.padEnd(16) +
    'META ID'
  );
  console.log('-----------------------------------------------------------------------------------------');

  result.templates.forEach(t => {
    console.log(
      t.name.padEnd(35) +
      t.language.padEnd(12) +
      t.category.padEnd(14) +
      t.metaStatus.padEnd(16) +
      (t.metaId || '—')
    );
  });

  console.log('-----------------------------------------------------------------------------------------\n');
}

checkStatus().catch(err => {
  console.error('Fatal error checking template status:', err.message);
});
