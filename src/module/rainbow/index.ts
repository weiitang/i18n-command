import _ from 'lodash';
import { getConfig } from '../../config/index';
import { IKey, ICollectorOutput, ICollectorItem } from '../collector';
import throwError from '../../utils/throw-error';
import { logger } from '../log';
import { getTime, isJsonString } from '../../utils';
import fs from 'fs-extra';

const config = getConfig();

class Rainbow {
  constructor(options: any) {
    console.log(options);
  }
}

class RainbowInstance {
  rainbow: any;
  appID: string;
  secretKey: string;
  userID: string;
  envName: string;
  groupId: number;
  tableId: number;
  group: string;
  creator: string;
  signMethod?: string;
  currentTime?: string;
  signInfo?: any;

  getInstance() {
    this.rainbow = new Rainbow({
      connectStr: 'http://api.rainbow.oa.com:8080',
      timeoutPolling: 20000,
      v2: true,
      ...config.rainbow.config,
    });
    this.appID = config.rainbow.appID;
    this.userID = config.rainbow.userID;
    this.envName = config.rainbow.envName;
    this.secretKey = config.rainbow.secretKey;
    this.signMethod = config.rainbow.signMethod || 'sha1';
    this.groupId = config?.rainbow?.groupId;
    this.group = config?.rainbow?.group;
    this.tableId = config?.rainbow?.tableId;
    this.creator = config?.rainbow?.creator;
    this.signInfo = {
      appID: this.appID,
      userID: this.userID,
      secretKey: this.secretKey,
      signMethod: this.signMethod,
    };
    return this;
  }
  // 配置不完整查询打印或有配置
  async getAllGroup() {
    const envList = await this.queryEnvList();
    const result = [];
    for (const env of envList) {
      const groupList = await this.queryGroupList(env.env_name);
      groupList.length && result.push(...groupList);
    }
    return result;
  }
  // 过去环境列表
  async queryEnvList() {
    const res = await this.rainbow.queryEnvList(
      { appID: this.appID },
      this.signInfo
    );
    return res.env_list;
  }
  // 获取所有gruop
  async queryGroupList(envName: string) {
    const res = await this.rainbow.queryGroupList({
      appID: this.appID,
      envName,
      ...this.signInfo,
    });
    return res.group_infos;
  }
  // 查询版本信息
  async queryHistoryVersions() {
    const res = await this.rainbow.queryHistoryVersions(
      {
        appID: this.appID,
        groupID: this.groupId,
        groupName: this.group,
        envName: this.envName,
      },
      this.signInfo
    );
    return res;
  }
  // 查询queryGroupInfo信息
  async queryGroupInfo() {
    const res = await this.rainbow.queryGroupInfo(
      {
        appID: this.appID,
        groupID: this.groupId,
        groupName: this.group,
        envName: this.envName,
      },
      this.signInfo
    );
    return res;
  }
  // 查询表中全部数据
  async queryAllDatas() {
    const res = await this.rainbow.queryRowDatas({
      group_id: this.groupId,
      table_id: this.tableId,
      ...this.signInfo,
    });
    const result = res?.table_config_info?.datas?.map(
      (item: { column_datas: any }) =>
        _.mapValues(_.keyBy(item?.column_datas, 'key'), 'value')
    );
    return result;
  }
  // 更新数据
  async changeAllDatas(data: ICollectorOutput) {
    const allWords: any[] = [];
    Object.keys(data).forEach((module) => {
      const filterKey = [
        IKey.KEY_ADD,
        IKey.NO_CHANGE,
        IKey.KEY_UPDATE,
        IKey.NO_MATCH,
      ];
      // 是否移除冗余
      if (!config.removeRedundant) {
        filterKey.push(IKey.KEY_DELETE);
      }
      // 去重 排序
      const moduleAllWords = _.orderBy(
        _.uniqBy(
          filterKey.reduce(
            (prev, cur: string) => [...prev, ...(data[module][cur] || [])],
            []
          ),
          'id'
        ),
        ['id']
      );
      allWords.push(...moduleAllWords);
    });
    // nochange 的词条过滤掉，只更新有变动的词条
    const effectWords = allWords.filter(
      (item: ICollectorItem) => item.isChanged
    );
    const addWords = effectWords.filter(
      (item: ICollectorItem) => !item._auto_id
    );
    const changeWords = effectWords.filter(
      (item: ICollectorItem) => item._auto_id
    );

    if (changeWords.length) {
      const { ret_code: retCode } = await this.rainbow.changeRowData(
        changeWords.map((item) => ({
          op_type: 'ROWOP_UPDATE',
          row_id: item._auto_id,
          column_datas: [
            { key: 'module', value: item.module || '' },
            { key: 'id', value: item.id || '' },
            { key: 'zh', value: item.zh || '' },
            { key: 'zh_plural', value: item.zh_plural || '' },
            { key: 'en', value: item.en },
            { key: 'en_plural', value: item.en_plural || '' },
            { key: 'note', value: item.note },
            { key: 'origin', value: item.origin || '' },
            { key: 'status', value: item.status || '' },
          ],
        })),
        {
          group_id: this.groupId,
          group: this.group,
          table_id: this.tableId,
          ...this.signInfo,
        }
      );
      retCode !== 0
        ? throwError('更新数据到七彩石出错，请reset代码重试')
        : logger.info('更新数据到七彩石成功');
    }
    if (addWords.length) {
      const { ret_code: retCode } = await this.rainbow.changeRowData(
        addWords.map((item) => ({
          op_type: 'ROWOP_ADD',
          column_datas: [
            { key: 'module', value: item.module || '' },
            { key: 'id', value: item.id || '' },
            { key: 'zh', value: item.zh || '' },
            { key: 'zh_plural', value: item.zh_plural || '' },
            { key: 'en', value: item.en },
            { key: 'en_plural', value: item.en_plural || '' },
            { key: 'note', value: item.note },
            { key: 'origin', value: item.origin || '' },
            { key: 'status', value: item.status || '' },
          ],
        })),
        {
          appID: this.appID,
          group_id: this.groupId,
          group: this.group,
          table_id: this.tableId,
          ...this.signInfo,
        }
      );
      retCode !== 0
        ? throwError('新增数据到七彩石出错，请reset代码重试')
        : logger.info('新增数据到七彩石成功');
    }
    return {
      changeWords,
      addWords,
    };
  }
  // 发布数据
  async releaseDatas(data: ICollectorOutput) {
    try {
      // 更新数据
      const { changeWords, addWords } = (await this.changeAllDatas(data)) || {};
      if (changeWords.length || addWords.length) {
        const currentTime = `v_${getTime()}_release`;
        // 一键发布任务
        await this.rainbow.oneClickReleaseTask(
          {
            appID: this.appID,
            groupID: this.groupId,
            groupName: this.group,
            creator: this.creator,
            updators: this.creator,
            approvers: this.creator,
            envName: this.envName,
            type: 0,
            versionName: currentTime,
          },
          this.signInfo
        );

        // 如果发布成功记录发布时间
        this.currentTime = currentTime;
        // 更新config中version信息
        setCurrentVersion(currentTime);

        logger.info('七彩石发布数据成功');
      } else {
        logger.info('数据未有修改');
      }
    } catch (e) {
      logger.error('七彩石发布数据失败, 请reset代码重试：', e);
      process.exit(1);
    }
  }
}

// 根据环境获取本地当前json配置的版本
export function getCurrentVersion() {
  fs.ensureFileSync(`${config.i18nConfigPath}/.version`);
  const string = fs.readFileSync(`${config.i18nConfigPath}/.version`, 'utf-8');
  // 需要是json格式 如果不是就返回
  if (isJsonString(string)) {
    const result = JSON.parse(string);
    return result?.[config?.rainbow?.envName] || 'not_found';
  }
  return 'not_found';
}

// 根据环境设置本地配置版本
export function setCurrentVersion(version: string) {
  fs.ensureFileSync(`${config.i18nConfigPath}/.version`);
  const string = fs.readFileSync(`${config.i18nConfigPath}/.version`, 'utf-8');
  let result: Record<string, string> = {};
  const env = config?.rainbow?.envName || 'dev';
  // 需要是json格式
  if (isJsonString(string)) {
    result = JSON.parse(string);
    result[env] = version;
  } else {
    result[env] = version;
  }
  fs.writeFileSync(`${config.i18nConfigPath}/.version`, JSON.stringify(result));
}

export default new RainbowInstance();
