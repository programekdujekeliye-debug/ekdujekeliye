import { Router } from 'express';
import { getInvitationCard, downloadInvitationCard } from './invitation.controller.js';

export const invitationRouter = Router();

invitationRouter.get('/:inquiryId', getInvitationCard);
invitationRouter.get('/:inquiryId/preview', getInvitationCard);
invitationRouter.get('/:inquiryId/download', downloadInvitationCard);
