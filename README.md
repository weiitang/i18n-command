

# i18n-command

 i18n-command是一个国际化工具，可以使开发同学减少开发过程中对国际化的关注，尽量使日常开发国际化步骤自动化，优化国际化词条开发、管理、协作的流程。



尝试解决以下问题：

1. 旧项目想要整体迁移到国际化，但已有项目大，迁移工作量大，重复工作多。

2. 开发体验差，日常开发业务需要注意把所有文案进行国际化处理。

3. 国际化词条的管理难，每次更改词条需要业务同步给开发侧由开发同学处理。

   

#### 开始使用

`npm i kz-i18n-command`

在项目根目录中新建`.i18n-command.js`的文件，按照下文参数说明进行配置，例如：

```js
const dirname = __dirname;
const path = require('path');
const globby = require('globby');
const fs = require('fs');

const config = {
	rootPath: dirname,
  // 需要遍历的目录，rootPath的相对路径，minimatch语法：https://github.com/isaacs/minimatch#usage
	includePath: ['./src/modules/i18n-test/**'],
  // 转换排除的路径 https://github.com/isaacs/minimatch#usage
  excludePath: ['**/_i18n', '**/*.xlsx',],
  fileType: ['.js', '.jsx', '.ts', '.tsx', '.html'],
	// 获取模块名方法，也就是i18n中namespace的值，入参为filepath，默认为filepath的basename
  getModuleName: (filePath) => {
		console.log('====', filePath);
    let result = "notfound";
    if (filePath.includes("src/modules/")) {
			const m = filePath.split("src/modules/")[1].split("/")[0]
			// 排除直接是文件
			if (m.includes('.')) return result;
      result = m;
    }
    if (filePath.includes("src/apps/")) {
      result = filePath.split("src/apps/")[1].split("/")[0];
    }
    if (filePath.includes("src/components/")) {
      result = "components";
    }
    if (filePath.includes("src/libs/")) {
      result = "libs";
    }
    if (filePath.includes("packages/shared/")) {
      result = "shared"
    }
    return result;
  },
  i18nStorePath: path.resolve(dirname, './src/i18n-store'),
  i18nConfigPath: path.resolve(dirname, './src/i18n/config'),
	i18nDataSource: 'json',
  // i18n组件的名字
	i18nObject: '$i18next',
	// i18n 调用方法
  i18nMethod: 't',
	// 引用i18n组件的引入目录
  // TODO 目前不能根据当前路径替换为相对路径，只能是alias写法
  i18nObjectPath: '@/i18n',
	// 不需要转换的方法名，比如console.log内的文字就不需要国际化
	excludeFunc: ['dayjs.format', 'I18n.t', 'i18n.t2', 'i18n.t', 'history.push', 'console.log', 'date.format', 'moment.format'],
	// 分隔符 转换后i18n key与中文的分割符 如 module:key{separator}中文
  // 分隔符 转换后i18n key的分割符 如 module:key:中文
	separator: ':',
	// 日志路径配置
	logDir: null,
  autoCompleteImport: true,
	// 只输出国际化脚本覆盖到的词条
  outputOnlyUsed: true,
	// prettier的配置
  prettierOptions: {
    useTabs: true,
  },
	extraOutput: (allPath) => {
    function toCamelCase(name) {
      return name.replace(/\-(\w)/g, function (all, letter) {
        return letter.toUpperCase();
      });
    }

    // 解析命令行中入口文件
    const argvs = process.argv.splice(2)
    // 优先使用命令行中的入口文件 没有就取
    const entryFile = argvs?.[0]?.split('entryFile=')?.[1] || config?.entryFile || './src/index.tsx'
		
    if (entryFile) {
			// 下一个文件夹的路径
      // const pathArray = entryFile?.split('/')
      // const configJsName = pathArray?.[pathArray.length - 1]
			
      // 遍历文件夹下json，自动再生成index.js
      const configFiles = globby.sync(`${config.i18nConfigPath}/*.json`, {
				ignore: ["**/index.js"],
        absolute: true,
      });
      
      const configList = configFiles.map((filePath) =>
        path.basename(filePath, ".json")
      );

      // 从解析的所有文件中 找到需要引入的json文件
      const importList = configList.filter(item => allPath.some(path => {
        if (path.module === 'shared' && item === `shared-${configJsName}`) {
          return true
        }
        return path.module === item
      }))
			console.log('-------', argvs,configFiles, configList,importList);

      fs.writeFileSync(
        `${config.i18nConfigPath}/index.js`,
        `${importList
      .map(
        (fileName) => `import ${toCamelCase(fileName)} from './${fileName}.json';`
      )
      .join("\n")}

export const config = [${importList
        .map((name) => toCamelCase(name))
        .join(", ")}]
`,
      "utf8");
    } else {
      console.warn('\n未找到声明的入口文件，跳过国际化配置文件生成步骤！\n')
    }

    // 执行一个格式化
    const commandText = `npx eslint ${config.includePath.join(
      " "
    )} ./src/i18n/config/**.js --ext .js,.jsx,.ts,.tsx --fix --no-error-on-unmatched-pattern --ignore-path ./.eslintignore`
    shelljs.exec(commandText, { silent: false, async: false });
  },
}

