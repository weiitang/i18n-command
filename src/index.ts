import { getConfig } from './config/index';
import JsParser from './parser/js';
import { AngularTemplateParser } from './parser/angularJS';
import type { Record } from './parser/angularJS/type';
import { getAllFiles, IPathItem } from './utils/index';
import loggerInstence, { logger, resultLogger } from './module/log/index';
import Collector, { IKey } from './module/collector/index';
import { DATASOURCE_TYPE } from './utils/constant';
import _ from 'lodash';
import { checkConfig } from './utils';
import File from './module/file/new';
import rainbow from './module/rainbow';
import { Table } from 'console-table-printer';

const config = getConfig();
// 执行的主函数
async function exec() {
  // 配置检查是否正确，必填选填等
  if (!(await checkConfig(config))) {
    process.exit(1);
  }
  // 查找所有匹配的路径
  const allPath = getAllFiles(
    config.includePath,
    config.excludePath,
    config.fileType,
    config.getModuleName,
    config.rootPath,
    config.entryFile,
    config.tsConfigPath
  );
  // 只更新遍历路径相关的module
  const collectModule = allPath.reduce(
    (prev, cur: IPathItem) =>
      !prev.includes(cur.module) ? [...prev, cur.module] : prev,
    []
  );
  try {
    // 初始化收集器
    await Collector.init(config.i18nDataSource, collectModule);
  } catch (e) {
    logger.error('初始化收集器失败', e);
    process.exit(1);
  }

  // 所有文件执行转换
  allPath.forEach((fileItem: IPathItem) => {
    const { fileType } = fileItem;
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileType)) {
      // 初始化
      const parser = new JsParser(fileItem);
      // 解析
      parser.parse();
      // 转换
      parser.transform();
      // 提取
      parser.extract();
      // 输出
      parser.generate();
    } else if (['.html'].includes(fileType)) {
      // html 解析器
      const { filePath, module } = fileItem;
      const angularParser = new AngularTemplateParser({
        filePath,
        module,
        angularFilterName: config.angularFilterName,
        callback(dicts) {
          dicts.forEach((dictItem) => {
            const { id, zh, module } = dictItem;

            Collector.add(module, { id, zh, module });
          });
        },
        getData(id, module) {
          return Collector.get(id, module) as Record;
        },
        record(id) {
          Collector.record(module, id);
        },
        createRecord(item) {
          Collector.add(item.module, item);
        },
        getLegacyI18nData({ namespace, i18nKey }) {
          return Collector.get(i18nKey, namespace) as Record;
        },
      });
      angularParser.traverse();
    } else {
      logger.warn(`未找到${fileType}类型对应解析器`);
    }
  });

  // 输出收集器结果并生成配置文件
  const result = Collector.output();

  // 数据源是石头 输出到石头；json输出到i18nStorePath中
  if (config.i18nDataSource === DATASOURCE_TYPE.RAINBOW) {
    await rainbow.releaseDatas(result);
  } else {
    File.generateI18nStore(result);
  }
  // 生成i18nconfig
  File.generateI18nConfig(result);
  config?.extraOutput(allPath);

  // 输出结果日志
  const logResult = new Table({
    columns: [
      { name: 'module', title: '模块', alignment: 'left' },
      { name: 'moduleTotal', title: '词条总数' },
      { name: 'init', title: '现有' },
      { name: 'add', title: '新增' },
      { name: 'update', title: '更新' },
      { name: 'deleteNum', title: '冗余' },
      { name: 'noMatch', title: '文字与id不匹配' },
    ],
  });
  let totalCount = 0;
  Object.keys(result).forEach((module) => {
    const init = _.size(result[module][IKey.NO_CHANGE]);
    const add = _.size(result[module][IKey.KEY_ADD]);
    const update = _.size(result[module][IKey.KEY_UPDATE]);
    const deleteNum = _.size(result[module][IKey.KEY_DELETE]);
    const noMatch = _.size(result[module][IKey.NO_MATCH]);
    const moduleTotal = init + add + update + deleteNum + noMatch;

    logResult.addRow({
      module: `${module}`,
      moduleTotal,
      init,
      add,
      update,
      deleteNum,
      noMatch,
    });
    totalCount = totalCount + moduleTotal;
  });
  // 输出转换结果
  resultLogger.info('\n==转换结果==\n');
  resultLogger.info(`\n总计处理词条数量: ${totalCount}\n`);

  const log = logResult.render();
  resultLogger.info(log);

  try {
    await loggerInstence.showImportantMessage();
  } catch (e) {
    logger.error(e);
  }
}

exec()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  });
