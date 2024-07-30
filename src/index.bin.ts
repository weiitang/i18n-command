import * as commander from 'commander';

import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import shell from 'shelljs';
import fs from 'fs-extra';
import path from 'path';

import translateExcelToJson from './utils/script/xlsx2json';
import translateJsonToExcel from './utils/script/json2xlsx';
import { Translator } from './module/translator';

const nowPath = process.cwd();
console.log('nowPath', nowPath, '__dirname', __dirname);
inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'));

const packageInfo = require(path.resolve(__dirname, '../../package.json'));
const program = new commander.Command();

program
  .version(packageInfo.version, '-v, --version')
  .usage('[options]')
  .option('-d --dir <dir>', '目录');

program.parse(process.argv);

console.log(chalk.green(figlet.textSync('TangWei')));

const userConfig: {
  workPath: string[];
  fileType: string[];
  i18nStoreDir: string;
} = {
  workPath: [],
  fileType: [],
  i18nStoreDir: `${nowPath}/i18n-store`,
};

// 文件路径
function workPathInit() {
  const promptList = [
    {
      type: 'fuzzypath',
      message: '选择需要国际化的文件夹路径：',
      name: 'workPath',
      excludePath: (nodePath: string) => nodePath.startsWith('node_modules'), // 默认不需要扫描的
      excludeFilter: (nodePath: string) => nodePath.startsWith('.'),
      itemType: 'directory',
      default: '',
    },
    {
      type: 'confirm',
      message: '支持多文件夹，是否仍有需要扫描的文件夹？',
      name: 'muliWorkPath',
    },
  ];
  inquirer
    .prompt(promptList)
    .then((answers: { workPath: string; muliAsrDir: boolean }) => {
      const path = `${nowPath}/${answers.workPath}`;
      userConfig.workPath.push(path);

      if (answers.muliAsrDir) {
        workPathInit();
      } else {
        fileTypeInit();
      }
    });
}

// 文件类型
function fileTypeInit() {
  const promptList = [
    {
      type: 'checkbox',
      message: '选择需要检查的文件类型:',
      name: 'fileType',
      choices: [
        {
          name: '.js',
          checked: true,
        },
        {
          name: '.jsx',
          checked: true,
        },
        {
          name: '.ts',
          checked: true,
        },
        {
          name: '.tsx',
          checked: true,
        },
      ],
    },
  ];
  inquirer.prompt(promptList).then((answers: { fileType: string[] }) => {
    userConfig.fileType = answers.fileType;

    createUserConfig(userConfig);
  });
}

// 是否使用当前配置文件
function useCurrentConfig() {
  const promptList = [
    {
      type: 'confirm',
      message: '是否使用该配置文件？',
      name: 'useCurrentConfig',
    },
  ];
  inquirer.prompt(promptList).then((answers: { useCurrentConfig: boolean }) => {
    if (answers.useCurrentConfig) {
      readUserConfig();
    } else {
      workPathInit();
    }
  });
}

// 检测目录下是否存在配置文件
function existsUserConfig() {
  const spinner = ora(
    '正在检查目录下是否存在 .i18n-command 配置文件...'
  ).start();

  setTimeout(() => {
    fs.access(`${nowPath}/.i18n-command.js`, (err: Error) => {
      if (err) {
        spinner.info('未检测到配置文件');
        workPathInit();
      } else {
        spinner.succeed('检测到目录下存在 .i18n-command 配置文件');
        useCurrentConfig();
      }
    });
  }, 1000);
}

// 根据excel生成json，会合并原来的
async function excelToJson() {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isConfirmTrans',
      message:
        '该操作会根据传入的excel文件生成对应的i18n.json文件，已存在的json文件会合并',
    },
    {
      type: 'list',
      name: 'mergeType',
      message: '请选择合并相同ID的覆盖方式',
      choices: [
        {
          name: 'excel覆盖原有json',
          value: 'excel',
        },
        {
          name: '原有json覆盖excel',
          value: 'json',
        },
      ],
    },
  ]);
  const { isConfirmTrans, mergeType } = answers;
  if (!isConfirmTrans) return;

  const { excelToJson } = program.opts();
  const [outputDir, excelPath] = excelToJson;
  // assert 16+才有
  if (!outputDir) console.log(chalk.red('请输入i18n输出目录'));
  if (!excelPath) console.log(chalk.red('请输入excel文件路径'));
  if (!fs.pathExistsSync(excelPath)) console.log(chalk.red('excel文件不存在'));
  translateExcelToJson(excelPath, outputDir, {
    mergeType,
  });
  console.log(chalk.green('生成json格式成功'));
}