module.exports = config;

```

配置完毕后运行`node_modules/.bin/i18n-command ` 即可，脚本会按照规则替换源码中的中文并转换为国际化的书写格式，并把词条抽取出来，存入json文件中供后续初始化i18n类使用。



#### 词条管理方式

目前词条管理有两种方式：rainbow-石头远端配置管理，json-本地json文件管理。

石头方式，会把词条以下图格式保存在石头配置中心.

json方式，把词条按照namespace区分，保存在单独的json文件中，并处存在i18nStorePath目录下.


推荐使用石头配置的管理方式，词条存放在石头配置中心可便于业务人员线上进行更新词条。下面简要说明在流水线上的配置示例.

使用石头配置的管理方式运行脚本时，脚本需要接收石头AppID，secretKey等参数，故首先应用`石头Rainbow常用操作`石头插件读取石头的配置，填入插件相应参数，注意这里建议选择红框内选项。

后续将石头插件读取到的AppID等配置，设置到环境变量中，推荐使用python插件进行如下设置:

```python
import os
import json

try:
    if 'BranchLife' in  os.environ  and os.environ['BranchLife']:
        bf_str = os.environ['BranchLife']
        bf_json_obj = json.loads(bf_str)
        if bf_json_obj:
            dict(bf_json_obj)
            if 'rianbow_appID' in bf_json_obj and bf_json_obj['rianbow_appID']:
                print("setEnv 'rianbow_appID' '{}'".format(bf_json_obj['rianbow_appID']))
            if 'rianbow_userID' in bf_json_obj and bf_json_obj['rianbow_userID']:
                print("setEnv 'rianbow_userID' '{}'".format(bf_json_obj['rianbow_userID']))
            if 'rianbow_secretKey' in bf_json_obj and bf_json_obj['rianbow_secretKey']:
                print("setEnv 'rianbow_secretKey' '{}'".format(bf_json_obj['rianbow_secretKey']))
            if 'rianbow_tableId' in bf_json_obj and bf_json_obj['rianbow_tableId']:
                print("setEnv 'rianbow_tableId' '{}'".format(bf_json_obj['rianbow_tableId']))
            if 'rianbow_groupId' in bf_json_obj and bf_json_obj['rianbow_groupId']:
                print("setEnv 'rianbow_groupId' '{}'".format(bf_json_obj['rianbow_groupId']))
            if 'rianbow_group' in bf_json_obj and bf_json_obj['rianbow_group']:
                print("setEnv 'rianbow_group' '{}'".format(bf_json_obj['rianbow_group']))
            if 'rianbow_creator' in bf_json_obj and bf_json_obj['rianbow_creator']:
                print("setEnv 'rianbow_creator' '{}'".format(bf_json_obj['rianbow_creator']))
            if 'rianbow_envName' in bf_json_obj and bf_json_obj['rianbow_envName']:
                print("setEnv 'rianbow_envName' '{}'".format(bf_json_obj['rianbow_envName']))
    else:
        exit(1)
