import express from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  checkVipLink,
  getVipLinks,
  createVipLink,
  updateVipLink,
  toggleVipLinkStatus,
  deleteVipLink
} from './vipLink.controller.js';

export const vipLinkPublicRouter = express.Router();
export const vipLinkAdminRouter = express.Router();

// Public check endpoint
vipLinkPublicRouter.get('/check', checkVipLink);

// Admin protected endpoints
vipLinkAdminRouter.get('/', requireAuth, getVipLinks);
vipLinkAdminRouter.post('/', requireAuth, createVipLink);
vipLinkAdminRouter.patch('/:id', requireAuth, updateVipLink);
vipLinkAdminRouter.post('/:id/toggle', requireAuth, toggleVipLinkStatus);
vipLinkAdminRouter.delete('/:id', requireAuth, deleteVipLink);
