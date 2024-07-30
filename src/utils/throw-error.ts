import { logger } from '../module/log';

function throwError(...msgs: any[]) {
  msgs.forEach((msg) => logger.error(msg));
  setTimeout(() => {
    process.exit(1);
  }, 100);
}

export default throwError;
