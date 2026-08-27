import { financeService } from './finance.service.js';

export const getFinancialSummary = async (req, res) => {
  const { eventId, programId } = req.query;
  try {
    const summary = await financeService.getFinancialOverview(eventId || programId);
    res.json({
      success: true,
      summary,
      ...summary
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving financial overview.' });
  }
};
