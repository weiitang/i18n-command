import log4js from 'log4js';
import path from 'path';
import { getConfig } from '../../config';
import readline from 'linebyline';
import chalk from 'chalk';

const defaultLogDir = path.join(__dirname, '../../../logs');
export interface ILogConfig {
  logDir?: string;
}
export interface ILogPaths {
  [key: string]: string;
}
interface ShowMessageParams {
  limitStartTime: number;
  onStart?: () => void;
}

const levels = {
  trace: log4js.levels.TRACE,
  debug: log4js.levels.DEBUG,
  info: log4js.levels.INFO,
  warn: log4js.levels.WARN,
  error: log4js.levels.ERROR,
  fatal: log4js.levels.FATAL,
};

const tipLevel = ['WARN', 'ERROR'];
class Logger {
  static createLogger(name = '', level?: keyof typeof levels) {
    const logger = log4js.getLogger(name);
    if (level) logger.level = level;
    Object.keys(levels).forEach((method: keyof typeof levels) => {
      const originMethod = logger[method];
      logger[method] = (...args: any[]) => {
        let consoleMethod = console[method];
        if (typeof consoleMethod !== 'function') {
          consoleMethod = console.log;
        }
        consoleMethod(...args);
        originMethod?.apply(logger, args);
      };
    });
    return logger;
  }
  /**
   * 获取日志时间
   * [2010-01-17 11:43:37.987] [ERROR] cheese - Cheese is too ripe!
   * @return 2021-01-17 11:43:37
   */
  static getLogDate(logRecord: string) {
    return logRecord.substring(1, 24);
  }

  logPathsTarget: ILogPaths;
  logPathsProxy: {};
  logDir: string;
  startTime: number;

  constructor() {
    const config = getConfig();
    const logDir = config.logDir ?? defaultLogDir;
    this.startTime = Date.now();

    this.logPathsTarget = {
      default: path.resolve(logDir, 'default.log'),
      id: path.resolve(logDir, 'idNotFound.log'),
      result: path.resolve(logDir, 'result.log'),
    };
    log4js.configure({
      appenders: {
        idNotFound: {
          type: 'file',
          filename: this.logPathsTarget.id,
        },
        log: {
          type: 'file',
          filename: this.logPathsTarget.default,
        },
        result: {
          type: 'file',
          filename: this.logPathsTarget.result,
        },
      },
      categories: {
        default: {
          appenders: ['log'],
          level: 'info',
        },
        id: {
          appenders: ['idNotFound'],
          level: 'warn',
        },
        result: {
          appenders: ['result'],
          level: 'info',
        },
      },
    });
  }
  filter(record: string, options: ShowMessageParams) {
    const filter1 = tipLevel.some((level) => record.includes(level));
    if (!filter1) return false;
    const { limitStartTime } = options;
    if (limitStartTime) {
      const date = getLogDate(record);
      const timestamp = new Date(date).getTime();
      if (timestamp < limitStartTime) return false;
    }
    return true;
  }
  async showMessageWithFile(
    logPath: string,
    { limitStartTime, onStart }: ShowMessageParams
  ) {
    let calledStart = false;
    return new Promise((res, rej) => {
      readline(logPath)
        .on('line', (record: string) => {
          if (this.filter(record, { limitStartTime })) {
            if (!calledStart) {
              onStart?.();
              calledStart = true;
            }
            console.error(chalk.red(record));
          }
        })
        .on('error', (e: Error) => {
          rej(e);
        })
        .on('end', () => {
          res('error');
        });
    });
  }
  async showImportantMessage() {
    const { default: defaultLog, id: idLog } = this.logPathsTarget;
    const limitStartTime = this.startTime;
    let hasShowInfo = false;

    await this.showMessageWithFile(idLog, {
      limitStartTime,
      onStart: () => {
        console.log(chalk.bgYellow('词条丢失情况：'));
        hasShowInfo = true;
      },
    });

    console.log(chalk.bgGreen('======='));

    await this.showMessageWithFile(defaultLog, {
      limitStartTime,
      onStart: () => {
        console.log(chalk.bgYellow('其他需要注意的问题:'));
        hasShowInfo = true;
      },
    });

    if (!hasShowInfo) console.log(chalk.bgYellow('没有发现需要注意的问题'));
  }
}

const loggerInstance = new Logger();

// 负责记录id不存在的情况
const idLogger = Logger.createLogger('id');
// 默认的logger
const logger = Logger.createLogger();
// 冗余情况记录
const redundantLogger = Logger.createLogger('redundant');
// 最终结果记录
const resultLogger = Logger.createLogger('result');

const { getLogDate } = Logger;

export default loggerInstance;
export { idLogger, logger, redundantLogger, getLogDate, Logger, resultLogger };
