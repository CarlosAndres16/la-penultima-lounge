export const requireSameSede = (req, res, next) => {
  if (req.user.rol === 'Administrador') {
    return next();
  }

  const sedeSolicitada = req.params.idSede ?? req.query.sedeId;

  if (sedeSolicitada === undefined || sedeSolicitada === 'ALL') {
    // No specific branch was requested: automatically restrict to the user's own branch,
    // so a Cashier/Waiter never sees aggregated data from other branches by default.
    req.query.sedeId = String(req.user.id_sede);
    return next();
  }

  if (parseInt(sedeSolicitada, 10) !== req.user.id_sede) {
    return res.status(403).json({
      error: 'You do not have permission to access this branch information.'
    });
  }

  next();
};