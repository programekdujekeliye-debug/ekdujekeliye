import { verifyWebhook, handleWebhookEvent } from '../../integrations/whatsapp/whatsapp.service.js';
import { WhatsappTemplate } from '../../models/WhatsappTemplate.js';

export const handleVerification = verifyWebhook;
export const handleEvents = handleWebhookEvent;

export const getTemplates = async (req, res) => {
  try {
    const templates = await WhatsappTemplate.find({});
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching templates.' });
  }
};

export const createTemplate = async (req, res) => {
  const { name, text, type } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text are required.' });

  try {
    const activeType = type || 'pass_delivery';
    const count = await WhatsappTemplate.countDocuments({ type: activeType });
    const template = await WhatsappTemplate.create({
      name,
      text,
      type: activeType,
      isActive: count === 0
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating template.' });
  }
};

export const activateTemplate = async (req, res) => {
  const { id } = req.params;
  try {
    const target = await WhatsappTemplate.findById(id);
    if (!target) return res.status(404).json({ error: 'Template not found.' });

    await WhatsappTemplate.updateMany({ type: target.type }, { isActive: false });
    target.isActive = true;
    await target.save();

    res.json({ success: true, message: 'Template activated.', template: target });
  } catch (err) {
    res.status(500).json({ error: 'Server error activating template.' });
  }
};

export const getActiveTemplate = async (req, res) => {
  const activeType = req.query.type || 'pass_delivery';
  try {
    const activeTemplate = await WhatsappTemplate.findOne({ type: activeType, isActive: true });
    if (!activeTemplate) {
      if (activeType === 'payment_request') {
        return res.json({ text: 'Hello! I have registered for {programName}. My Inquiry ID is {inquiryId}. Please verify my pass.' });
      }
      return res.json({ text: 'Hello! Your pass for {programName} is ready: {passUrl}' });
    }
    res.json(activeTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching active template.' });
  }
};
