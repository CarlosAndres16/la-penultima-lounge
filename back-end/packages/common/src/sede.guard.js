export const requireSameSede = (req, res, next) => {
  if (req.user.rol === 'Administrador') {
    return next();
  }

  const sedeSolicitada = req.params.idSede ?? req.query.sedeId;

  if (sedeSolicitada === undefined || sedeSolicitada === 'ALL') {
    // No se pidió una sede específica: se restringe automáticamente a la propia,
    // para que un Cajero/Mesero nunca vea datos agregados de otras sedes por omisión.
    req.query.sedeId = String(req.user.id_sede);
    return next();
  }

  if (parseInt(sedeSolicitada, 10) !== req.user.id_sede) {
    return res.status(403).json({
      error: 'No tiene permisos para acceder a la información de esta sede.'
    });
  }

  next();
};