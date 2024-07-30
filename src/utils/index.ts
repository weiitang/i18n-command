/* eslint-disable */
import * as types from '@babel/types';
import format from 'prettier-eslint';
import glob from 'glob';
import globby from 'globby';
import path from 'path';
import child from 'child_process';
import throwError from './throw-error';
import ts from 'typescript';
import { DATASOURCE_TYPE } from './constant';
import {IConfig} from '../config/config-default';
import _ from 'lodash';
import { logger } from '../module/log';
import rainbow from '../module/rainbow';
import md5 from 'md5';
import fs from 'fs-extra';
import dependencyTree from 'dependency-tree'

export interface IPathItem {
  filePath: string; // 路径
  module: string; // 模块
  fileType: string; // 扩展名
  fileName: string; // 文件名
}

export function getMd5Id(str: string, len = 8) {
  return `${md5(str).slice(0, len)}`;
}

// 检查配置
export const checkConfig = async (config: IConfig) => {
  let isPass = true;
  // 数据源为石头时，必须配置appID、userID、secretKey
  if (config.i18nDataSource === DATASOURCE_TYPE.RAINBOW) {
    if (_.isEmpty(config.rainbow)) {
      logger.error('请配置rainbow配置');
      isPass = false;
    } else {
      if (!config.rainbow.appID) {
        logger.error('请配置rainbow appID');
        isPass = false;
      }
      if (!config.rainbow.userID) {
        logger.error('请配置rainbow userID');
        isPass = false;
      }
      if (!config.rainbow.secretKey) {
        logger.error('请配置rainbow secretKey');
        isPass = false;
      }
      if (!config.rainbow.group || !config.rainbow.groupId || !config.rainbow.tableId || !config.rainbow.envName || !config.rainbow.creator) {
        logger.error('请配置rainbow group/groupId/tableId/envName/creator');
        try {
          const result = await rainbow.getAllGroup();
          logger.info('请从以下信息查询需要的group/group_id/table_id/envName/creator：', result);
        } catch (e) {}
        isPass = false;
      }
    }
  }
  return isPass;
};

// 获取所有路径
export const getAllFiles = (
  includePath: string[],
  excludePath?: string[],
  fileType?: string[],
  getModuleName?: (str: string) => string,
  rootPath?: string,
  entryFile?: string,
  tsConfigPath?: string,
): IPathItem[] => {
  // 保存结果 便于后续相同文件 简化逻辑
  const cacheResult = new Map();

  // includePath下的所有文件
  let files = globby.sync(includePath, {
    ignore: excludePath,
    absolute: true,
    cwd: rootPath,
  });

  files = fileType?.length
    ? files.filter((item: string) => {
      const { ext } = path.parse(item);
      return fileType.includes(ext);
    })
    : files;

  function parseResult(v: string[]) {
    return v.map((item: string) => {
      const module = getModuleName?.(item) || 'module';
      const { ext } = path.parse(item);
      return {
        fileType: ext,
        fileName: path.basename(item),
        filePath: item,
        module: module,
      }
    });
  }

  // 如果有入口文件 就按照入口文件的依赖文件去执行后续操作
  if (entryFile) {
    const entryFilePath = path.resolve(rootPath, entryFile);
    const tsConfig = tsConfigPath || `${rootPath}/tsconfig.json`
    const isExists = fs.pathExistsSync(tsConfig)
    const entryFileDependenceFiles = dependencyTree({
      filename: entryFilePath,
      directory: rootPath,
      tsConfig: isExists ? tsConfig : undefined,
      nodeModulesConfig: {
        entry: 'module',
      },
      filter: (filePath) => {
        // const { ext } = path.parse(filePath);
        // const isMatchType = fileType.includes(ext);
        // const isMatch = files.includes(filePath);
        // let result;
        // if (cacheResult.has(filePath)) {
        //   result = cacheResult.get(filePath);
        // } else {
        //   result = filePath.indexOf('node_modules') === -1;
        //   cacheResult.set(filePath, result);
        // }
        return filePath.indexOf('node_modules') === -1;
      },
      nonExistent: [],
      noTypeDefinitions: false,
    });

    // 遍历整个依赖树找到使用的 modulename
    const resultMap: Map<string, boolean> = new Map()
    function traverseTree(obj: any) {
      for (const key of Object.keys(obj)) {
        const { ext } = path.parse(key);
        const isMatchType = fileType.includes(ext);
        const isMatch = files.includes(key);
        
        if (!resultMap.has(key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null && !_.isEmpty(obj[key])) {
            traverseTree(obj[key]);
            resultMap.set(key, isMatch && isMatchType)
          } else {
            resultMap.set(key, isMatch && isMatchType)
          }
        }
      }
    }
    traverseTree(entryFileDependenceFiles);
    const result: string[] = []
    resultMap.forEach((value, key) => {
      if (value) {
        result.push(key)
      }
    })
    return parseResult(result)
  }

  return parseResult(files);
};

