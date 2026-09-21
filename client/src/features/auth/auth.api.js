import { request, write } from '@/services/http';
export const authApi = {
  register: (body) => write('/auth/register', 'POST', body),
  login: (body) => write('/auth/login', 'POST', body),
  me: (options) => request('/auth/me', options),
  logout: () => write('/auth/logout', 'POST', {}),
};
