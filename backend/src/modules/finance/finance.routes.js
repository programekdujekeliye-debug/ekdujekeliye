import { Router } from 'express';
import { getFinancialSummary } from './finance.controller.js';
import { requireSuperAuth } from '../../middleware/auth.js';

export const financeRouter = Router();

// Financial Overview & Ledger is Strictly Super Admin Only
financeRouter.get('/overview', requireSuperAuth, getFinancialSummary);
