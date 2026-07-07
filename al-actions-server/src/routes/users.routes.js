import { Router } from 'express';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { listUsers, setUserActive, setUserRole, updatePushToken } from '../services/users.repository.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

/** Admin-only: full user list for the admin panel's user management screen. */
usersRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await listUsers());
  })
);

/** Admin-only: deactivate/reactivate — never a hard delete. */
usersRouter.patch(
  '/:email/active',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { active } = req.body;
    if (typeof active !== 'boolean') throw new HttpError(400, 'active must be a boolean');

    const user = await setUserActive(req.params.email.toLowerCase(), active);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  })
);

/** Admin-only: change role. */
usersRouter.patch(
  '/:email/role',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!['employee', 'admin'].includes(role)) throw new HttpError(400, "role must be 'employee' or 'admin'");

    const user = await setUserRole(req.params.email.toLowerCase(), role);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  })
);

/** Any signed-in user: registers/refreshes their FCM device token after login. */
usersRouter.patch(
  '/me/push-token',
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) throw new HttpError(400, 'token is required');

    await updatePushToken(req.user.email, token);
    res.status(204).end();
  })
);
