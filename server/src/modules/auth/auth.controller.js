import { credentials, registration } from './auth.validation.js';
import { loginUser, registerUser, revokeSessions } from './auth.service.js';
import { publicUser } from '../users/users.service.js';
import { authenticatedUser, cookieOptions, setSession } from '../../middleware/auth.middleware.js';
import { config } from '../../config/env.js';
export function authController(io) {
  return {
    register: async (req, res) => {
      const user = await registerUser(registration.parse(req.body));
      res.status(201).json({ user: publicUser(user) });
    },
    login: async (req, res) => {
      const user = await loginUser(credentials.parse(req.body));
      setSession(res, user);
      res.json({ user: publicUser(user) });
    },
    me: (req, res) => {
      res.json({ user: publicUser(authenticatedUser(req)) });
    },
    logout: async (req, res) => {
      // Explicitly signs out ALL sessions, including open sockets.
      await revokeSessions(authenticatedUser(req), io);
      res.clearCookie(config.cookieName, cookieOptions).status(204).end();
    },
  };
}
