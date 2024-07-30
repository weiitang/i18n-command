/* eslint-disable @typescript-eslint/quotes */
import { AngularTemplateParser } from './../index';

describe('test', () => {
  test('demo', (done) => {
    const d = new AngularTemplateParser({
      html: `xx`,
      callback() {
        expect(1).toEqual(1);
        done();
      },
      module: 'test',
      angularFilterName: 'i18next2',
      getData() {
        return {
          id: 'xxxx',
          zh: 'xxxx',
          module: 'xxxx',
        };
      },
      getLegacyI18nData() {
        return {
          id: 'xxxx',
          zh: 'xxxx',
          module: 'xxxx',
        };
      },
      createRecord() {},
    });
    d.traverse();
  });
});
