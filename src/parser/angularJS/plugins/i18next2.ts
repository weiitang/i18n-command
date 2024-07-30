/*
 * @Description: file content
 */
import Helper from '../utils/helper';
import { createText } from '../ast';
import type { IPlugin } from '.';
import UpdateI18n from './../ast/update-i18n';
import { logger } from './../../../module/log';

export const i18next2Plugin: IPlugin = (params, prev) => {
  const { attrName, props, tag } = params;
  const code = prev.newStringCode;
  const { angularFilterName, module, record, getData, createRecord } = props;

  // 是否需要处理
  const isShouldCreateText = Helper.shouldCreateText({
    str: code,
    attr: attrName,
    i18nextExpression: angularFilterName,
  });
  if (!isShouldCreateText) {
    const isStrictI18next2Str = Helper.isStrictI18n(code, angularFilterName);
    if (!isStrictI18next2Str) return prev;

    // 如果是已存在的i18next2，执行更新操作
    const updateI18nInstance = new UpdateI18n({
      text: code,
      angularFilterName,
      module,
      record,
      getData,
    });
    // 记录已存在的i18next2词条，以便排除冗余数据
    updateI18nInstance.record();
    try {
      const newCode = updateI18nInstance.generateUpdatedText();
      return {
        ...prev,
        newStringCode: newCode,
      };
    } catch (e) {
      logger.error(`generateUpdatedText Error${e}`);
      return prev;
    }
  }

  const textClass = createText({
    originString: code,
    module,
    angularFilterName,
    attrName,
    tag,
    getData,
    createRecord,
  });

  if (!textClass) return prev;

  return {
    dicts: prev.dicts.concat(textClass.getData2Save()),
    newStringCode: textClass.replace(),
  };
};
