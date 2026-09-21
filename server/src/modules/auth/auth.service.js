import bcrypt from 'bcryptjs';
import { User } from '../users/users.model.js';
import { AppError } from '../../errors/AppError.js';
const dummyHash = await bcrypt.hash('not-a-real-user-password', 12);
export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email, passwordHash });
}
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw new AppError(401, 'Invalid email or password');
  return user;
}
export async function revokeSessions(user, io) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  io.in(`session:${user._id}`).disconnectSockets(true);
}
