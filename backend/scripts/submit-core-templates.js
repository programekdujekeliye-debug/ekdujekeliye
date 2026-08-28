import { whatsappTemplateService } from '../src/integrations/whatsapp/whatsappTemplate.service.js';
import { CORE_TEMPLATES } from '../src/integrations/whatsapp/templateRegistry.js';
import { env, maskSecret } from '../src/config/env.js';

async function submitInOrder() {
  console.log('================================================================');
  console.log('SUBMITTING CORE TRANSACTIONAL UTILITY TEMPLATES TO META');
  console.log('================================================================');
  console.log(`WABA ID: ${env.WHATSAPP_WABA_ID || '(configured)'}`);
  console.log(`Token: ${maskSecret(env.WHATSAPP_ACCESS_TOKEN)}`);
  console.log(`Graph API Version: ${env.META_GRAPH_API_VERSION}`);
  console.log('================================================================\n');

  const submissionOrder = [
    'edkl_payment_confirmed_pass_v1',
    'edkl_registration_received_v1',
    'edkl_event_reminder_v1',
    'edkl_event_update_v1',
    'edkl_payment_failed_v1',
    'edkl_event_cancelled_v1',
    'edkl_pass_reissued_v1'
  ];

  const results = [];

  for (let i = 0; i < submissionOrder.length; i++) {
    const key = submissionOrder[i];
    const templateDef = CORE_TEMPLATES[key];
    if (!templateDef) continue;

    console.log(`[${i + 1}/${submissionOrder.length}] Submitting '${templateDef.metaName}' [${templateDef.category}] (${templateDef.language})...`);

    try {
      const res = await whatsappTemplateService.createTemplate(templateDef);
      if (res.success) {
        console.log(`  ✓ Meta Response: ID=${res.id || 'N/A'}, Status=${res.status} ${res.alreadyExists ? '(Already Exists)' : ''}`);
        results.push({ name: templateDef.metaName, status: res.status, id: res.id, success: true });
      } else {
        console.warn(`  ❌ Submission Failed: ${res.error}`);
        results.push({ name: templateDef.metaName, status: 'REJECTED', error: res.error, success: false });
      }
    } catch (err) {
      console.error(`  ❌ Exception: ${err.message}`);
      results.push({ name: templateDef.metaName, status: 'ERROR', error: err.message, success: false });
    }

    // Small courteous pause between API requests
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n================================================================');
  console.log('SUBMISSION SUMMARY');
  console.log('================================================================');
  results.forEach(r => {
    console.log(`- ${r.name}: ${r.status} ${r.id ? `(ID: ${r.id})` : ''} ${r.error ? `[Reason: ${r.error}]` : ''}`);
  });
  console.log('================================================================\n');
}

submitInOrder().catch(err => {
  console.error('Fatal submission error:', err);
  process.exit(1);
});
