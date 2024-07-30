import { Logger, logger, idLogger } from '../../../module/log';
import Helper from '../utils/helper';
import type { GetData } from './../type';
const updateLogger = Logger.createLogger('update');

export interface UpdateI18nProps {
  text: string;
  angularFilterName: string;
  getData: GetData;
  record: (id: string) => void;
  module: string;
}

class UpdateI18n {
  props: UpdateI18nProps;
  constructor(props: UpdateI18nProps) {
    this.props = props;
  }

  getExpressData(text = this.props.text) {
    let result: string[][] = [];
    try {
      const matchList = text.match(/(['"])\w+:\w{8}:.*?\1/gs);

      result = matchList.map((rawStr) => {
        const str = rawStr.slice(1, -1);
        const r = [str];
        try {
          const { groups } = /(?<module>\w+):(?<id>\w{8}):(?<hint>.*)?/gs.exec(
            str
          );
          if (!groups) {
            r.push(...str.split(':'));
          } else {
            const { module, id, hint } = groups;
            r.push(module, id, hint);
          }
        } catch (e) {
          r.push(...str.split(':'));
        }
        return r;
      });
    } catch (e) {
      logger.error(e.message);
    }
    return result;
  }

  equal(a: string, b: string) {
    return a.replace(/\n*\s*/g, '') === b.replace(/\n*\s*/g, '');
  }

  record() {
    const { record, module } = this.props;
    const result = this.getExpressData();
    result.forEach(([, m, id]) => {
      if (m === module) record(id);
    });
  }

  generateUpdatedText() {
    const { text, angularFilterName, getData } = this.props;
    if (!Helper.isStrictI18n(text, angularFilterName)) return text;
    let resultText = text;

    const results = this.getExpressData();
    results.forEach((expressObject) => {
      const [str, module, id, hint] = expressObject;
      const data = getData(id, module);
      if (!data || !data.zh) {
        getData(id, module);
        idLogger.error(`${id} 不存在词条库中, ${str}`);
        return;
      }
      const genHint = Helper.getZhCnForI18nHint(data.zh);

      if (hint !== genHint && !this.equal(hint, genHint)) {
        updateLogger.info(`多语言中文提示需要更新: ${hint} => ${genHint}`);
        resultText = text.replace(str, `${module}:${id}:${genHint}`);
      }
    });
    return resultText;
  }
}

export default UpdateI18n;
