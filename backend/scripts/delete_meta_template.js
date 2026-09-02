import { env } from '../src/config/env.js';

export async function deleteTemplateFromMeta(templateName) {
  const wabaId = env.WHATSAPP_WABA_ID || '1058277913581760';
  const token = env.WHATSAPP_ACCESS_TOKEN;

  console.log(`Deleting '${templateName}' from Meta WABA (${wabaId})...`);
  const url = `https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=${templateName}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`Result for '${templateName}':`, data);
  return data;
}

// Test deleting hello_world
if (process.argv[1].endsWith('delete_meta_template.js')) {
  const target = process.argv[2] || 'hello_world';
  deleteTemplateFromMeta(target).catch(console.error);
}
