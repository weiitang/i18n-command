const env = process.env.NODE_ENV;

export const IS_DEV = env === 'development';
export const IS_PROD = env === 'production';
export const IS_TEST = env === 'test';