except Exception as e:
    print(e)
    exit(1)
```



将需要的配置设置到环境变量中后，只需要使用bash插件调用国际化脚本即可，类似如下：

```bash
npm install --verbose

echo '运行脚本'

npm run i18n ${rianbow_appID} ${rianbow_userID} ${rianbow_secretKey} ${rianbow_tableId} ${rianbow_groupId} ${rianbow_group} ${rianbow_creator} ${rianbow_envName}

if [ $? -ne 0 ]
then
echo "i18n fail"
exit 1
else
echo "i18n success"
fi

exit 0
```



因插件会修改源码，后续也需要在把修改后的源码进行一次commit操作：

```bash
commit_path="./"

git status ${commit_path} -s

if [ -n "$(git status ${commit_path} -s)" ];then

    echo "有需提交文件"
    git status ${commit_path} -s

    git config --global push.default matching
    git config --global user.email "xxx.com"
    git config --global user.name "xxx"
    git pull
    git add ${commit_path}
    git commit -m "[*] update file --i18n-command "
    git push origin ${branchname}
else
    echo  "未有需提交文件"
fi
```



以上为示例步骤，用户也可以根据自己需要设置相应流水线步骤。



#### 生成词条的格式

目前i18n-command生成的国际化格式为`i18n.t(模块名:md5值:汉字)`，例如：`I18n.t("demo:91575d2e:只能输入数字");`，使用该种格式的原因是：

1. 便于查找，考虑到日常开发中如果只使用namespace:key的格式，在debug或查找文案时会比较繁琐，需要在json文件中找到中文对应的key，再搜索key找到对应代码的位置，保存中文后可以简化此步骤。
2. 便于复用翻译，目前是以中文的md5作为key值来保存词条配置，当有新的中文文案需要进行国际化时，脚本可以在整个项目的词条中查找是否有匹配的翻译进行复用。
3. 词条缺失展示不会异常，原有方案在词条文案缺失时会把key直接展示在界面上，现有格式在没有找到词条配置时可以默认展示该词条的中文。

以上该格式需要对i18n方法进行2次封装，目前主流国际化方案为i18next，以下为一个实例参考：

```js
import i18n from 'i18next';

const t = (text, options) => {
    // 解析word
    const wordArr = text.split(':');
    const namespace = wordArr[0];
    const word = wordArr[1];
    const defaultValue = wordArr[2];
    const key = `${namespace}:${word}`;
    if (i18n.exists(key)) {
      return i18n.t(key, options);
    }
    return defaultValue;
};
```



#### 旧项目迁移

按照上述使用说明进行配置后，编写迁移方法：`migrateFunc`， 以下为一个实际例子进行参考：

现存i18n目录结构如下：

```reStructuredText
├── i18n
│   ├── en
│   │   ├── common.js
│   ├── zh-cn
│   │   ├── common.js
```

每个文件结构如下（示意）：

```js
export default {
	test: '测试',
}
```

然后编写迁移方法（示意）：

```js
migrateFunc: () => {
  	// 查询到每个配置文件
		const configFiles = glob.sync(`${path.resolve(__dirname, './src/i18n')}/**/!(index|test).js`);
		const result = {};
		const langMap = {
			'zh-cn': 'zh',
			en: 'en',
		}
		const moduleMap = {
			'common': {old: 'common', new: 'common'},
		}
    for (const filePath of configFiles) {
      //requireEsm为common引用es6模块的包
			const {default: content} = requireEsm(filePath);
			const fileName = path.basename(filePath, '.js'); // 文件名
			const module = moduleMap[fileName] // 文件映射的module名
			const rawLang = filePath.split('src/i18n/')[1].split('/')[0]; // 文件所属语言
			const lang = langMap[rawLang] || rawLang;
			Object.keys(content).forEach((rawId) => {
				const key = `${module.old}:${rawId}`; // 以module:id 作为储存的key，避免多个模块有相同的id
				const langKey = rawId.includes('_plural') ? `${lang}_plural` : lang;
				if (!result[key]) {
					result[key] = {
						module: module.new, // 老的词条想要映射的模块名
						[langKey]: content[rawId],
					};
				} else {
					result[key][langKey] = content[rawId];
				}
			});
		}
		return result;
	},
