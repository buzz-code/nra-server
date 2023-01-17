export const jwtConstants = {
  secret: process.env.JWT_SECRET,
  maxAge: 60 * 60 * 24 * 7 // 1 week
};
