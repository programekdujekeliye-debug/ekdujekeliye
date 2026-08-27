import { mediaService } from './media.service.js';

/**
 * Generates short-lived signed token to view archived Google Drive original photo
 * Protected by requireAuth (Normal Admin & Super Admin)
 */
export const createMediaViewToken = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const tokenData = await mediaService.generateMediaViewToken(registrationId, req.user);
    res.json(tokenData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to generate media view token.'
    });
  }
};
