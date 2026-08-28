import { Router } from 'express';
import { getPassDetails, getPublicKey } from './pass.controller.js';

export const passRouter = Router();

passRouter.get('/public-key', getPublicKey);
passRouter.get('/:inquiryId', getPassDetails);
