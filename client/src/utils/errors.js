export const errorMessage = (error) =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string'
    ? error.message
    : 'Something went wrong. Please retry.';
export const errorStatus = (error) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : undefined;