```

返回结果会类似于以下的一个对象：

```js
{
  'common:test': {
    zh: '测试',
    zh_plural: '',
    en: 'test',
    en_plural: '',
    module: 'common—new'
  }
}

'common:test'为老词条的key，在的迁移时脚本会扫描oldi18n.t('common:test')的词条，找到'common:test'对应的翻译，把相应配置导入到新的词条库当中，并把老的国际化方法转为新的写法newi18n.t('common—new:md5xxxx:测试')，并会把该词条存放在'common—new'的命名空间下。
```

后续步骤同上述使用说明



#### 参数说明

| 参数                 | 必填 | 类型         | 默认值                                  | 说明                                                         |
| -------------------- | ---- | ------------ | --------------------------------------- | ------------------------------------------------------------ |
| rootPath             | 否   | string       | path.resolve('./')                      | 需要运行的项目根路径                                         |
| includePath          | 是   | array        | []                                      | 需要遍历的目录，rootPath的相对路径<br />minimatch语法 https://github.com/isaacs/minimatch#usage |
| excludePath          | 否   | array        | []                                      | 转换排除的路径                                               |
| fileType             | 否   | array        | ['.js', '.jsx', '.ts', '.tsx', '.html'] | 需要转换文件的类型, 类型续满足fileType要求，如果在includePath中已定义文件格式，这里可为空 |
| getModuleName        | 否   | function     |                                         | 获取模块名方法，也就是i18n中namespace的值，入参为filepath，默认为filepath的basename |
| migrateFunc          | 否   | function     |                                         | 读取现有i18n配置自定义方法，便于迁移词条时寻找到老词条。方法需要返回一个object {[module-id]: {zh, en, module,zh_plarul, en_plarul}} |
| i18nDataSource       | 是   | json/rainbow |                                         | 配置的数据源 json / rainbow<br />如果是json，i18nStorePath必填；如果是rainbow，rainbowConfig必填 |
| i18nStorePath        | 是   | string       |                                         | i18n-store目录，词条的存档                                   |
| rainbow              | 是   | object       | {config: {}, signMethod: 'sha1'}        | config为石头SDK初始化配置https://git.woa.com/rainbow/nodejs-admin，signMethod为加密方式 |
| i18nConfigPath       | 是   | string       |                                         | 生成i18n json文件路径                                        |
| angularFilterName    | 否   | string       | i18next2                                | angular 模板i18n过滤器名字                                   |
| i18nObject           | 否   | string       | I18n                                    | i18n组件的名字                                               |
| i18nMethod           | 否   | string       | t                                       | i18n的调用方法，和i18nObject组成 I18n.t                      |
| i18nObjectPath       | 否   | string       | @pc/components                          | 如果配置自动引用时i18n组件的引入目录，目前不能根据当前路径替换为相对路径，只能是alias写法 |
| excludeFunc          | 否   | array        | []                                      | 不需要转换的方法名，比如console内的文字不需要国际化配置['console.log',  'console.error'] |
| transformOldI18nWord | 否   | string       |                                         | 提取原有i18n配置 需要提取的方法名，如配置会把原有配置转为新的i18n配置，如不配置则不会提取 |
| separator            | 否   | string       | :                                       | 分隔符 转换后i18n key与中文的分割符 如 module​ : key :中文    |
| autoCompleteImport   | 否   | bool         | false                                   | 检查是否引入国际化i18nObject并自动补充                       |
| removeRedundant      | 否   | bool         | false                                   | 是否清除冗余数据（目前不建议清楚，版本未稳定移除可能造成词条缺失） |
| prettierOptions      | 否   | object       | {}                                      | prettier 配置，主要用于html缩进类型不一样，app一直用空格，pc一直用tab |
| logDir               | 是   | string       | path.resolve(__dirname, '../logs')      | 脚本输出日志保存的路径                                       |
| extraOutput          | 否   | function     |                                         | 输出文件时额外要输出的内容，可以自定义执行一些方法，比如生成i18n json文件后，可以自动生成index.js 引入文件 |









## 使用

`i18n-command`目录下运行`npm link`

需要国际化的项目根目录下运行`npm link i18n-command`

复制 [config-user-sample](readme中的.i18n-command.js) 到项目根目录下，修改 `workPath` 字段，将要提取替换的文件夹加进去。

运行 `i18n-command`


## xlsx与json的转换

如果需要手动把json转为excel，运行 `i18n-command -excel <json-path> <excel-file-path>`

ex: `i18n-command -excel ./i18n-store ./excel.xlsx"`

