import { minify as htmlMinifier } from 'html-minifier';
import Minimize from 'minimize';
import throwError from '../../../utils/throw-error';

export default function minifier(htmlStr: string) {
  let html;
  try {
    html = htmlMinifier(htmlStr, {
      minifyJS: true,
      collapseWhitespace: true,
      caseSensitive: true,
    });
  } catch (e) {
    throwError(`minify error${e}`);
    html = new Minimize({
      empty: true,
      cdata: true,
      comments: true,
      ssi: true,
      lowerCaseAttributeNames: false,
    }).parse(htmlStr);
  }
  return html;
}
