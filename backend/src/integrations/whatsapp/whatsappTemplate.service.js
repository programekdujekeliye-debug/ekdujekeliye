import { env, getMetaGraphApiUrl, maskSecret } from '../../config/env.js';
import { CORE_TEMPLATES } from './templateRegistry.js';
import { WhatsappTemplate } from '../../models/WhatsappTemplate.js';

class WhatsappTemplateService {
  /**
   * List all registered local templates and their schemas
   */
  listTemplates() {
    return Object.values(CORE_TEMPLATES);
  }

  /**
   * Get template definition by name and language
   */
  getTemplate(name, language = 'en_US') {
    const key = Object.keys(CORE_TEMPLATES).find(
      k => CORE_TEMPLATES[k].metaName === name && (CORE_TEMPLATES[k].language === language || !language)
    );
    return key ? CORE_TEMPLATES[key] : null;
  }

  /**
   * Query all templates from Meta WABA
   */
  async fetchMetaTemplates() {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_WABA_ID) {
      return { success: false, error: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID not configured.', templates: [] };
    }

    const url = getMetaGraphApiUrl(`${env.WHATSAPP_WABA_ID}/message_templates?limit=100&fields=name,status,category,language,components,id`);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
        }
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error?.message || `HTTP ${res.status}`, templates: [] };
      }

      return { success: true, templates: data.data || [] };
    } catch (err) {
      return { success: false, error: err.message, templates: [] };
    }
  }

  /**
   * Get single template status from Meta
   */
  async getTemplateStatus(name, language = 'en_US') {
    const res = await this.fetchMetaTemplates();
    if (!res.success) return { status: 'UNKNOWN', error: res.error };

    const match = res.templates.find(t => t.name === name && t.language === language);
    if (!match) return { status: 'NOT_CREATED' };

    return {
      status: match.status, // APPROVED, PENDING, REJECTED, PAUSED, DISABLED
      category: match.category,
      id: match.id,
      components: match.components
    };
  }

  /**
   * Submit template definition to Meta Graph API
   */
  async createTemplate(templateDef) {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_WABA_ID) {
      throw new Error('Missing Meta credentials in environment');
    }

    // Check if already exists on Meta
    const existing = await this.getTemplateStatus(templateDef.metaName, templateDef.language);
    if (existing.status === 'APPROVED' || existing.status === 'PENDING') {
      return {
        success: true,
        alreadyExists: true,
        status: existing.status,
        id: existing.id,
        message: `Template '${templateDef.metaName}' already exists with status: ${existing.status}`
      };
    }

    const url = getMetaGraphApiUrl(`${env.WHATSAPP_WABA_ID}/message_templates`);
    const payload = {
      name: templateDef.metaName,
      category: templateDef.category,
      language: templateDef.language,
      components: templateDef.components
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || `HTTP ${res.status}`,
        data
      };
    }

    // Save/update safe metadata in local ledger model
    try {
      await WhatsappTemplate.findOneAndUpdate(
        { name: templateDef.metaName, language: templateDef.language },
        {
          name: templateDef.metaName,
          language: templateDef.language,
          category: templateDef.category,
          text: templateDef.components.find(c => c.type === 'BODY')?.text || '',
          providerTemplateId: data.id,
          status: data.status || 'PENDING',
          lastSyncedAt: new Date()
        },
        { upsert: true }
      );
    } catch (_) {}

    return {
      success: true,
      id: data.id,
      status: data.status || 'PENDING',
      data
    };
  }

  /**
   * Sync all template statuses from Meta and update local database
   */
  async syncTemplateStatuses() {
    const metaRes = await this.fetchMetaTemplates();
    if (!metaRes.success) return { success: false, error: metaRes.error };

    const metaTemplates = metaRes.templates || [];
    const metaMap = new Map();
    metaTemplates.forEach(t => metaMap.set(`${t.name}_${t.language}`, t));

    const results = [];

    for (const [key, local] of Object.entries(CORE_TEMPLATES)) {
      const match = metaMap.get(`${local.metaName}_${local.language}`);
      const metaStatus = match ? match.status : 'NOT_CREATED';
      const metaId = match ? match.id : null;

      results.push({
        key,
        name: local.metaName,
        language: local.language,
        category: local.category,
        purpose: local.purpose,
        metaStatus,
        metaId
      });

      // Update local database metadata safely
      try {
        await WhatsappTemplate.findOneAndUpdate(
          { name: local.metaName, language: local.language },
          {
            name: local.metaName,
            language: local.language,
            category: local.category,
            text: local.components.find(c => c.type === 'BODY')?.text || '',
            providerTemplateId: metaId,
            status: metaStatus,
            lastSyncedAt: new Date()
          },
          { upsert: true }
        );
      } catch (_) {}
    }

    return { success: true, templates: results, totalMeta: metaTemplates.length };
  }
}

export const whatsappTemplateService = new WhatsappTemplateService();
