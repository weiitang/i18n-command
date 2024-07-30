/*
 * @Description: file content
 */

import type { IPlugin } from './';
import { BindingPipeClass } from './../legacy/binding-pipe';
import { logger } from '../../../module/log';

function isI18nextExpression(code: string) {
  return /(['"])\w+:\w+\1.*?\|.*?i18next/gim.test(code);
}

export const legacyPlugin: IPlugin = (params, prev) => {
  const { code, props, originCode } = params;

  if (!isI18nextExpression(code)) return prev;

  const bindingPipeClassParams = {
    ...props,
    ...params,
    code: prev.newStringCode,
    originString: originCode,
  };

  if (BindingPipeClass.verify(code, bindingPipeClassParams)) {
    if (!bindingPipeClassParams.getLegacyI18nData) {
      logger.error('getLegacyI18nData is not defined');
      return prev;
    }
    const bindingPipe = new BindingPipeClass(bindingPipeClassParams);

    return {
      newStringCode: bindingPipe.replace(),
      dicts: prev.dicts.concat(bindingPipe.getData2Save()),
    };
  }

  return prev;
};
