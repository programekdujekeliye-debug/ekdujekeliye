import { Router } from 'express';
import { getInvitationCard, downloadInvitationCard, getInvitationCardJpeg } from './invitation.controller.js';

export const invitationRouter = Router();

invitationRouter.get('/:inquiryId/card.jpg', getInvitationCardJpeg);
invitationRouter.get('/:inquiryId', getInvitationCard);
invitationRouter.get('/:inquiryId/preview', getInvitationCard);
invitationRouter.get('/:inquiryId/download', downloadInvitationCard);