// 上方注释是否包含某个值
export const hasWordWithLeadingComment = (node: ts.Node, word: string) => {
  const commentRanges = ts.getLeadingCommentRanges(node.getFullText(), node.pos);
  const result = commentRanges?.some(({ kind, pos, end }) => {
    if (node.getFullText().substring(pos, end)
      .includes(word)) {
      return true;
    }
    return false;
  });
  return result;
}

export function getTime(){
  const date = new Date();
  let month = date.getMonth() + 1;
  let strDate = date.getDate();
  const paddingZero = (num: number) => {
    if (num < 10) {
      return '0' + num;
    }
    return `${num}`;
  }
  var currentdate = date.getFullYear() + paddingZero(month) + paddingZero(strDate) + paddingZero(date.getHours()) + paddingZero(date.getMinutes()) + paddingZero(date.getSeconds());
  return currentdate;
}
// ======================================================= 以上是新的方法==========================================================
// 获取eslint 配置
export function getEslintConfigPath(rootPath: string) {
  // 找到运行的目录 寻找eslint配置的路径
  const pwd = rootPath || process.cwd();
  const findArr = glob.sync(`${pwd}/.eslintrc.*`) || [];
  const eslintPath = findArr.filter(item => item.indexOf('node_modules') === -1);
  let config: any = {};
  if (eslintPath[0]) {
    const result = child.execSync(
      `./node_modules/.bin/eslint --print-config ${eslintPath[0]}`,
      {
        // cwd: pwd,
        encoding: 'utf-8',
      },
    );
    config = JSON.parse(result);
  }
  return config;
}

// 获取调用函数的名称
export function getCallExpressionName(node: any) {
  let callName: string[] = [];

  // 多级命名空间,如：xxx.xxx.xxx
  function callObjName(callObj: any): any {
    if (callObj.property?.name) {
      callName.unshift(callObj.property.name);
    } else if (callObj.name) {
      callName.unshift(callObj.name);
    }
    if (types.isMemberExpression(callObj.object)) {
      return callObjName(callObj.object);
    }
    if (types.isCallExpression(callObj.object)) {
      return callObjName(callObj.object.callee);
    }
    if (types.isIdentifier(callObj.object)) {
      callName.unshift(callObj.object.name);
    }
  }

  if (types.isCallExpression(node)) {
    if (types.isMemberExpression(node.callee)) {
      callObjName(node.callee);
    } else {
      // @ts-ignore
      callName = [node.callee.name] || [];
    }
  }
  return callName.join('.');
}

// 格式转换
export function prettierCode(
  code: string,
  eslintConfigPath: string,
  filePath: string,
) {
  const config = {
    text: code,
    filePath,
    eslintConfig: eslintConfigPath,
  };

  try {
    const code = format(config);
    return code;
  } catch (error) {
    throwError(error);
  }
}

export function isJsonString(str: string) {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}