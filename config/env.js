module.exports = {
  port: process.env.PORT || 3005,
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  stripeSecret: process.env.STRIPE_SECRET_KEY,
  awsRegion: process.env.AWS_REGION,
  awsBucket: process.env.AWS_BUCKET_NAME,
  nodeEnv: process.env.NODE_ENV || 'development'
};