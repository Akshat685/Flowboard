export const publicUser = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
});