// 根据json生成一份excel，直接覆盖
async function jsonToExcel() {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isConfirmTrans',
      message:
        '该操作会根据json生成一份全新excel，会直接覆盖原有excel，是否确定',
    },
    {
      type: 'confirm',
      name: 'isOnlyGenerateTranslate',
      message: '是否只生成未翻译文件',
      default: false,
    },
  ]);
  const { isConfirmTrans, isOnlyGenerateTranslate } = answers;
  if (!isConfirmTrans) return;

  function filter(item: any) {
    return !item.en;
  }

  const { jsonToExcel } = program.opts();
  const [jsonDir, excelPath] = jsonToExcel;
  if (!jsonDir) console.log(chalk.red('请输入i18n目录'));
  if (!excelPath) console.log(chalk.red('请输入excel文件路径'));
  const opt: any = {};
  if (isOnlyGenerateTranslate) {
    opt.filter = filter;
  }
  translateJsonToExcel(excelPath, jsonDir, opt);
  console.log(
    chalk.green(
      `生成excel文件成功${isOnlyGenerateTranslate ? '，只包括未翻译词条' : ''}`
    )
  );
}

// 执行代码
function exec() {
  const options = program.opts();
  switch (true) {
    case !!options.excelToJson:
      excelToJson();
      break;
    case !!options.jsonToExcel:
      jsonToExcel();
      break;
    case !!options.translateJson:
      runTranslate();
      break;
    case !!options.rainbow:
      runRainbow();
      break;
    case !!options.json:
      runJson();
      break;
    default:
      existsUserConfig();
  }
}

async function runTranslate() {
  const { translateJson } = program.opts();
  const [token, jsonDir, wordListDir] =
    translateJson === true ? [] : translateJson;
  const questions = [];
  if (!token) {
    questions.push({
      type: 'input',
      name: 'inputToken',
      message: '请输入翻译接口的token（目前只支持混元翻译）',
    });
  }
  if (!jsonDir) {
    questions.push({
      type: 'input',
      name: 'inputJsonDir',
      message: '请输入翻译json的文件夹目录或文件目录（绝对路径）',
    });
  }
  if (!wordListDir) {
    questions.push({
      type: 'input',
      name: 'inputWordListDir',
      message: '请输入词条库的地址（便于复用已有翻译，没有可为空）',
    });
  }
  const answers = await inquirer.prompt(questions);

  const {
    inputToken = token,
    inputJsonDir = jsonDir,
    inputWordListDir = wordListDir,
  } = answers;
  const wordMap = new Map();

  async function translateFile(filePath: string) {
    const jsonContent = fs.readJsonSync(filePath);
    for (const item of jsonContent) {
      if (/[\u4E00-\u9FA5]+/g.test(item.en) || !item.en) {
        // 词条库中已有
        if (wordMap.has(item.id)) {
          const text = wordMap.get(item.id);
          item.en = text;
          console.log('找到可以复用的词条:', item.zh, '\n=>', text);
        } else {
          // 提取词条并翻译
          const res = await Translator.requestHunyuan(inputToken, item.zh);
          item.en = res;
          console.log('翻译中:', item.zh, '\n=>', res);
        }
      } else {
        console.log(`词条<${item.zh}>，已翻译，跳过~`);
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(jsonContent, null, 2));
  }

  function wordListWalker(filePath: string) {
    if (fs.pathExistsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const jsonContent = fs.readJsonSync(filePath);
        for (const item of jsonContent) {
          if (!wordMap.has(item.id) && !/[\u4E00-\u9FA5]+/g.test(item.en)) {
            wordMap.set(item.id, item.en);
          }
        }
      }
      if (stat.isDirectory()) {
        const paths = fs.readdirSync(filePath);
        for (let index = 0; index < paths.length; index++) {
          const path = `${filePath}/${paths[index]}`;
          wordListWalker(path);
        }
      }
    }
  }

  // 先初始化词条库
  console.log('词库初始化...');
  wordListWalker(inputWordListDir);
  console.log(`词库初始完成，共词条: ${wordMap.size}个`);

  // 翻译
  const stat = fs.statSync(inputJsonDir);
  if (stat.isFile()) {
    await translateFile(inputJsonDir);
  } else {
    // 遍历json文件夹
    const paths = fs.readdirSync(inputJsonDir);
    for (let index = 0; index < paths.length; index++) {
      const path = `${inputJsonDir}/${paths[index]}`;
      const stat = fs.statSync(path);
      if (stat.isFile()) {
        await translateFile(path);
      }
    }
  }
}

