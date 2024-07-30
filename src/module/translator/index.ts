import axios from 'axios';
import { getConfig } from '../../config/index';

const config = getConfig();

const API_CONFIG = {
  async hunyuan(accessToken: string, text: string) {
    const response = await axios.post(
      'http://hunyuanapi.woa.com/openapi/v1/chat/completions',
      {
        model: 'hunyuan-13B', // 模型名称, 当前支持"hunyuan", "hunyuan-13B"
        messages: [
          {
            role: 'user', // 角色,user或assistant
            // eslint-disable-next-line max-len
            // content: `You are a translation expert in the investment field, Please only Translate the following text from Chinese to English, Please do not output any content outside of the translated terms, delimited by triple backticks:\n\n \`\`\`${text}\`\`\``,
            content:
              '您是投资领域的翻译专家，只翻译三个反引号内的内容从中文翻译成英文，请不要输出翻译后的术语以外的任何内容，翻译英文的首字母大写',
          },
          {
            role: 'assistant',
            content:
              '当然可以。请您提供需要翻译的中文内容，我会将其准确地从中文翻译成英文。',
          },
          {
            role: 'user',
            content: '取消',
          },
          {
            role: 'assistant',
            content: 'Cancel',
          },
          {
            role: 'user',
            content: '编辑',
          },
          {
            role: 'assistant',
            content: 'Edit',
          },
          {
            role: 'user',
            content: '提交',
          },
          {
            role: 'assistant',
            content: 'Submit',
          },
          {
            role: 'user',
            content: '编辑基本信息',
          },
          {
            role: 'assistant',
            content: 'Edit basic information',
          },
          {
            role: 'user',
            content:
              '法务owner被你分配为了其他同事，该同事会收到提醒其处理的邮件',
          },
          {
            role: 'assistant',
            content:
              'The legal owner is assigned by you to another colleague, who will receive an email reminding him to handle it',
          },
          {
            role: 'user',
            content: '查看摘要',
          },
          {
            role: 'assistant',
            content: 'View summary',
          },
          {
            role: 'user',
            content: '翻译文案',
          },
          {
            role: 'assistant',
            content: 'Translation copy',
          },
          {
            role: 'user',
            content: text,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { choices } = response.data;
    if (choices && choices.length > 0) {
      const generatedText = choices[0].message.content
        .replace(/^```/, '')
        .replace(/```\s*$/, '')
        .trim();
      return generatedText;
    }
    return '翻译失败';
  },
};

class TranslatorInstance {
  private api: (accessToken: string, text: string) => Promise<string>;
  private token: string;

  constructor() {
    this.init();
  }

  public async requestTranslate(text: string) {
    if (this.api && this.token) {
      return this.api(this.token, text);
    }
  }

  public async requestHunyuan(token: string, text: string) {
    return API_CONFIG.hunyuan(token, text);
  }

  private init() {
    const { autoTranslate } = config as any;
    if (autoTranslate?.type && autoTranslate?.token) {
      if (autoTranslate.type === 'hunyuan') {
        this.api = API_CONFIG.hunyuan;
        this.token = autoTranslate.token;
      } else {
        console.warn('暂未支持的翻译器类型！');
      }
    }
  }
}

export const Translator = new TranslatorInstance();
