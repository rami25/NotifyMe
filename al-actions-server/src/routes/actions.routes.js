import { Router } from 'express';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  listActionsForUser,
  getActionForUser,
  finishAction,
  cancelAction,
  createAction
} from '../services/actions.repository.js';
import { findByEmail, getPushToken } from '../services/users.repository.js';
import {
  notifyAdminsActionFinished,
  notifyAdminsActionCancelledByEmployee,
  notifyEmployeeActionCancelledByAdmin,
  notifyEmployeeAssigned
} from '../services/notifications.service.js';

export const actionsRouter = Router();

actionsRouter.use(requireAuth);

/** The signed-in employee's own actions — this is what the mobile app's "My Plan" calls. */
actionsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const actions = await listActionsForUser({ email: req.user.email, role: 'employee' });
    res.json(actions);
  })
);

/** Admin-only: every action across every employee, for the admin panel. */
actionsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const actions = await listActionsForUser(req.user); // role === 'admin' here, so unscoped
    res.json(actions);
  })
);

actionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const action = await getActionForUser(req.params.id, req.user);
    res.json(action);
  })
);

/** Admin-only: direct creation, one of the two intake paths (the other being the Sheet sync). */
actionsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, description, customerName, customerRef, address, assignedToEmail, priority, deadline } =
      req.body;

    if (!title || !customerName || !address || !assignedToEmail || !deadline) {
      throw new HttpError(400, 'title, customerName, address, assignedToEmail, and deadline are required');
    }

    const assignee = await findByEmail(assignedToEmail.toLowerCase());
    if (!assignee || !assignee.active) {
      throw new HttpError(400, 'assignedToEmail must be an active user');
    }

    const action = await createAction(
      { title, description, customerName, customerRef, address, assignedToEmail: assignee.email, priority, deadline },
      req.user
    );

    notifyEmployeeAssigned({
      title: action.title,
      customer_name: action.customerName,
      assigned_to_email: action.assignedToEmail,
      deadline: action.deadline
    });

    res.status(201).json(action);
  })
);

/** Employee closes their own action. Notifies every admin by email. */
actionsRouter.post(
  '/:id/finish',
  asyncHandler(async (req, res) => {
    const action = await finishAction(req.params.id, req.user);
    notifyAdminsActionFinished({
      title: action.title,
      customer_name: action.customerName,
      assigned_to_email: action.assignedToEmail
    });
    res.json(action);
  })
);

/**
 * Either the employee or an admin can cancel. Whichever side didn't
 * initiate it gets notified — employee cancels -> admins by email;
 * admin cancels -> that employee by push.
 */
actionsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const action = await cancelAction(req.params.id, req.user, reason);

    if (req.user.role === 'admin') {
      const pushToken = await getPushToken(action.assignedToEmail);
      notifyEmployeeActionCancelledByAdmin(
        { id: action.id, title: action.title },
        req.user.email,
        pushToken
      );
    } else {
      notifyAdminsActionCancelledByEmployee({
        title: action.title,
        customer_name: action.customerName,
        assigned_to_email: action.assignedToEmail,
        cancel_reason: action.cancelReason
      });
    }

    res.json(action);
  })
);