把excel生成为json，运行 `i18n-command -json <json-path> <excel-file-path>`

ex: `i18n-command -json ./i18n-store ./excel.xlsx"`

## 运行demo

根目录下运行`node index.js`，在demo文件夹下看到输出结果

## 功能

* **构建用户配置文件**
>- 选择需要国际化代码所在文件夹
>- 选择需要检查的文件类型
>- 创建本地.i18n-command配置

* **检测配置文件**
>- 检测是否存在.i18n-command配置文件
>- 读取本地配置

* **自动化脚本**
>- 创建本地执行文件
>- 自动执行国际化脚本
>- 执行后移除本地执行文件
 
# 配置项

# 国际化忽略

### 非html文件
忽略一行：在需要忽略的上一行添加`@i18n-ignore`进行下一行代码的国际化忽略 [不推荐]
忽略一类方法: excludeFunc
忽略一个文件：加到 excludePath

### html文件
忽略一个dom，不包含子类: 加个属性值 i18n-ignore
忽略一个dom，包含子类: 加个属性值 i18n-ignore-children
忽略一个文件：加到 excludePath



# 国际化转换结果

```jsx
// 字符串
// const a = '只能输入数字';
const a = I18n.t("demo:91575d2e:只能输入数字");

// 对象
// const b = {a: '只能输入数字',};
const b = { a: I18n.t("demo:91575d2e:只能输入数字") };

// 模板字符串
// const e = `这里有${a}`
const e = I18n.t(`demo:85805805:这里有{{a}}`, { a: a });

// jsx
// const c = <span className="text-12 ml-2 pl-1.5 pr-1.5 bg-red-200 text-red-700 rounded-full">{`还剩${a}天`}</span>
const c = (
  <span className="text-12 ml-2 pl-1.5 pr-1.5 bg-red-200 text-red-700 rounded-full">
    {I18n.t(`demo:8ef4c91d:还剩{{a}}天`, { a: a })}
  </span>
);

// const d = <span className="text-12 ml-2 pl-1.5 pr-1.5 bg-gray-400 text-white rounded-full">已截止</span>;
const d = (
  <span className="text-12 ml-2 pl-1.5 pr-1.5 bg-gray-400 text-white rounded-full">
    {I18n.t("demo:ff7420db:已截止")}
  </span>
);

// 函数调用
// console.error('保存失败')
console.error(I18n.t("demo:6de920b4:保存失败"));

// 属性
/*const f = <input
  options={this.selectOptions}
  optionKey="key"
  optionText="text"
  placeholder="请选择"
/>*/
const f = (
  <input options={this.selectOptions} optionKey="key" optionText="text" placeholder={I18n.t("demo:708c9d6d:请选择")} />
);
```

html 见 `src/angular-template-parser/**/*.test.js`


自动引入使用方法：

词条状态init/add/delete/update
更新词条策略：
读取配置->从i18nStorePath中初始化词条库，标记状态为空->从i18nConfigPath读取目前代码中已有的i18n配置，更新状态为init/update->读取i18n找到需要翻译的更新状态为add->其他状态仍然为空的即为冗余词条需要删除

## CI/CD
`git push -o ci.skip` 可以跳过流水线