// 跳过交互命令立即执行
function runRainbow() {
  const result = `
const UserConfig = require('${path.relative(
    __dirname,
    nowPath
  )}/.i18n-command.js');
module.exports = UserConfig;
`;
  fs.writeFileSync(
    path.resolve(__dirname, '../../src/config/config-user.js'),
    result,
    'utf8'
  );

  fs.writeFileSync(
    `${nowPath}/i18n-command-shell.js`,
    `require('i18n-command');`,
    'utf8'
  );
  const { rainbow } = program.opts();
  const [appID, userID, secretKey, tableId, groupId, group, creator, envName] =
    rainbow;
  const { code } = shell.exec(
    `node i18n-command-shell.js --appID=${appID} --userID=${userID} --secretKey=${secretKey} --tableId=${tableId} --groupId=${groupId} --group=${group} --creator=${creator} --envName=${envName}`,
    { silent: false, async: false }
  );
  deleteI18nAutoScript();
  if (code !== 0) {
    process.exit(code);
  }
}

function runJson() {
  const result = `
const UserConfig = require('${path.relative(
    __dirname,
    nowPath
  )}/.i18n-command.js');
module.exports = UserConfig;
`;
  fs.writeFileSync(
    path.resolve(__dirname, '../../src/config/config-user.js'),
    result,
    'utf8'
  );

  fs.writeFileSync(
    `${nowPath}/i18n-command-shell.js`,
    `require('i18n-command');`,
    'utf8'
  );
  const { json: entryFile = '' } = program.opts();
  // 不传参数 json 默认为true
  const { code } = shell.exec(
    `node i18n-command-shell.js --entryFile=${
      entryFile === true ? '' : entryFile
    }`,
    { silent: false, async: false }
  );
  deleteI18nAutoScript();
  if (code !== 0) {
    process.exit(code);
  }
}

// 创建用户的配置文件
function createUserConfig(conf: any) {
  const spinner = ora('正在创建 .i18n-command 本地配置文件...').start();

  setTimeout(() => {
    const userResult = `
const config = ${JSON.stringify(conf, null, 2)}
module.exports = config;
  `;
    fs.writeFile(
      `${nowPath}/.i18n-command.js`,
      userResult,
      'utf8',
      (err: Error) => {
        if (err) {
          console.log(err);
        }
        spinner.succeed(
          `${chalk.green('创建 .i18n-command 本地配置文件成功')}`
        );
        readUserConfig();
      }
    );
  }, 1000);
}

// 读取用户的配置文件
function readUserConfig() {
  const spinner = ora('正在读取本地配置...').start();
  setTimeout(() => {
    const result = `
const UserConfig = require('${path.relative(
      __dirname,
      nowPath
    )}/.i18n-command.js');
module.exports = UserConfig;
`;
    fs.writeFile(
      path.resolve(__dirname, '../../src/config/config-user.js'),
      result,
      'utf8',
      (err: Error) => {
        if (err) {
          console.log(err);
        } else {
          spinner.succeed('读取本地配置成功');
          createI18nAutoScript();
        }
      }
    );
  }, 1000);
}

// 创建执行脚本
function createI18nAutoScript() {
  const spinner = ora('正在创建本地脚本...').start();
  const shellFile = `require('i18n-command');`;

  setTimeout(() => {
    fs.writeFile(
      `${nowPath}/i18n-command-shell.js`,
      shellFile,
      (error: Error) => {
        if (error) {
          spinner.fail('创建文件失败，尝试使用管理员权限运行');
          return false;
        }

        spinner.succeed('创建i18n执行文件成功');
        execShell();
      }
    );
  }, 1000);
}

// 执行shell命令
function execShell() {
  const spinner = ora('正在执行国际化脚本...').start();
  setTimeout(() => {
    shell.exec(
      'node i18n-command-shell.js $*',
      { silent: false },
      (error: number, stdout: string, stderr: string) => {
        if (error) {
          spinner.fail('国际化脚本执行失败');
          console.log('Exit code:', error);
          console.log(chalk.red(stderr));
        } else {
          spinner.succeed('国际化脚本执行完成');
        }
        deleteI18nAutoScript();
      }
    );
  }, 1000);
}

// 完成后删除执行脚本
function deleteI18nAutoScript() {
  fs.unlinkSync(`${nowPath}/i18n-command-shell.js`);
}

// 开始执行
exec();
