const dashboardService = require('../services/dashboard.service');

async function obter(req, res, next) {
  try {
    const dashboard = await dashboardService.montarDashboard(req.user);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obter
};
